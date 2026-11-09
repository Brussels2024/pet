import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  await destroySession();
  return NextResponse.redirect(new URL('/', request.url), 303);
}
