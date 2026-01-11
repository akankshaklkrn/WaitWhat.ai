# WaitWhat.ai - Demo Therapist 🎯

**Analyze demo videos for clarity issues and provide actionable feedback with humor**

> Problem: Good ideas lose because explanations break under pressure; feedback is vague.  
> Solution: Upload a demo video → detect "confusion-risk conditions" → show exact timestamps + evidence → suggest minimal fixes → humor wrapper (Roast Mode).

## 🎥 MVP Demo Flow

1. **Upload** a demo/pitch video
2. **Analyze** → AI detects clarity issues
3. **View** list of flagged moments with timestamps
4. **Click** jumps video to exact issue
5. **Roast slider** changes feedback tone (Kind/Honest/Brutal)

## 🏗️ Architecture

```
Frontend (Next.js + Tailwind)
    ↓ Upload video
Backend (FastAPI + Python)
    ↓ Index with TwelveLabs
    ↓ Get transcript + timestamps
    ↓ Analyze with Gemini
    ↓ Detect 6 clarity signals
Frontend (React)
    ↓ Display issues list
    ↓ Video player with seek
    ↓ Roast mode toggle
```

## 📁 Project Structure

```
WaitWhat.ai/
├── backend/                    # Person A + Person B
│   ├── llm_tools.py           # ✅ Person B: Gemini integration
│   ├── signal_helpers.py      # ✅ Person B: Local computations
│   ├── config.py              # ✅ Configuration
│   ├── requirements.txt       # ✅ Dependencies
│   │
│   ├── example_integration.py # ✅ Working example
│   ├── test_llm_tools.py     # ✅ Test suite
│   ├── quickstart_person_a.py # ✅ Template for Person A
│   │
│   ├── README.md              # Backend overview
│   └── README_PERSON_B.md     # Person B detailed docs
│
├── frontend/                   # Person C (Next.js)
│   └── (to be built)
│
└── README.md                   # This file
```

## 🚀 Quick Start

### Person B (LLM Tools) - ✅ COMPLETE

```bash
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY="your-key"
python test_llm_tools.py
```

**Status:** Ready for integration!  
**Docs:** See `backend/README_PERSON_B.md`

### Person A (Backend)

```bash
cd backend
pip install -r requirements.txt

# Set API keys
export GEMINI_API_KEY="your-gemini-key"
export TWELVE_LABS_API_KEY="your-twelvelabs-key"

# Start with template
python quickstart_person_a.py

# Or run full example
python example_integration.py
```

**TODO:**
- [ ] FastAPI endpoints (`/upload`, `/analyze`)
- [ ] TwelveLabs video indexing
- [ ] Transcript windowing
- [x] Integrate Person B's LLM tools (example provided)

**Template:** `backend/quickstart_person_a.py`

### Person C (Frontend)

```bash
# Coming soon
cd frontend
npm install
npm run dev
```

**TODO:**
- [ ] Next.js + Tailwind setup
- [ ] Video player component
- [ ] Issues list + detail view
- [ ] Roast mode slider
- [ ] Clarity score display

**API Endpoint:** `POST http://localhost:8000/analyze`

## 🎯 The 6 Clarity Signals

| Signal | What It Detects | Implementation |
|--------|----------------|----------------|
| **1. Concept Spike** | Too many buzzwords at once | `llm.extract_terms()` |
| **2. Grounding Gap** | Terms used before defined | `llm.check_term_definition()` |
| **3. Trust-Me-Bro** | Claims without evidence | `llm.classify_claims_evidence()` |
| **4. Visual Mismatch** | Speech ≠ visuals | TwelveLabs + Gemini |
| **5. Structure Order** | Bad pitch flow | `llm.role_tag()` |
| **6. Ramble Ratio** | Filler words, low density | `SignalHelpers.analyze_ramble()` |

## 📊 Data Flow

```
1. Upload Video
   └→ Backend saves file, returns video_id

2. TwelveLabs Processing
   ├→ Index video
   ├→ Extract transcript with timestamps
   └→ Split into 10s windows

3. AI Analysis (Per Window)
   ├→ Extract technical terms (Gemini)
   ├→ Detect claims vs evidence (Gemini)
   ├→ Tag segment role (Gemini)
   ├→ Check term definitions (Gemini)
   └→ Compute local signals (no API)

4. Risk Scoring
   ├→ Combine signal severities
   ├→ Compute risk score
   └→ Flag high-risk segments

5. Issue Generation
   ├→ Generate catchy label (Gemini)
   ├→ Suggest fix (Gemini)
   └→ Create 3 roast tones (Gemini)

6. Frontend Display
   ├→ Show clarity score + tier
   ├→ List flagged segments
   ├→ Click to seek video
   └→ Toggle roast mode
```

## 🛠️ Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Frontend | Next.js + Tailwind | Fast UI, modern |
| Backend | FastAPI (Python) | Quick endpoints |
| Video Analysis | TwelveLabs | Indexing + transcripts |
| AI | Google Gemini | LLM analysis |
| Hosting | Vercel + Render | Fast deployment |

## 📝 Example Output

```json
{
  "clarity_score": 63,
  "clarity_tier": "Wait...what are we building?",
  "segments": [
    {
      "segment_id": 1,
      "start_sec": 10,
      "end_sec": 20,
      "label": "Buzzword Overdose",
      "fix": "Define Marengo in one sentence before this segment.",
      "tone": {
        "kind": "This part introduces multiple terms quickly. Add a definition first.",
        "honest": "You dropped 3 acronyms with zero grounding. Define Marengo first.",
        "brutal": "Acronym speedrun detected. Judges met Marengo 0 seconds ago—introduce it first."
      }
    }
  ]
}
```

