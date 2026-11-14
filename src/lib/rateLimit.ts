import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

interface BucketRecord {
  count: number;
  resetAt: number;
}

const DEFAULT_RATE_LIMIT_FILE = path.join(process.cwd(), 'data', 'rate-limits.json');

let memoryFallback = new Map<string, BucketRecord>();
let writeChain: Promise<void> = Promise.resolve();

function readStore(filePath: string): Record<string, BucketRecord> {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, BucketRecord>) : {};
  } catch {
    return {};
  }
}

function writeStore(filePath: string, data: Record<string, BucketRecord>): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch {
    // Fall back to memory only if filesystem is read-only
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  filePath?: string;
  nowMs?: number;
}): Promise<RateLimitResult> {
  const filePath = params.filePath ?? DEFAULT_RATE_LIMIT_FILE;
  const now = params.nowMs ?? Date.now();

  let result: RateLimitResult = {
    allowed: true,
    remaining: Math.max(0, params.limit - 1),
    retryAfterSeconds: 0,
  };

  writeChain = writeChain.then(() => {
    const store = readStore(filePath);

    // Prune expired buckets opportunistically
    for (const [k, rec] of Object.entries(store)) {
      if (!rec || typeof rec.resetAt !== 'number' || rec.resetAt <= now) {
        delete store[k];
      }
    }

    const existing = store[params.key] ?? memoryFallback.get(params.key);
    let record: BucketRecord;

    if (!existing || existing.resetAt <= now) {
      record = { count: 1, resetAt: now + params.windowMs };
      store[params.key] = record;
      memoryFallback.set(params.key, record);
      writeStore(filePath, store);
      result = {
        allowed: true,
        remaining: Math.max(0, params.limit - 1),
        retryAfterSeconds: 0,
      };
      return;
    }

    if (existing.count >= params.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      result = {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
      return;
    }

    record = { count: existing.count + 1, resetAt: existing.resetAt };
    store[params.key] = record;
    memoryFallback.set(params.key, record);
    writeStore(filePath, store);

    result = {
      allowed: true,
      remaining: Math.max(0, params.limit - record.count),
      retryAfterSeconds: 0,
    };
  });

  await writeChain;
  return result;
}

export function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfterSeconds)),
      },
    }
  );
}
