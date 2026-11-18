import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function disabled() {
  return NextResponse.json({ disabled: true, message: 'Notificações push desativadas.' }, { status: 410 });
}

export async function GET() { return disabled(); }
export async function POST() { return disabled(); }
export async function DELETE() { return disabled(); }
