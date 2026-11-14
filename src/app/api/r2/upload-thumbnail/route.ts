import { NextRequest, NextResponse } from 'next/server';
import { extractColorProfile } from '../../../../lib/colorExtract';
import { withDimensions } from '../../../../lib/dimensions';
import { isR2Configured, uploadToR2, getR2Config } from '../../../../lib/r2';
import { db } from '../../../../lib/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { saveGalleryItems, invalidateGalleryCache } from '../../../../lib/galleryService';
import { ThumbnailItem } from '../../../../lib/types';
import { isSafeExternalHttpUrl } from '../../../../lib/urlSafety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB cap
const MAX_BATCH_ITEMS = 100;

interface UploadItemPayload {
  id?: string;
  kind?: 'thumbnail' | 'poster';
  videoId?: string;
  imageUrl: string;
  sourceUrl?: string;
  title: string;
  creator?: string;
  niche?: string;
  tags?: string[];
  styles?: string[];
  views?: string;
  viewsEstimate?: string;
  publishedTime?: string;
}

function sanitizeFilename(title: string, videoId: string): string {
  const cleanTitle = title
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);

  const cleanVid = (videoId || 'thumb').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'thumb';
  const randSuffix = Math.random().toString(36).slice(2, 7);
  if (cleanTitle) {
    return `${cleanTitle}_${cleanVid}_${randSuffix}.jpg`;
  }
  return `thumb_${cleanVid}_${randSuffix}.jpg`;
}

async function fetchImageBuffer(imageUrl: string, videoId?: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (imageUrl.startsWith('data:image/')) {
    const matches = imageUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
    if (matches && matches[2].length <= MAX_UPLOAD_IMAGE_BYTES * 1.4) {
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length <= MAX_UPLOAD_IMAGE_BYTES) {
        return { buffer, contentType };
      }
    }
    return null;
  }

  const urlsToTry: string[] = [];
  if (isSafeExternalHttpUrl(imageUrl)) {
    urlsToTry.push(imageUrl);
  }
  const cleanVid = videoId?.replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleanVid && cleanVid.length === 11) {
    urlsToTry.push(`https://i.ytimg.com/vi/${cleanVid}/maxresdefault.jpg`);
    urlsToTry.push(`https://i.ytimg.com/vi/${cleanVid}/sddefault.jpg`);
    urlsToTry.push(`https://i.ytimg.com/vi/${cleanVid}/hqdefault.jpg`);
  }

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (res.ok) {
        if (res.url && !isSafeExternalHttpUrl(res.url)) continue;
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        if (contentType.toLowerCase().startsWith('text/')) continue;
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_UPLOAD_IMAGE_BYTES) continue;
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > 2000 || url.includes('hqdefault')) {
          return { buffer, contentType };
        }
      }
    } catch {
      // try next URL
    }
  }

  return null;
}

async function optimizeBuffer(input: Buffer, isPoster: boolean): Promise<Buffer> {
  try {
    const mod = await import('sharp').then((m: any) => m.default || m);
    const matteColor = isPoster ? '#000000' : '#090a0d';
    const maxSide = isPoster ? 1000 : 1280;
    return await mod(input)
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: matteColor })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn('Image optimize note (uploading original):', err instanceof Error ? err.message : err);
    return input;
  }
}

