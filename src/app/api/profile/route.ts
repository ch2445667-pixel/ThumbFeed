import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface UserProfile {
  name: string;
  photoURL: string;
  updatedAt?: string;
}

const PROFILE_FILE_PATH = path.join(process.cwd(), 'data', 'user-profile.json');

function ensureDataDir() {
  const dir = path.dirname(PROFILE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function GET() {
  try {
    ensureDataDir();
    if (!fs.existsSync(PROFILE_FILE_PATH)) {
      return NextResponse.json({ name: '', photoURL: '' });
    }
    const content = fs.readFileSync(PROFILE_FILE_PATH, 'utf-8');
    const profile: UserProfile = JSON.parse(content);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to read user-profile.json:', error);
    return NextResponse.json({ name: '', photoURL: '' });
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureDataDir();
    const body = await req.json();
    const profile: UserProfile = {
      name: typeof body.name === 'string' ? body.name.trim() : '',
      photoURL: typeof body.photoURL === 'string' ? body.photoURL.trim() : '',
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(PROFILE_FILE_PATH, JSON.stringify(profile, null, 2), 'utf-8');
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Failed to write user-profile.json:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save profile' },
      { status: 500 }
    );
  }
}
