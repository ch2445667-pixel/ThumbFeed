import { NextRequest, NextResponse } from 'next/server';
import { testR2Connection, saveR2Config } from '../../../../lib/r2';
import {
  isSafeExternalHttpUrl,
  isValidR2AccountId,
  isValidR2BucketName,
} from '../../../../lib/urlSafety';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = body;

    if (
      typeof accountId !== 'string' ||
      typeof accessKeyId !== 'string' ||
      typeof secretAccessKey !== 'string' ||
      typeof bucketName !== 'string' ||
      !accountId.trim() ||
      !accessKeyId.trim() ||
      !secretAccessKey.trim() ||
      !bucketName.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: accountId, accessKeyId, secretAccessKey, and bucketName are all required.',
        },
        { status: 400 }
      );
    }

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

    if (typeof publicUrl === 'string' && publicUrl.trim() && !isSafeExternalHttpUrl(publicUrl)) {
      return NextResponse.json(
        { success: false, error: 'Public URL must be a valid external http(s) URL.' },
        { status: 400 }
      );
    }

    // Test connection with Cloudflare R2
    const testResult = await testR2Connection({
      accountId: accountId.trim(),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
      bucketName: bucketName.trim(),
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

    // Save configuration
    const saved = saveR2Config({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrlBase: publicUrl,
    });

    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Failed to write configuration file on server.' },
        { status: 500 }
      );
    }

    // Immediately pull down all thumbnails, boards, categories, and user profile from R2!
    let syncStats = {
      thumbnailsCount: 0,
      boardsCount: 0,
      categoriesCount: 0,
      profileSynced: false,
    };
    try {
      const { performFullR2Sync } = await import('@/lib/r2Sync');
      const syncResult = await performFullR2Sync();
      syncStats = {
        thumbnailsCount: syncResult.thumbnailsCount,
        boardsCount: syncResult.boardsCount,
        categoriesCount: syncResult.categoriesCount,
        profileSynced: !!syncResult.profileSynced,
      };
    } catch (syncErr) {
      console.warn('Initial sync warning after connect:', syncErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully connected to Cloudflare R2! Synced ${syncStats.thumbnailsCount} thumbnails, ${syncStats.boardsCount} boards, and profile from bucket "${bucketName.trim()}".`,
      config: {
        accountId: accountId.trim(),
        bucketName: bucketName.trim(),
        isConfigured: true,
      },
      synced: syncStats,
    });
  } catch (err: any) {
    console.error('R2 connect route error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while connecting to Cloudflare R2' },
      { status: 500 }
    );
  }
}
