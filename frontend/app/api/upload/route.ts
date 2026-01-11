import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const backendBase = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:8000';
    const form = new FormData();
    form.append('file', file, file.name);

    const res = await fetch(`${backendBase}/upload`, {
      method: 'POST',
      body: form,
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: payload?.detail ?? payload?.message ?? 'Upload failed' },
        { status: res.status }
      );
    }

    // FastAPI returns: { video_id, status: "success", message }
    return NextResponse.json({
      success: true,
      video_id: payload?.video_id,
      status: payload?.status,
      message: payload?.message,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
