import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { testR2Connection, saveR2Config } from '../../../../lib/r2';
import {
  isSafeExternalHttpUrl,
  isValidR2AccountId,
  isValidR2BucketName,
} from '../../../../lib/urlSafety';
import {
  requireAdmin,
  verifyCsrfAndJson,
  getClientIp,
  logSecurityEvent,
  safeErrorResponse,
} from '../../../../lib/serverAuth';
import { checkRateLimit, rateLimitResponse } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const connectSchema = z.object({
  accountId: z.string().trim().min(8).max(64),
  accessKeyId: z.string().trim().min(8).max(200),
  secretAccessKey: z.string().trim().min(16).max(256),
  bucketName: z.string().trim().min(3).max(63),
  publicUrl: z.string().trim().max(512).optional().default(''),
});

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req);
    if (csrfError) return csrfError;

    const authResult = await requireAdmin(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `r2-connect:${authResult.user.uid}:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/r2/connect', uid: authResult.user.uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = connectSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Cloudflare R2 configuration fields.' },
        { status: 400 }
      );
    }

    const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = parsed.data;

    if (!isValidR2AccountId(accountId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Cloudflare Account ID format.' },
        { status: 400 }
      );
    }

    if (!isValidR2BucketName(bucketName)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Cloudflare R2 Bucket Name format.' },
        { status: 400 }
      );
    }

    if (publicUrl && !isSafeExternalHttpUrl(publicUrl)) {
      return NextResponse.json(
        { success: false, error: 'Public URL must be a valid external http(s) URL.' },
        { status: 400 }
      );
    }

    const testResult = await testR2Connection({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
    });

    if (!testResult.ok) {
      return NextResponse.json(
        {
          success: false,
          error: testResult.message || 'Could not connect to Cloudflare R2 with the provided credentials.',
        },
        { status: 400 }
      );
    }

    const saved = saveR2Config({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrlBase: publicUrl,
    });

    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Failed to save configuration on server.' },
        { status: 500 }
      );
    }

    let syncStats = {
      thumbnailsCount: 0,
      boardsCount: 0,
      categoriesCount: 0,
      profileSynced: false,
    };
    try {
      const { performFullR2Sync } = await import('@/lib/r2Sync');
      const syncResult = await performFullR2Sync(authResult.user.uid);
      syncStats = {
        thumbnailsCount: syncResult.thumbnailsCount,
        boardsCount: syncResult.boardsCount,
        categoriesCount: syncResult.categoriesCount,
        profileSynced: !!syncResult.profileSynced,
      };
    } catch (syncErr) {
      console.warn('Initial sync warning after connect:', syncErr);
    }

    logSecurityEvent('r2_connected', {
      uid: authResult.user.uid,
      bucketName,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully connected to Cloudflare R2! Synced ${syncStats.thumbnailsCount} thumbnails from bucket "${bucketName}".`,
      config: {
        accountId,
        bucketName,
        isConfigured: true,
      },
      synced: syncStats,
    });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Failed to connect to Cloudflare R2');
  }
}
