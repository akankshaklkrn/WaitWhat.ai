import os
import httpx
from dotenv import load_dotenv
from pathlib import Path
import json
import time
from typing import Dict, Optional
from twelvelabs import TwelveLabs as TwelveLabsSDK
import asyncio

from storage import (get_task_id, save_video_mapping, get_twelve_labs_video_id,
                  save_transcript, get_cached_transcript)

load_dotenv()

class TwelveLabs:
    def __init__(self):
        self.api_key = os.getenv("TWELVE_LABS_API_KEY")
        self.index_id = os.getenv("TWELVE_LABS_INDEX_ID")
        if not self.api_key:
            raise ValueError("TWELVE_LABS_API_KEY environment variable is not set")
        if not self.index_id:
            raise ValueError("TWELVE_LABS_INDEX_ID environment variable is not set")
        self.client = TwelveLabsSDK(api_key=self.api_key)
        print(f"Initialized TwelveLabs client with API key: {self.api_key[:8]}...")
    
    async def create_index(self, video_path: str, local_video_id: str) -> Dict:
        """Upload video to existing TwelveLabs index."""
        try:
            print(f"Starting video upload for {local_video_id} to index {self.index_id}")
            print(f"Video path: {video_path}")
            
            # Upload the video using tasks API
            print("Opening video file...")
            with open(video_path, 'rb') as video_file:
                print("Creating task...")
                # Open the file in binary mode for upload
                video_file.seek(0)
                task = self.client.tasks.create(
                    index_id=self.index_id,
                    video_file=video_file
                )
                print(f"Created task with ID: {task.id}")
                print(f"Task object: {task.__dict__}")
            
            # Get video_id from task
            print("Listing tasks to find video_id...")
            tasks = self.client.tasks.list(index_id=self.index_id)
            task_info = next((t for t in tasks if t.id == task.id), None)
            
            if task_info:
                print(f"Found task info: {task_info.__dict__}")
                twelve_labs_video_id = task_info.video_id
                print(f"Found TwelveLabs video_id: {twelve_labs_video_id}")
            else:
                print("Could not find task info!")
                twelve_labs_video_id = None
            
            # Save mapping with video_id
            print(f"Saving mapping - local_id: {local_video_id}, index_id: {self.index_id}, task_id: {task.id}, video_id: {twelve_labs_video_id}")
            save_video_mapping(local_video_id, self.index_id, task.id, twelve_labs_video_id)
            
            return {
                "status": "success",
                "task_id": task.id,
                "twelve_labs_video_id": twelve_labs_video_id,
                "index_id": self.index_id
            }
        except Exception as e:
            print(f"Error uploading video: {str(e)}")
            raise
    
    async def get_index_status(self, video_id: str) -> Dict:
        """Get the status of a video upload task."""
        try:
            print(f"Getting task ID for video: {video_id}")
            task_id = get_task_id(video_id)
            if not task_id:
                print(f"No task ID found for video: {video_id}")
                return {"status": "not_found", "index_id": self.index_id}
            
            print(f"Found task ID: {task_id}, getting tasks for index: {self.index_id}")
            tasks = self.client.tasks.list(index_id=self.index_id)
            
            # Find specific task
            task = next((t for t in tasks if t.id == task_id), None)
            if task:
                print(f"Found task: {task.id} with status: {task.status}")
                return {
                    "task_id": task.id,
                    "status": task.status,
                    "index_id": self.index_id
                }
            
            print(f"Task {task_id} not found in active tasks, assuming ready")
            return {"status": "ready", "index_id": self.index_id, "task_id": task_id}
        except Exception as e:
            print(f"Error getting status: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    async def analyze_transcript(self, task_id: str) -> Dict:
        """Get transcript using the analyze endpoint."""
        try:
            # Make POST request to analyze endpoint
            url = f"https://api.twelvelabs.io/v1.1/tasks/{task_id}/analyze/transcript"
            headers = {
                "accept": "application/json",
                "Content-Type": "application/json",
                "x-api-key": self.api_key
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                return {
                    "status": "success",
                    "transcript": data.get("data", {}).get("text", []),
                    "task_id": task_id
                }
        except Exception as e:
            print(f"Error analyzing transcript: {str(e)}")
            return {"status": "error", "message": str(e)}

    def _normalize_text(self, text: str) -> str:
        """Normalize transcript text by fixing spaces and formatting."""
        # Fix currency and numbers
        text = text.replace(" ,", ",")
        text = text.replace("$ ", "$")
        
        # Fix percentages
        text = text.replace(" %", "%")
        
        # Remove double spaces
        while "  " in text:
            text = text.replace("  ", " ")
            
        return text.strip()
    
    async def get_transcript(self, file_id: str) -> Dict:
        """Get the transcript for an indexed video using the v1.3 indexed-assets endpoint."""
        try:
            # Check cache first
            cached = get_cached_transcript(file_id)
            if cached:
                return cached

            # Get TwelveLabs video ID (asset ID)
            asset_id = get_twelve_labs_video_id(file_id)
            if not asset_id:
                return {"status": "not_found", "message": "Video not found or video_id not stored"}

            # Get video status
            status = await self.get_index_status(file_id)
            if status.get('status') != 'ready':
                return {"status": "not_ready", "message": "Video is still processing"}

            # Get transcript using indexed-assets endpoint
            print(f"Getting transcript for asset: {asset_id}")
            url = f"https://api.twelvelabs.io/v1.3/indexes/{self.index_id}/indexed-assets/{asset_id}"
            headers = {
                "accept": "application/json",
                "x-api-key": self.api_key
            }
            params = {"transcription": "true"}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                data = response.json()
                
                if not data.get('transcription'):
                    return {"status": "no_transcript", "message": "No transcript available"}
                
                # Process transcript into 5-second chunks
                raw_transcript = data.get('transcription', [])
                chunks = []
                current_chunk = {
                    "start": 0,
                    "end": 5,
                    "words": []
                }
                
                for word in raw_transcript:
                    word_start = float(word['start'])
                    chunk_index = int(word_start // 5)
                    chunk_start = chunk_index * 5
                    chunk_end = chunk_start + 5
                    
                    if word_start >= current_chunk['end']:
                        if current_chunk['words']:
                            # Join words with proper spacing
                            text = "".join([
                                w["value"] + ("" if w["value"] in [".", ",", "!", "?"] else " ")
                                for w in current_chunk['words']
                            ]).strip()
                            text = self._normalize_text(text)
                            chunk_id = f"{asset_id}_{current_chunk['start']}_{current_chunk['end']}"
                            chunks.append({
                                "chunk_id": chunk_id,
                                "start": current_chunk['start'],
                                "end": current_chunk['end'],
                                "text": text
                            })
                        current_chunk = {
                            "start": chunk_start,
                            "end": chunk_end,
                            "words": [word]
                        }
                    else:
                        current_chunk['words'].append(word)
                
                # Add the last chunk if it has words
                if current_chunk['words']:
                    text = "".join([
                        w["value"] + ("" if w["value"] in [".", ",", "!", "?"] else " ")
                        for w in current_chunk['words']
                    ]).strip()
                    chunks.append({
                        "start": current_chunk['start'],
                        "end": current_chunk['end'],
                        "text": text
                    })
                
                # Create full text version
                full_text = " ".join([chunk["text"] for chunk in chunks])
                    
                result = {
                    "status": "success",
                    "chunks": chunks,  # 5-second segments with text
                    "text": self._normalize_text(full_text),  # Complete normalized text
                    "index_id": self.index_id,
                    "asset_id": asset_id,
                    "file_id": file_id
                }
                
                # Cache the result
                save_transcript(file_id, result)
                
                return result

        except Exception as e:
            print(f"Error getting transcript: {str(e)}")
            return {"status": "error", "message": str(e)}

    async def wait_for_index_completion(self, index_id: str, max_retries: int = 30, delay: int = 10) -> bool:
        """Wait for video indexing to complete."""
        for _ in range(max_retries):
            status = await self.get_index_status(index_id)
            if status["status"] == "ready":
                return True
            elif status["status"] == "failed":
                raise Exception("Indexing failed")
            await asyncio.sleep(delay)
        raise Exception("Indexing timed out")