## 🏆 Hackathon Strategy

### MLH Prize Targets

**Best Use of Gemini:**
- ✅ Heavy Gemini usage for all LLM tasks
- ✅ Term extraction, claims detection, role tagging
- ✅ Label generation, roast text generation

**Best Use of TwelveLabs:**
- Video indexing with timestamps
- Semantic search for visual context
- Transcript extraction

### Demo Prep

1. **Prepare 2 test videos:**
   - One intentionally bad (lots of flags)
   - One decent (fewer flags)

2. **Pre-load sample video** in UI (avoid live upload delays)

3. **Practice pitch:**
   - Problem: Vague feedback on demos
   - Solution: AI-powered clarity analysis
   - Demo: Show flagged segments + roast mode
   - Wow factor: Time-coded receipts with humor

## 🧪 Testing

### Test Person B's Tools
```bash
cd backend
python test_llm_tools.py
```

### Test Integration Example
```bash
cd backend
python example_integration.py
```

### Test Backend Server
```bash
cd backend
python quickstart_person_a.py
# Visit http://localhost:8000/docs
```

## 📚 Documentation

- **`backend/README.md`** - Backend overview + team coordination
- **`backend/README_PERSON_B.md`** - Detailed LLM tools documentation
- **`backend/example_integration.py`** - Complete working pipeline
- **`backend/quickstart_person_a.py`** - FastAPI template for Person A

## ⚙️ Configuration

Create `.env` file in `backend/`:

```bash
# Required
GEMINI_API_KEY=your-gemini-key
TWELVE_LABS_API_KEY=your-twelvelabs-key

# Optional
GEMINI_MODEL=gemini-1.5-flash  # or gemini-1.5-pro
RISK_THRESHOLD=4.0
DEBUG=true
```

Get API keys:
- **Gemini:** https://makersuite.google.com/app/apikey
- **TwelveLabs:** https://dashboard.twelvelabs.io/

## 🚢 Deployment

### Option 1: Local + ngrok (Fastest)
```bash
# Terminal 1: Backend
cd backend
python quickstart_person_a.py

# Terminal 2: ngrok
ngrok http 8000

# Terminal 3: Frontend
cd frontend
npm run dev
```

### Option 2: Production
- **Frontend:** Vercel (auto-deploy from GitHub)
- **Backend:** Render (FastAPI)
- **Storage:** Filesystem or MongoDB Atlas

## ✅ Progress Checklist

### Person B - LLM Tools ✅ COMPLETE
- [x] `llm_tools.py` with all 5 functions
- [x] `signal_helpers.py` for local signals
- [x] Configuration management
- [x] Test suite
- [x] Integration example
- [x] Documentation

### Person A - Backend ⏳ IN PROGRESS
- [ ] FastAPI setup
- [ ] `/upload` endpoint
- [ ] `/analyze` endpoint
- [ ] TwelveLabs integration
- [ ] Transcript windowing
- [x] Person B tools integration (template provided)

### Person C - Frontend ⏳ TODO
- [ ] Next.js setup
- [ ] Video player
- [ ] Issues list
- [ ] Roast slider
- [ ] Clarity score display

## 🤝 Team Coordination

**Person A needs from Person B:** ✅ DONE
- All functions ready in `llm_tools.py`
- Helper functions in `signal_helpers.py`
- Integration example provided
- Template with integration shown

**Person C needs from Person A:** ⏳ WAITING
- `POST /upload` endpoint
- `POST /analyze` endpoint returning JSON
- See `quickstart_person_a.py` for expected response format

**Person B needs from others:** ✅ NOTHING
- Deliverables complete and documented

## 💡 Development Tips

### For Speed
1. Use `gemini-1.5-flash` (default) - faster
2. Enable regex fallbacks in term extraction
3. Use local signals where possible
4. Cache analysis results

### For Quality
1. Switch to `gemini-1.5-pro` - better accuracy
2. Disable fallbacks for pure LLM results
3. Add retry logic for API failures
4. Fine-tune signal weights

### For Demo
1. Pre-load test video (avoid upload time)
2. Have backup screenshots if API fails
3. Practice roast mode toggle (it's the wow factor)
4. Show "before/after" of fixing a flagged issue

## 🐛 Troubleshooting

### Backend won't start
```bash
pip install -r requirements.txt
export GEMINI_API_KEY="your-key"
```

### Tests fail
```bash
# Check API key
echo $GEMINI_API_KEY

# Test internet connection
curl https://generativelanguage.googleapis.com/v1/models

# Run verbose tests
python test_llm_tools.py
```

### Frontend can't reach backend
```bash
# Check CORS in FastAPI
# Check backend is running: curl http://localhost:8000
# Check network: ping localhost
```

## 📞 Getting Help

- **Person B (LLM):** Check `backend/README_PERSON_B.md`
- **Person A (Backend):** See `backend/example_integration.py`
- **Person C (Frontend):** API spec in `backend/quickstart_person_a.py`

## 🎉 Project Status

| Component | Status | Owner |
|-----------|--------|-------|
| LLM Tools | ✅ Complete | Person B |
| Signal Helpers | ✅ Complete | Person B |
| Documentation | ✅ Complete | Person B |
| Backend API | ⏳ In Progress | Person A |
| TwelveLabs Integration | ⏳ Todo | Person A |
| Frontend | ⏳ Todo | Person C |
| Deployment | ⏳ Todo | Team |

---

**Built for Joke Hack 2026** 🎯

**Team:** Person A (Backend), Person B (LLM), Person C (Frontend)

**Goal:** Help presenters avoid the "Wait...what?" moment

Good luck! 🚀
