import { NextRequest, NextResponse } from 'next/server';
import { testR2Connection, getR2Config } from '../../../../lib/r2';
import { requireAdmin } from '../../../../lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ('errorResponse' in authResult) return authResult.errorResponse;

  const config = getR2Config();
  if (!config.isConfigured) {
    return NextResponse.json({
      configured: false,
      storage: 'cloudflare-r2',
      message: 'Cloudflare R2 storage is not configured yet.',
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
