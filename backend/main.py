from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
import os
import uuid
from twelve_labs import TwelveLabs
from storage import save_video_mapping, get_index_id
from typing import Dict
import asyncio

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/upload")
async def upload_video(file: UploadFile = File(...), *, background_tasks: BackgroundTasks):
    try:
        # Validate file type (accept CLI uploads without explicit type; fallback to extension)
        content_type = file.content_type or ""
        ext = os.path.splitext(file.filename)[1].lower()
        allowed_exts = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
        if not (content_type.startswith("video/") or ext in allowed_exts):
            raise HTTPException(status_code=400, detail="File must be a video")
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{str(uuid.uuid4())}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save the file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initialize TwelveLabs in background
        background_tasks.add_task(
            initialize_video_processing,
            str(file_path),
            unique_filename
        )
        
        return {
            "video_id": unique_filename,
            "status": "success",
            "message": "Video uploaded successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def initialize_video_processing(video_path: str, video_id: str):
    """Initialize video processing with TwelveLabs."""
    try:
        print(f"Starting processing for video {video_id} at path {video_path}")
        twelve_labs = TwelveLabs()
        
        # Upload video to existing index
        result = await twelve_labs.create_index(video_path, video_id)
        
        if not result or not result.get('task_id') or not result.get('index_id'):
            raise ValueError(f"Invalid result from TwelveLabs: {result}")
            
        print(f"Video processing initialized - task_id: {result['task_id']}, index_id: {result['index_id']}, twelve_labs_video_id: {result.get('twelve_labs_video_id')}")
        return result
    except Exception as e:
        print(f"Error processing video {video_id}: {str(e)}")
        raise

@app.get("/status/{video_id}")
async def get_video_status(video_id: str):
    """Get the processing status of a video"""
    try:
        twelve_labs = TwelveLabs()
        status = await twelve_labs.get_index_status(video_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/transcript/{file_id}")
async def get_video_transcript(file_id: str):
    """Get the transcript of a processed video.
    
    Parameters:
    - file_id: The local filename of the uploaded video (e.g., 'ebada785-980e-4a28-8065-1f09e64aaa53.mp4')
    
    Returns:
    - The transcript if the video is processed and transcript is available
    - 404 if video is not found
    - 409 if video is still processing
    - 500 for other errors
    """
    try:
        twelve_labs = TwelveLabs()
        result = await twelve_labs.get_transcript(file_id)
        
        if result["status"] == "not_found":
            raise HTTPException(status_code=404, detail="Video not found")
        elif result["status"] == "not_ready":
            raise HTTPException(status_code=409, detail="Video is still processing")
        elif result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
