import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file_id: string }> }
) {
  const { file_id } = await params;
  const backendBase = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:8000';

  const res = await fetch(`${backendBase}/transcript/${encodeURIComponent(file_id)}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { status: 'error' }, { status: res.status });
}

