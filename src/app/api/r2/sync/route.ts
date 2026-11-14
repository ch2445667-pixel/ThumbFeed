import { NextRequest, NextResponse } from 'next/server';
import { performFullR2Sync } from '@/lib/r2Sync';
import {
  requireAdmin,
  verifyCsrfAndJson,
  getClientIp,
  logSecurityEvent,
  safeErrorResponse,
} from '@/lib/serverAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const csrfError = verifyCsrfAndJson(req, { requireJson: false });
    if (csrfError) return csrfError;

    const authResult = await requireAdmin(req);
    if ('errorResponse' in authResult) return authResult.errorResponse;

    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `r2-sync:${authResult.user.uid}:${ip}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      logSecurityEvent('rate_limit_exceeded', { endpoint: '/api/r2/sync', uid: authResult.user.uid, ip });
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    const result = await performFullR2Sync(authResult.user.uid);
    logSecurityEvent('r2_sync_triggered', {
      uid: authResult.user.uid,
      thumbnailsCount: result.thumbnailsCount,
      ip,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    return safeErrorResponse(err, 'Cloud storage synchronization failed');
  }
}
