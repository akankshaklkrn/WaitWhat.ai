export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    video_id?: string;
  };

  if (!body?.video_id) {
    return Response.json({ success: false, error: 'Missing video_id' }, { status: 400 });
  }

  const backendBase = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:8000';
  const res = await fetch(`${backendBase}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: body.video_id }),
    cache: 'no-store',
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    return Response.json(
      { success: false, error: payload?.detail ?? payload?.message ?? 'Analyze failed' },
      { status: res.status }
    );
  }

  return Response.json({ success: true, analysis: payload }, { status: 200 });
}

