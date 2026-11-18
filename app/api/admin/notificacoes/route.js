import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ disabled: true, message: 'Notificações administrativas desativadas.' }, { status: 410 });
}
