import json
from pathlib import Path
from typing import Optional, Dict
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = PROJECT_ROOT / "uploads"
DB_PATH = UPLOAD_DIR / "metadata.json"

# Ensure directory exists
UPLOAD_DIR.mkdir(exist_ok=True)


def _load_db() -> Dict:
    if DB_PATH.exists():
        try:
            data = json.loads(DB_PATH.read_text())
            print(f"Loaded DB: {data}")
            return data
        except Exception as e:
            print(f"Error loading DB: {str(e)}")
            return {"videos": {}}
    print("DB file does not exist, creating new one")
    return {"videos": {}}


def _save_db(db: Dict) -> None:
    DB_PATH.write_text(json.dumps(db, indent=2))


def save_video_mapping(local_video_id: str, index_id: str, task_id: str, twelve_labs_video_id: str) -> None:
    """Save mapping of local video ID to TwelveLabs IDs."""
    try:
        print(f"Saving video mapping...")
        print(f"Local video ID: {local_video_id}")
        print(f"Index ID: {index_id}")
        print(f"Task ID: {task_id}")
        print(f"TwelveLabs video ID: {twelve_labs_video_id}")
        
        # Load existing data
        data = _load_db()
        
        # Check if we already have a record with a non-null video_id
        existing_record = data['videos'].get(local_video_id, {})
        existing_video_id = existing_record.get('twelve_labs_video_id')
        
        # Don't overwrite existing non-null video_id with None
        if existing_video_id and twelve_labs_video_id is None:
            print(f"Keeping existing video_id: {existing_video_id} instead of overwriting with None")
            twelve_labs_video_id = existing_video_id
        
        # Add new mapping
        data['videos'][local_video_id] = {
            'index_id': index_id,
            'task_id': task_id,
            'twelve_labs_video_id': twelve_labs_video_id,
            'created_at': datetime.now().isoformat()
        }
        
        # Save updated data
        _save_db(data)
        print("Saved video mapping successfully")
        
    except Exception as e:
        print(f"Error saving video mapping: {str(e)}")


def get_index_id(video_id: str) -> Optional[str]:
    try:
        data = _load_db()
        print(f"Loaded DB: {data}")
        
        if video_id in data['videos']:
            record = data['videos'][video_id]
            print(f"Found record: {record}")
            return record['index_id']
            
        return None
        
    except Exception as e:
        print(f"Error getting index ID: {str(e)}")
        return None


def get_task_id(video_id: str) -> Optional[str]:
    """Get task ID for a video."""
    try:
        data = _load_db()
        print(f"Loaded DB: {data}")
        
        if video_id in data['videos']:
            record = data['videos'][video_id]
            print(f"Found record: {record}")
            return record['task_id']
            
        return None
        
    except Exception as e:
        print(f"Error getting task ID: {str(e)}")
        return None


def _clean_transcript_data(data: Dict) -> Dict:
    """Remove raw transcript from cached data."""
    if isinstance(data, dict):
        if 'raw_transcript' in data:
            del data['raw_transcript']
    return data

def save_transcript(local_video_id: str, transcript_data: Dict) -> None:
    """Save transcript data to local storage."""
    try:
        data = _load_db()
        if 'transcripts' not in data:
            data['transcripts'] = {}
            
        # Clean transcript data before saving
        cleaned_data = _clean_transcript_data(transcript_data)
        data['transcripts'][local_video_id] = {
            'timestamp': datetime.now().isoformat(),
            'data': cleaned_data
        }
        _save_db(data)
        print(f"Cached transcript for {local_video_id}")
        
    except Exception as e:
        print(f"Error saving transcript: {str(e)}")
        raise

def get_cached_transcript(local_video_id: str) -> Optional[Dict]:
    """Get cached transcript data if available."""
    try:
        data = _load_db()
        if 'transcripts' not in data:
            return None
            
        transcript = data['transcripts'].get(local_video_id)
        if transcript:
            print(f"Found cached transcript for {local_video_id} from {transcript['timestamp']}")
            # Clean any old cached data
            return _clean_transcript_data(transcript['data'])
            
        return None
        
    except Exception as e:
        print(f"Error getting cached transcript: {str(e)}")
        return None

def get_twelve_labs_video_id(local_video_id: str) -> Optional[str]:
    """Get TwelveLabs video ID for a video."""
    try:
        data = _load_db()
        print(f"Looking up TwelveLabs video ID for local ID: {local_video_id}")
        
        if local_video_id in data['videos']:
            record = data['videos'][local_video_id]
            twelve_labs_id = record.get('twelve_labs_video_id')
            print(f"Found TwelveLabs video ID: {twelve_labs_id}")
            return twelve_labs_id
            
        print("No record found")
        return None
        
    except Exception as e:
        print(f"Error getting TwelveLabs video ID: {str(e)}")
        return None
