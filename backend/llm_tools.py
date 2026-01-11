"""
LLM Tools for Demo Therapist
Person B's module for extracting insights from demo videos using Gemini API

All functions return structured data that Person A can directly use in the backend pipeline.
"""

import os
import re
import json
from typing import List, Dict, Optional, Tuple
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)  # Suppress deprecation warning
import google.generativeai as genai
from dataclasses import dataclass
import time


# Configure Gemini API
def configure_gemini(api_key: Optional[str] = None):
    """Initialize Gemini API with key from parameter or environment"""
    if api_key is None:
        api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        raise ValueError("Gemini API key not found. Set GEMINI_API_KEY environment variable or pass api_key parameter.")
    
    genai.configure(api_key=api_key)


# Initialize model (call this once at startup)
def get_model(model_name: str = "models/gemini-2.5-flash"):
    """Get Gemini model instance. Use 2.5 flash for speed."""
    return genai.GenerativeModel(model_name)


@dataclass
class TermsResult:
    """Result from extract_terms"""
    terms: List[str]
    acronyms: List[str]
    technical_terms: List[str]


@dataclass
class ClaimsEvidenceResult:
    """Result from classify_claims_evidence"""
    claims: List[str]
    evidence: List[str]
    has_evidence: bool


@dataclass
class RoleLabelResult:
    """Result from role_tag"""
    role: str  # One of: problem, user_context, solution, demo, metrics, architecture, tradeoffs, cta
    confidence: float


@dataclass
class LabelAndFixResult:
    """Result from label_and_fix"""
    label: str  # Short label like "Buzzword Overdose"
    explanation: str  # 1-2 sentence explanation
    fix: str  # Actionable 1-line fix


@dataclass
class RoastVariants:
    """Result from roast_variants"""
    kind: str
    honest: str
    brutal: str