async function makeSmallWebp(input: Buffer): Promise<Buffer | null> {
  try {
    const mod = await import('sharp').then((m: any) => m.default || m);
    return await mod(input)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
  } catch (err) {
    console.warn('Small variant note:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function readDimensions(input: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const sharpMod: any = await import('sharp').then((m: any) => m.default || m);
    const meta = await sharpMod(input).metadata();
    if (meta && meta.width && meta.height) return { width: meta.width, height: meta.height };
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawItems: UploadItemPayload[] = Array.isArray(body.items) ? body.items : [body];
    const items = rawItems.slice(0, MAX_BATCH_ITEMS);

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items to upload' }, { status: 400 });
    }

    const r2Ready = isR2Configured();
    const r2Config = getR2Config();
    const uploadedResults: any[] = [];
    const itemsToPersist: ThumbnailItem[] = [];
    const warnings: string[] = [];

    const CONCURRENCY = 4;
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (item) => {
        try {
          const isPoster = item.kind === 'poster' || item.id?.startsWith('poster-') || item.niche === 'Cinema';
          const vId = item.videoId || item.id?.replace(/^.*-/, '') || (isPoster ? 'poster' : 'thumb');
          const cleanTitle = (item.title || (isPoster ? 'poster' : 'thumb'))
            .replace(/[^a-zA-Z0-9_\-\s]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .slice(0, 40) || (isPoster ? 'poster' : 'thumb');
          const randSuffix = Math.random().toString(36).slice(2, 7);

          const storagePath = isPoster
            ? `posters/poster_${Date.now()}_${cleanTitle}_${randSuffix}.jpg`
            : sanitizeFilename(item.title || 'Thumbnail', vId);

          let finalPublicUrl = item.imageUrl;
          let thumbSmallUrl: string | null = null;
          let uploadSuccess = false;
          let colors: string[] = [];
          let colorFamilies: string[] = [];
          let dimensions: { width: number; height: number } | null = null;

          try {
            const imageResult = await fetchImageBuffer(item.imageUrl, item.videoId);

            if (imageResult) {
              const optimizedJpgBuffer = await optimizeBuffer(imageResult.buffer, isPoster);

              if (!isPoster) {
                const profile = await extractColorProfile(imageResult.buffer);
                colors = profile.colors;
                colorFamilies = profile.families;
              }

              dimensions = await readDimensions(imageResult.buffer);

              // Storage: Cloudflare R2
              if (r2Ready) {
                try {
                  const r2Result = await uploadToR2({
                    key: storagePath,
                    buffer: optimizedJpgBuffer,
                    contentType: 'image/jpeg',
                    cacheControl: 'public, max-age=31536000, immutable',
                  });
                  finalPublicUrl = r2Result.publicUrl;
                  uploadSuccess = true;

                  // Small WebP variant (400px wide)
                  try {
                    const small = await makeSmallWebp(imageResult.buffer);
                    if (small) {
                      const smallPath = `small/${storagePath.replace(/\.[^/.]+$/, '')}.webp`;
                      const r2SmallResult = await uploadToR2({
                        key: smallPath,
                        buffer: small,
                        contentType: 'image/webp',
                        cacheControl: 'public, max-age=31536000, immutable',
                      });
                      thumbSmallUrl = r2SmallResult.publicUrl;
                    }
                  } catch (smallErr) {
                    warnings.push(`R2 small variant for "${item.title || vId}": ${smallErr instanceof Error ? smallErr.message : String(smallErr)}`);
                  }
                } catch (r2Err) {
                  warnings.push(`Cloudflare R2 upload for "${item.title || vId}": ${r2Err instanceof Error ? r2Err.message : String(r2Err)}`);
                }
              }
            } else {
              warnings.push(`Could not fetch image bytes for "${item.title || vId}" — keeping source URL.`);
            }
          } catch (err) {
            warnings.push(`Storage upload error for "${item.title || vId}": ${err instanceof Error ? err.message : String(err)}`);
          }

          const assignedId = isPoster
            ? (item.id && item.id.startsWith('poster-') ? item.id : `poster-${Date.now()}-${randSuffix}`)
            : (item.id || (item.videoId ? `thumb-yt-${item.videoId}` : `thumb-r2-${vId}`));

          const viewsValue = item.views || item.viewsEstimate || null;
          const baseNote = isPoster ? 'Uploaded movie poster.' : (item.publishedTime ? `Published: ${item.publishedTime}` : '');
          const notes = withDimensions(baseNote, dimensions?.width, dimensions?.height);

          const record: ThumbnailItem = {
            id: assignedId,
            kind: isPoster ? 'poster' : 'thumbnail',
            title: item.title || (isPoster ? 'Movie Poster' : 'Thumbnail'),
            creator: item.creator || (isPoster ? 'Cinema' : 'YouTube Creator'),
            imageUrl: finalPublicUrl,
            sourceUrl: item.sourceUrl || finalPublicUrl,
            niche: isPoster ? 'Cinema' : (item.niche || ''),
            styles: (item.styles && item.styles.length > 0 ? item.styles : ['Face Close-up', 'High-Contrast Glow']) as any,
            tags: item.tags && item.tags.length > 0 ? item.tags : (isPoster ? ['Movie Poster', 'Cinema'] : (item.niche ? [item.niche] : [])),
            colors,
            thumbSmallUrl: thumbSmallUrl || undefined,
            width: dimensions?.width,
            height: dimensions?.height,
            viewsEstimate: viewsValue || undefined,
            breakdownNotes: notes,
            source: 'r2-storage' as const,
            createdAt: new Date().toISOString()
          };

          const cleanRecord = Object.fromEntries(
            Object.entries(record).filter(([, value]) => value !== undefined)
          ) as ThumbnailItem;

          itemsToPersist.push(cleanRecord);

          // Also attempt syncing to Firestore in background without blocking
          if (db) {
            try {
              const docRef = doc(db, 'thumbnails', assignedId);
              setDoc(docRef, cleanRecord, { merge: true }).catch(() => {});
            } catch {}
          }

          uploadedResults.push({
            id: assignedId,
            originalId: item.id,
            kind: isPoster ? 'poster' : 'thumbnail',
            videoId: item.videoId,
            title: record.title,
            creator: record.creator,
            sourceUrl: record.sourceUrl,
            niche: record.niche,
            tags: record.tags,
            views: item.views || item.viewsEstimate,
            publishedTime: item.publishedTime,
            source: 'r2-storage',
            uploadedToBucket: uploadSuccess,
            imageUrl: finalPublicUrl,
            thumbSmallUrl,
            colors,
            colorFamilies,
            width: dimensions?.width,
            height: dimensions?.height,
            dbSaved: true
          });
        } catch (itemErr) {
          warnings.push(`Item failed: ${itemErr instanceof Error ? itemErr.message : String(itemErr)}`);
        }
      }));
    }

    // Persist to server data/thumbnails.json
    if (itemsToPersist.length > 0) {
      await saveGalleryItems(itemsToPersist);
    }
    invalidateGalleryCache();

    return NextResponse.json({
      success: true,
      bucket: r2Ready ? r2Config.bucketName : 'local-storage',
      storageProvider: r2Ready ? 'cloudflare-r2' : 'server-storage',
      count: uploadedResults.length,
      allDbSaved: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      items: uploadedResults
    });
  } catch (err: any) {
    console.error('Upload thumbnail handler error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
