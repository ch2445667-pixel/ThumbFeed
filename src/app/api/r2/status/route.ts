import { NextResponse } from 'next/server';
import { isR2Configured, testR2Connection } from '../../../../lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = isR2Configured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      message: 'Cloudflare R2 is not configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET_NAME.',
      requiredEnvVars: [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET_NAME',
        'R2_PUBLIC_URL',
      ],
    });
  }

  const testResult = await testR2Connection();
  return NextResponse.json({
    configured: true,
    bucket: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL || 'Not specified',
    connection: testResult,
  });
}