class LLMTools:
    """Main class for all LLM operations"""
    
    def __init__(self, api_key: Optional[str] = None, model_name: str = "models/gemini-2.5-flash"):
        """
        Initialize LLM Tools
        
        Args:
            api_key: Gemini API key (or uses GEMINI_API_KEY env var)
            model_name: Model to use (default: models/gemini-2.5-flash for speed)
        """
        configure_gemini(api_key)
        self.model = get_model(model_name)
        
        # Filler word list for local fallback
        self.filler_words = ["um", "uh", "like", "you know", "basically", "kind of", "sort of", "actually", "literally"]
    
    
    def extract_terms(self, window_text: str, use_fallback: bool = True) -> TermsResult:
        """
        Extract technical terms, acronyms, and buzzwords from a transcript window.
        
        Signal 1: Concept Spike / Buzzword Velocity
        
        Args:
            window_text: Transcript text for the window (~10s)
            use_fallback: If True, uses regex fallback for speed
        
        Returns:
            TermsResult with lists of terms
        """
        acronyms = []
        technical_terms = []
        
        # Fast regex fallback for hackathon speed
        if use_fallback:
            # Extract uppercase acronyms (2+ letters)
            acronyms = list(set(re.findall(r'\b[A-Z]{2,}\b', window_text)))
            
            # Extract CamelCase terms
            camel_case = list(set(re.findall(r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b', window_text)))
            
            technical_terms = camel_case
        
        # Enhance with LLM (optional, for better quality)
        try:
            prompt = f"""Extract all technical terms, buzzwords, and acronyms from this transcript excerpt.
Return only a JSON object with these fields:
- acronyms: list of acronyms (API, ML, RAG, etc.)
- technical_terms: list of technical/domain-specific terms (authentication, embeddings, latency, etc.)

Transcript: "{window_text}"

JSON:"""
            
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Parse JSON from response
            # Clean markdown code blocks if present
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            parsed = json.loads(result_text)
            acronyms = list(set(acronyms + parsed.get("acronyms", [])))
            technical_terms = list(set(technical_terms + parsed.get("technical_terms", [])))
            
        except Exception as e:
            # Fallback already populated, just log
            print(f"Warning: LLM term extraction failed, using regex fallback: {e}")
        
        all_terms = list(set(acronyms + technical_terms))
        
        return TermsResult(
            terms=all_terms,
            acronyms=acronyms,
            technical_terms=technical_terms
        )
    
    
    def classify_claims_evidence(self, window_text: str) -> ClaimsEvidenceResult:
        """
        Detect claims (benefits, superlatives) and evidence cues.
        
        Signal 3: Trust-Me-Bro (Claim without Evidence)
        
        Args:
            window_text: Transcript text for the window
        
        Returns:
            ClaimsEvidenceResult with claims and evidence lists
        """
        prompt = f"""Analyze this transcript excerpt for CLAIMS and EVIDENCE.

CLAIMS: Any statement about benefits, improvements, or superlatives
Examples: "faster", "more scalable", "reduced latency", "improved performance", "secure", "efficient"

EVIDENCE: Any reference to proof, data, or demonstration
Examples: "as you can see", "the graph shows", "benchmark results", "demo", "chart", "before/after", "measured"

Return ONLY a JSON object:
{{
    "claims": [list of claim statements found],
    "evidence": [list of evidence cues found]
}}

Transcript: "{window_text}"

JSON:"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean markdown
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            parsed = json.loads(result_text)
            claims = parsed.get("claims", [])
            evidence = parsed.get("evidence", [])
            
        except Exception as e:
            print(f"Warning: Claims/evidence classification failed: {e}")
            # Keyword fallback
            claims = self._detect_claims_fallback(window_text)
            evidence = self._detect_evidence_fallback(window_text)
        
        return ClaimsEvidenceResult(
            claims=claims,
            evidence=evidence,
            has_evidence=len(evidence) > 0
        )
    
    
    def _detect_claims_fallback(self, text: str) -> List[str]:
        """Fallback claim detection using keywords"""
        claim_keywords = ["faster", "better", "improved", "reduced", "increased", "scalable", 
                         "secure", "efficient", "optimized", "enhanced", "superior"]
        claims = []
        text_lower = text.lower()
        for keyword in claim_keywords:
            if keyword in text_lower:
                claims.append(keyword)
        return claims
    
    
    def _detect_evidence_fallback(self, text: str) -> List[str]:
        """Fallback evidence detection using keywords"""
        evidence_keywords = ["graph", "chart", "demo", "show", "see", "benchmark", 
                            "result", "data", "measured", "tested", "proof"]
        evidence = []
        text_lower = text.lower()
        for keyword in evidence_keywords:
            if keyword in text_lower:
                evidence.append(keyword)
        return evidence
    
    
    def role_tag(self, window_text: str) -> RoleLabelResult:
        """
        Label the role/purpose of a transcript segment.
        
        Signal 5: Structure Order Violations
        
        Args:
            window_text: Transcript text for the window
        
        Returns:
            RoleLabelResult with role label and confidence
        """
        prompt = f"""Classify this demo/pitch transcript segment into ONE category:

Categories:
- problem: Describing the problem/pain point
- user_context: Explaining who the user is or context
- solution: Presenting the solution/product
- demo: Demonstrating the product (showing features)
- metrics: Showing results, metrics, benchmarks
- architecture: Explaining technical architecture
- tradeoffs: Discussing tradeoffs or alternatives
- cta: Call to action, next steps, ask

Return ONLY a JSON object:
{{
    "role": "one of the above categories",
    "confidence": 0.0-1.0
}}

Transcript: "{window_text}"

JSON:"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean markdown
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            parsed = json.loads(result_text)
            role = parsed.get("role", "unknown")
            confidence = parsed.get("confidence", 0.5)
            
        except Exception as e:
            print(f"Warning: Role tagging failed: {e}")
            role = "unknown"
            confidence = 0.0
        
        return RoleLabelResult(role=role, confidence=confidence)
    
    
    def check_term_definition(self, term: str, window_text: str) -> bool:
        """
        Check if a term is defined in the given window.
        
        Signal 2: Grounding Gap (Used before defined)
        
        Args:
            term: The term to check
            window_text: Transcript text to check
        
        Returns:
            True if term is defined in this window
        """
        prompt = f"""Does this transcript excerpt DEFINE or EXPLAIN the term "{term}"?

A definition means:
- Explaining what {term} is
- Describing what {term} means
- Introducing {term} with context

Just mentioning {term} without explanation does NOT count as a definition.

Return ONLY: yes or no

Transcript: "{window_text}"

Answer:"""
        
        try:
            response = self.model.generate_content(prompt)
            answer = response.text.strip().lower()
            return "yes" in answer
            
        except Exception as e:
            print(f"Warning: Term definition check failed: {e}")
            # Fallback: look for definition patterns
            patterns = [
                f"{term} is",
                f"{term} means",
                f"what {term}",
                f"{term}, which is",
                f"{term} refers to"
            ]
            text_lower = window_text.lower()
            term_lower = term.lower()
            return any(pattern.replace(term, term_lower) in text_lower for pattern in patterns)
    
    
    def label_and_fix(self, window_text: str, triggered_signals: List[str], terms: List[str], context: dict = None) -> LabelAndFixResult:
        """
        Generate a catchy label and actionable fix for a flagged segment.
        
        Args:
            window_text: Transcript text
            triggered_signals: List of signal names that triggered (e.g., ["concept_spike", "grounding_gap"])
            terms: List of problematic terms
            context: Optional additional context
        
        Returns:
            LabelAndFixResult with label, explanation, and fix
        """
        signals_desc = {
            "concept_spike": "too many new technical terms introduced at once",
            "grounding_gap": "terms used without definition",
            "tmb": "claims made without evidence",
            "visual_mismatch": "what's said doesn't match what's shown",
            "structure_order": "pitch structure is out of order",
            "ramble_ratio": "too much filler or low information density"
        }
        
        signals_text = ", ".join([signals_desc.get(s, s) for s in triggered_signals])
        
        prompt = f"""You are analyzing a presentation segment with these clarity issues: {signals_text}

Presentation Context:
{context if context else 'No specific context provided'}

Transcript: "{window_text}"
Problematic terms: {terms}

Based on the presentation context above, generate:
1. A catchy 2-4 word label that resonates with the audience and mode
2. A brief explanation of why this is an issue for this specific audience and goal
3. A specific fix that considers the time limit and target user

Return ONLY a JSON object:
{{
    "label": "catchy label",
    "explanation": "what's wrong",
    "fix": "how to fix it"
}}

JSON:"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean markdown
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            parsed = json.loads(result_text)
            
            return LabelAndFixResult(
                label=parsed.get("label", "Clarity Issue"),
                explanation=parsed.get("explanation", "This segment may confuse viewers."),
                fix=parsed.get("fix", "Simplify and add context.")
            )
            
        except Exception as e:
            print(f"Warning: Label and fix generation failed: {e}")
            return LabelAndFixResult(
                label="Clarity Issue",
                explanation=f"Issues detected: {signals_text}",
                fix="Add definitions and context before introducing new concepts."
            )
    
    
    def roast_variants(self, label: str, explanation: str, fix: str, transcript_excerpt: str = None, signals: List[str] = None, context: dict = None) -> RoastVariants:
        """
        Generate 3 tones of feedback: kind, honest, brutal.
        
        This is the "humor wrapper" that makes the tool fun to use.
        
        Args:
            label: Issue label (e.g., "Buzzword Overdose")
            explanation: What's wrong
            fix: How to fix it
            transcript_excerpt: The actual transcript text (for personalized feedback)
            signals: List of triggered signals (for context)
        
        Returns:
            RoastVariants with 3 different tones
        """
        signals_context = f"\nTriggered signals: {', '.join(signals)}" if signals else ""
        transcript_context = f"\nTranscript excerpt: \"{transcript_excerpt}\"" if transcript_excerpt else ""
        
        # First, generate KIND and HONEST tones (standard temperature)
        prompt_standard = f"""You are a pitch coach giving feedback on a presentation.

Presentation Context:
{context if context else 'No specific context provided'}

Issue Label: {label}
Problem: {explanation}
Suggested Fix: {fix}{signals_context}{transcript_context}

Consider:
- Audience is {context.get('audience', 'unknown')}
- Goal is {context.get('goal', 'unknown')}
- Time limit is {context.get('time_limit', 'unknown')}
- Domain is {context.get('domain', 'unknown')}

Generate KIND and HONEST feedback versions with CONCRETE, SPECIFIC suggestions based on the actual transcript.

🟢 KIND (Sugar-coated, encouraging, mentor-like):
- Start with something positive or empathetic
- Frame the issue gently: "I noticed...", "Consider...", "It might help to..."
- End with encouragement
- Example: "I can see you're passionate about this! The terminology like 'negative ion technology' might be new to judges. Try adding a quick one-liner definition right after you mention it—something like 'negative ions are molecules that...' This will keep everyone on the same page from the start."

🟡 HONEST (Straightforward, professional, direct):
- State the issue clearly and factually
- Explain the impact on the audience
- Give a specific, actionable fix
- Example: "You introduce 'negative ion technology' at 5 seconds without defining it. Judges won't know what you're talking about. Add a definition immediately after: 'Negative ions are X, and they do Y.' This takes 3 seconds and eliminates confusion."

Return ONLY a JSON object:
{{
    "kind": "encouraging sugar-coated version with specific fix",
    "honest": "direct professional version with clear action"
}}

JSON:"""
        
        # Generate BRUTAL tone separately with high temperature for maximum creativity
        prompt_brutal = f"""You are a savage but constructive pitch roaster who understands the context:

Presentation Context:
{context if context else 'No specific context provided'}

Issue: {label}
Problem: {explanation}
Suggested Fix: {fix}{signals_context}{transcript_context}

Remember:
- This is a {context.get('mode', 'presentation')} for {context.get('audience', 'an audience')}
- The goal is to {context.get('goal', 'communicate effectively')}
- Time limit: {context.get('time_limit', 'unknown')}

Write a BRUTAL 3-line roast in this EXACT format:

Line 1 (Punchline): One witty metaphor or comparison. Be creative, sarcastic, memorable. Reference the transcript if possible. NO profanity.

Line 2 (Callout): Name the exact clarity flaw in 8-14 words. Be sharp and direct.

Line 3 (Fix): Give ONE rewrite sentence the speaker can say verbatim. Start with "Say:" or "Try:"

Examples:

Example 1 (Buzzword Overdose):
"You're speaking in acronym soup—judges need a decoder ring just to follow you. Dropping 'Marengo,' 'RAG,' and 'FAISS' with zero context confuses everyone. Say: 'We use Marengo—our internal search tool—with RAG, which combines retrieval and generation.'"

Example 2 (Trust Me Bro):
"'10x faster'? That's the same energy as 'trust me bro, it's fast.' You're making performance claims with zero receipts—no graphs, no numbers. Say: 'We cut latency from 420ms to 42ms—here's the benchmark.'"

Example 3 (Structure Violation):
"Demo before problem? That's like doing a magic trick before explaining what magic is. You're showing features before judges know what pain you're solving. Say: 'People waste 20 minutes daily in lines—that's the problem Kwikoi solves.'"

Now write YOUR 3-line brutal roast for this issue. Be witty, sharp, and memorable:"""
        
        try:
            # Generate standard tones
            response_standard = self.model.generate_content(prompt_standard)
            result_standard = response_standard.text.strip()
            
            # Clean markdown from standard response
            if "```json" in result_standard:
                result_standard = result_standard.split("```json")[1].split("```")[0].strip()
            elif "```" in result_standard:
                result_standard = result_standard.split("```")[1].split("```")[0].strip()
            
            parsed_standard = json.loads(result_standard)
            kind_text = parsed_standard.get("kind", f"{explanation} {fix}")
            honest_text = parsed_standard.get("honest", f"{label}: {fix}")
            
            # Generate BRUTAL tone with high temperature for creativity
            response_brutal = self.model.generate_content(
                prompt_brutal,
                generation_config={
                    "temperature": 0.9,
                    "top_p": 0.95
                }
            )
            brutal_text = response_brutal.text.strip()
            
            # Brutal response is already formatted as 3 lines, no JSON parsing needed
            # Clean up any markdown formatting
            if "```" in brutal_text:
                brutal_text = brutal_text.split("```")[0].strip()
            
            return RoastVariants(
                kind=kind_text,
                honest=honest_text,
                brutal=brutal_text
            )
            
        except Exception as e:
            print(f"Warning: Roast variants generation failed: {e}")
            # Fallback templates with distinct tones
            
            # KIND: Gentle and encouraging
            kind_feedback = f"I can see the potential here! {explanation} A small adjustment would really help: {fix} This will make your pitch even stronger."
            
            # HONEST: Direct and professional
            honest_feedback = f"{label}: {explanation} Here's what to do: {fix}"
            
            # BRUTAL: 3-line witty roast format
            brutal_punchlines = {
                "Buzzword Overdose": "Acronym speedrun detected—you're speaking fluent jargon to judges who speak English.",
                "Ghost Terms": "You're name-dropping terms like they're your college roommates—spoiler: judges just met them.",
                "Trust Me Bro": "Making bold claims with the confidence of someone who forgot to pack the evidence.",
                "Clarity Issue": "Your pitch clarity just hit turbulence—judges are reaching for oxygen masks.",
                "Structure Issue": "You're showing the punchline before the setup—that's comedy school, day negative one."
            }
            
            brutal_punchline = brutal_punchlines.get(label, f"{label} detected—and it's hitting judges like a plot twist nobody asked for.")
            
            # Extract key terms from explanation for the callout
            brutal_callout = explanation[:80] + "..." if len(explanation) > 80 else explanation
            
            # 3-line brutal format
            brutal_feedback = f"{brutal_punchline}\n{brutal_callout}\nTry: {fix}"
            
            return RoastVariants(
                kind=kind_feedback,
                honest=honest_feedback,
                brutal=brutal_feedback
            )
    
    
    def batch_process_windows(
        self, 
        windows: List[Dict],
        extract_terms_enabled: bool = True,
        role_tag_enabled: bool = True
    ) -> Dict:
        """
        Helper function to batch process multiple windows efficiently.
        Person A can use this for the full pipeline.
        
        Args:
            windows: List of window dicts with 'text' and 'start_sec'
            extract_terms_enabled: Whether to extract terms
            role_tag_enabled: Whether to tag roles
        
        Returns:
            Dict mapping window index to processed results
        """
        results = {}
        
        for idx, window in enumerate(windows):
            window_results = {
                "text": window.get("text", ""),
                "start_sec": window.get("start_sec", 0)
            }
            
            if extract_terms_enabled:
                terms_result = self.extract_terms(window["text"])
                window_results["terms"] = terms_result
            
            if role_tag_enabled:
                role_result = self.role_tag(window["text"])
                window_results["role"] = role_result
            
            results[idx] = window_results
            
            # Small delay to avoid rate limits
            time.sleep(0.1)
        
        return results


# Convenience function for one-off usage
def quick_analyze(text: str, api_key: Optional[str] = None) -> Dict:
    """
    Quick analysis of a single text segment.
    Useful for testing.
    
    Returns all results in one dict.
    """
    tools = LLMTools(api_key)
    
    terms = tools.extract_terms(text)
    claims_evidence = tools.classify_claims_evidence(text)
    role = tools.role_tag(text)
    
    return {
        "terms": terms,
        "claims_evidence": claims_evidence,
        "role": role
    }


if __name__ == "__main__":
    # Quick test
    print("LLM Tools initialized successfully!")
    print("Set GEMINI_API_KEY environment variable to test.")
    
    # Example usage for Person A
    example_text = """
    So we built this using Marengo with RAG and vector embeddings.
    It's much faster than the baseline and scales to millions of queries.
    """
    
    print("\n=== Example Usage ===")
    print(f"Input: {example_text}")
    
    if os.environ.get("GEMINI_API_KEY"):
        try:
            result = quick_analyze(example_text)
            print(f"\nTerms: {result['terms'].terms}")
            print(f"Claims: {result['claims_evidence'].claims}")
            print(f"Evidence: {result['claims_evidence'].evidence}")
            print(f"Role: {result['role'].role}")
        except Exception as e:
            print(f"\nTest failed (expected if API key not set): {e}")
    else:
        print("\n⚠️  GEMINI_API_KEY not set. Set it to test API calls.")
