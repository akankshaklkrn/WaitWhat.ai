import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Path to the uploaded video in the uploads folder
    const videoPath = join(process.cwd(), '..', 'uploads', filename);

    // Check if file exists
    if (!existsSync(videoPath)) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    // Get file stats
    const fileStat = await stat(videoPath);
    const fileBuffer = await readFile(videoPath);

    // Determine content type based on file extension
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'video/mp4';
    
    if (ext === 'webm') contentType = 'video/webm';
    else if (ext === 'ogg') contentType = 'video/ogg';
    else if (ext === 'mov') contentType = 'video/quicktime';
    else if (ext === 'avi') contentType = 'video/x-msvideo';

    // Return video file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Error serving video:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load video' },
      { status: 500 }
    );
  }
}
