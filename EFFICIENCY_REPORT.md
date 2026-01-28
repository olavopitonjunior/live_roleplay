# Efficiency Improvements Report

This report identifies several areas in the codebase where efficiency could be improved.

## 1. Repeated `import json` Inside Functions (agent/main.py)

**Location:** Lines 475, 490, 507, 529, 538, 551

**Issue:** The `json` module is imported multiple times inside nested functions (`send_transcription_to_room`, `send_status_to_room`, `send_emotion_to_room`, `send_emotion_processing`, `send_coaching_hint`, `send_coaching_state`). Each time these functions are called, Python performs an import lookup.

**Impact:** Minor performance overhead on every function call. While Python caches imports, the lookup still has a cost, especially in high-frequency real-time communication scenarios.

**Fix:** Move `import json` to the top of the file with other imports.

---

## 2. Creating New aiohttp.ClientSession Per Request (agent/main.py)

**Location:** Lines 160, 199, 244, 281 (in `_fetch_session_impl`, `_fetch_scenario_impl`, `_update_session_transcript_impl`, `_trigger_feedback_impl`)

**Issue:** Each HTTP request creates a new `aiohttp.ClientSession()` context manager. Creating a session involves overhead for connection pooling setup, SSL context initialization, and other resources.

**Impact:** Increased latency and resource usage for database operations. In a session with multiple Supabase calls, this adds up.

**Fix:** Create a single `aiohttp.ClientSession` at the start of the entrypoint and pass it to functions, or use a module-level session with proper lifecycle management.

---

## 3. Repeated Keyword Matching in Emotion Analysis (agent/emotion_analyzer.py)

**Location:** Lines 331-369 (`_analyze_with_keywords` method)

**Issue:** The method iterates through multiple keyword lists sequentially, each using `any(kw in text_lower for kw in keywords)`. This performs substring searches for each keyword in each category.

**Impact:** O(n*m) complexity where n is text length and m is total keywords. For longer responses with many keywords, this becomes noticeable.

**Fix:** Consider using a single-pass approach with compiled regex patterns, or a trie-based keyword matcher for O(n) complexity.

---

## 4. Repeated Keyword Matching in Coaching Engine (agent/coaching.py)

**Location:** Lines 237-340, 342-370, 372-411, 413-428

**Issue:** Similar to the emotion analyzer, multiple methods (`_check_methodology_user`, `_check_methodology_avatar`, `_detect_objection`, `_check_good_practices`) each iterate through their own keyword lists.

**Impact:** Cumulative overhead when analyzing both user and avatar messages in real-time.

**Fix:** Consolidate keyword matching into a single pass or use pre-compiled patterns.

---

## 5. Sequential Database Queries in useFeedback Hook (frontend/src/hooks/useFeedback.ts)

**Location:** Lines 151-162

**Issue:** After fetching feedback, the code makes two additional sequential queries: first to get the session's scenario_id, then to fetch the scenario. These could be combined.

**Impact:** Additional round-trip latency to the database.

**Fix:** Use Supabase's join capabilities to fetch feedback with related session and scenario data in a single query.

---

## 6. Polling Loop for Transcript Availability (frontend/src/hooks/useFeedback.ts)

**Location:** Lines 15-42 (`waitForTranscript` function)

**Issue:** Uses a polling loop with fixed 2-second intervals (up to 15 attempts) to check if transcript is available. This is inefficient compared to event-driven approaches.

**Impact:** Unnecessary database queries and delayed feedback generation.

**Fix:** Use Supabase Realtime subscriptions to listen for transcript updates instead of polling.

---

## Recommended Priority

1. **Issue #1 (Repeated json imports)** - Easy fix, immediate improvement
2. **Issue #2 (aiohttp sessions)** - Medium effort, good impact on latency
3. **Issue #5 (Sequential DB queries)** - Easy fix with Supabase joins
4. **Issues #3 & #4 (Keyword matching)** - Requires more refactoring, optimize if profiling shows bottleneck
5. **Issue #6 (Polling)** - Requires architectural change, consider for future iteration
