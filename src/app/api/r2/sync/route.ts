import { NextResponse } from 'next/server';
import { performFullR2Sync } from '@/lib/r2Sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await performFullR2Sync();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('R2 full sync error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
