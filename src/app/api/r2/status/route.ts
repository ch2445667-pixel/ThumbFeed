import { NextResponse } from 'next/server';
import { isR2Configured, testR2Connection, getR2Config } from '../../../../lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getR2Config();
  if (!config.isConfigured) {
    return NextResponse.json({
      configured: false,
      storage: 'cloudflare-r2',
      message: 'Cloudflare R2 is not configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET_NAME.',
      requiredEnvVars: [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET_NAME',
        'R2_PUBLIC_URL',
      ],
      missing: [
        !config.accountId && 'R2_ACCOUNT_ID',
        !config.accessKeyId && 'R2_ACCESS_KEY_ID',
        !config.secretAccessKey && 'R2_SECRET_ACCESS_KEY',
        !config.bucketName && 'R2_BUCKET_NAME',
      ].filter(Boolean),
    });
  }

  const testResult = await testR2Connection();
  return NextResponse.json({
    configured: true,
    storage: 'cloudflare-r2',
    bucket: config.bucketName,
    publicUrl: config.publicUrlBase || 'Internal media proxy (/api/media/*)',
    connection: testResult,
  });
}
