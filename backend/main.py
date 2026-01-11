from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
import os
import uuid
from typing import Dict, List
import asyncio
import time

# Load environment variables FIRST!
from dotenv import load_dotenv
from pathlib import Path

# Load .env from the same directory as this file (backend/)
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
print(f"✅ Loaded .env from: {env_path}")

from twelve_labs import TwelveLabs
from storage import save_video_mapping, get_index_id

# Person B's LLM Tools
from llm_tools import LLMTools
from signal_helpers import SignalHelpers
from pydantic import BaseModel

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist (shared at WaitWhat.ai/uploads)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = PROJECT_ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Initialize Person B's LLM Tools
llm_tools = LLMTools()

# Cache for analysis results
analysis_cache = {}

# Pydantic models
class AnalyzeRequest(BaseModel):
    video_id: str

class IssueSegment(BaseModel):
    segment_id: int
    start_sec: float
    end_sec: float
    risk: float
    severity: str
    signals_triggered: List[str]
    label: str
    evidence: Dict
    fix: str
    tone: Dict[str, str]

class AnalysisResponse(BaseModel):
    run_id: str
    video_id: str
    video_title: str
    clarity_score: int
    clarity_tier: str
    segments: List[IssueSegment]

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


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_video(request: AnalyzeRequest):
    """
    Analyze video clarity using Person B's LLM tools
    
    Combines Person A's TwelveLabs transcript with Person B's AI analysis
    """
    try:
        video_id = request.video_id
        
        # Check cache first
        if video_id in analysis_cache:
            print(f"✅ Returning cached analysis for {video_id}")
            return analysis_cache[video_id]
        
        print(f"🔄 Analyzing video {video_id}...")
        
        # Step 1: Get transcript from TwelveLabs (Person A's code)
        twelve_labs = TwelveLabs()
        transcript_result = await twelve_labs.get_transcript(video_id)
        
        if transcript_result["status"] != "success":
            raise HTTPException(status_code=400, detail=f"Transcript not available: {transcript_result.get('message')}")
        
        # Use TwelveLabs 5-second chunks directly as windows
        chunks = transcript_result.get("chunks", [])
        windows = []
        
        for i, chunk in enumerate(chunks):
            windows.append({
                "window_id": i,
                "start_sec": float(chunk["start"]),
                "end_sec": float(chunk["end"]),
                "text": chunk["text"].strip()
            })
        
        # Step 2: Analyze with Person B's LLM tools
        analyzed_windows = []
        term_tracker = {}
        role_sequence = []
        
        for window in windows:
            window_id = window['window_id']
            text = window['text']
            
            # Person B's LLM analysis
            terms_result = llm_tools.extract_terms(text)
            claims_result = llm_tools.classify_claims_evidence(text)
            role_result = llm_tools.role_tag(text)
            ramble_result = SignalHelpers.analyze_ramble(text)
            
            # Track terms for grounding gap
            for term in terms_result.terms:
                if term not in term_tracker:
                    is_defined = llm_tools.check_term_definition(term, text)
                    term_tracker[term] = {
                        "first_use": window_id,
                        "defined": is_defined
                    }
            
            # Track roles for structure analysis
            role_sequence.append((window_id, role_result.role))
            
            analyzed_windows.append({
                "window": window,
                "terms": terms_result,
                "claims": claims_result,
                "role": role_result,
                "ramble": ramble_result
            })
            
            # Small delay to avoid hitting API rate limits
            time.sleep(0.5)  # 500ms delay between windows
        
        # Step 2.5: Check structure order violations (Signal 5)
        print(f"🔍 Checking structure order for {len(role_sequence)} segments...")
        print(f"   Role sequence: {[(w_id, role) for w_id, role in role_sequence]}")
        structure_severity, structure_violations = SignalHelpers.check_structure_violations(role_sequence)
        
        # Identify which windows are involved in violations
        violation_window_ids = set()
        if structure_violations:
            print(f"⚠️ Structure violations detected (severity {structure_severity}):")
            for v in structure_violations:
                print(f"   - {v}")
            # Mark all windows with problematic roles
            role_positions = {}
            for window_id, role in role_sequence:
                if role not in role_positions:
                    role_positions[role] = window_id
            
            # Add windows involved in violations
            for violation in structure_violations:
                if "demo" in violation.lower():
                    if "demo" in role_positions:
                        violation_window_ids.add(role_positions["demo"])
                if "solution" in violation.lower() and "Solution presented before" in violation:
                    if "solution" in role_positions:
                        violation_window_ids.add(role_positions["solution"])
                if "architecture" in violation.lower():
                    if "architecture" in role_positions:
                        violation_window_ids.add(role_positions["architecture"])
                if "metrics" in violation.lower():
                    if "metrics" in role_positions:
                        violation_window_ids.add(role_positions["metrics"])
        
        # Step 3: Detect issues
        issues = []
        total_risk = 0.0
        
        for analysis in analyzed_windows:
            window = analysis['window']
            terms = analysis['terms']
            claims = analysis['claims']
            ramble = analysis['ramble']
            
            # Compute signal severities
            severities = {}
            triggered_signals = []
            
            # Signal 1: Concept spike
            num_terms = len(terms.terms)
            if num_terms >= 4:
                severities["concept_spike"] = 2
                triggered_signals.append("concept_spike")
            elif num_terms >= 3:
                severities["concept_spike"] = 1
                triggered_signals.append("concept_spike")
            else:
                severities["concept_spike"] = 0
            
            # Signal 2: Grounding gap
            ungrounded = [t for t in terms.terms 
                         if t in term_tracker and not term_tracker[t]["defined"]]
            severities["grounding_gap"] = SignalHelpers.compute_grounding_gap_severity(ungrounded)
            if severities["grounding_gap"] > 0:
                triggered_signals.append("grounding_gap")
            
            # Signal 3: Trust-me-bro
            severities["tmb"] = SignalHelpers.compute_tmb_severity(
                claims.claims, 
                claims.evidence
            )
            if severities["tmb"] > 0:
                triggered_signals.append("tmb")
            
            # Signal 6: Ramble
            severities["ramble_ratio"] = ramble.severity
            if ramble.severity > 0:
                triggered_signals.append("ramble_ratio")
            
            # Signal 5: Structure order violations
            # Apply structure violation severity to involved windows
            if window['window_id'] in violation_window_ids:
                severities["structure_order"] = structure_severity
                triggered_signals.append("structure_order")
            else:
                severities["structure_order"] = 0
            
            # Compute risk score
            risk = SignalHelpers.compute_risk_score(severities)
            total_risk += risk
            
            # Flag if high risk
            should_flag = SignalHelpers.should_flag_as_issue(risk, severities, risk_threshold=4.0)
            
            if should_flag and len(triggered_signals) > 0:
                # Generate label and fix
                # Include structure violations in the context if this window is involved
                additional_context = ""
                if "structure_order" in triggered_signals and structure_violations:
                    additional_context = f" Structure issues: {'; '.join(structure_violations)}"
                
                label_fix = llm_tools.label_and_fix(
                    window['text'] + additional_context,
                    triggered_signals,
                    terms.terms
                )
                
                # Generate roast variants with personalized context
                roast = llm_tools.roast_variants(
                    label_fix.label,
                    label_fix.explanation,
                    label_fix.fix,
                    transcript_excerpt=window['text'],
                    signals=triggered_signals
                )
                
                # Create issue
                evidence_dict = {
                    "transcript_excerpt": window['text'],
                    "terms": terms.terms,
                    "claims": claims.claims,
                    "visual_alignment": 0.5
                }
                
                # Add structure violations to evidence if relevant
                if "structure_order" in triggered_signals:
                    evidence_dict["structure_violations"] = structure_violations
                    evidence_dict["segment_role"] = analysis['role'].role
                
                issue = IssueSegment(
                    segment_id=window['window_id'],
                    start_sec=window['start_sec'],
                    end_sec=window['end_sec'],
                    risk=risk,
                    severity="high" if risk >= 6.0 else "medium",
                    signals_triggered=triggered_signals,
                    label=label_fix.label,
                    evidence=evidence_dict,
                    fix=label_fix.fix,
                    tone={
                        "kind": roast.kind,
                        "honest": roast.honest,
                        "brutal": roast.brutal
                    }
                )
                
                issues.append(issue)
        
        # Step 4: Compute clarity score
        clarity_score = SignalHelpers.compute_clarity_score(total_risk, len(windows))
        clarity_tier = SignalHelpers.get_clarity_tier(clarity_score)
        
        # Step 5: Build response
        response = AnalysisResponse(
            run_id=str(uuid.uuid4()),
            video_id=video_id,
            video_title=video_id,
            clarity_score=clarity_score,
            clarity_tier=clarity_tier,
            segments=issues
        )
        
        # Cache result
        analysis_cache[video_id] = response
        print(f"✅ Analysis complete for {video_id}: {clarity_score}/100, {len(issues)} issues found")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
