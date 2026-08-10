# SERP Intelli DeepSeek Bug Fix Plan

## Problem

The SERP Intelli analysis section malfunctions or produces incorrect results when DeepSeek API keys are selected. 7 bugs were identified across `services/serpAnalysisService.ts` and `components/SerpIntelligence.tsx`.

## Bugs

| # | Severity | Description |
|---|----------|-------------|
| 1 | Critical | `callDeepSeek()` blocks Bynara fallback when DeepSeek is explicitly selected (line 99: `activeProvider !== AIProvider.DEEPSEEK`) |
| 2 | Critical | Mega-call validator only checks if BOTH keys are missing (line 439), not if the selected provider's key exists |
| 3 | Critical | Sequential analysis validator has the same flaw (line 905) |
| 4 | Major | 13 individual analysis functions silently swallow non-`CRITICAL_API_ERROR` errors and return empty results |
| 5 | Major | No pre-flight validation in the UI before allowing analysis to start |
| 6 | Major | Proxy URL `deepseek-proxy.ubantuplx.workers.dev` may be down/misconfigured, causing network failures |
| 7 | Minor | Inconsistent key retrieval: `localStorage.getItem()` directly vs `getApiKey()` helper |

## Implementation Plan

### Task 1: Fix provider fallback in `callDeepSeek()`

**File:** `services/serpAnalysisService.ts`, lines 93-101

Remove the `activeProvider !== AIProvider.DEEPSEEK` guard so Bynara is used as a fallback when DeepSeek key is missing, regardless of which provider was selected.

**Before:**
```typescript
} else if (!deepSeekKey && bynaraKey && activeProvider !== AIProvider.DEEPSEEK) {
  useBynara = true;
}
```

**After:**
```typescript
} else if (!deepSeekKey && bynaraKey) {
  useBynara = true;
}
```

### Task 2: Fix mega-call validator to check selected provider's key

**File:** `services/serpAnalysisService.ts`, lines 427-442

Replace the `else` branch (DeepSeek default) with provider-specific validation:

- If provider is `AIProvider.DEEPSEEK`, check `getDeepSeekApiKey()` and throw if missing
- If provider is `AIProvider.BYNARA`, check `getBynaraApiKey()` and throw if missing
- Remove the `&&` condition that only errors when both are missing

### Task 3: Fix sequential analysis validator

**File:** `services/serpAnalysisService.ts`, lines 902-907

Same fix as Task 2: validate the selected provider's key specifically, not just that at least one key exists.

### Task 4: Propagate errors from individual analysis functions

**File:** `services/serpAnalysisService.ts`, 13 functions (lines 475-880)

Each `catch` block currently returns empty defaults for non-`CRITICAL_API_ERROR` errors. Change to re-throw all errors so the caller (`generateSerpIntelligenceReport`) can surface them to the user instead of silently returning incomplete data.

Target functions:
- `analyzeContentSimilarity` (line 502)
- `analyzeContentGaps` (line 543)
- `analyzeSeoStructure` (line 584)
- `analyzeHooks` (line 621)
- `analyzeWritingStyle` (line 654)
- `analyzeReadability` (line 667+)
- `analyzeContentPatterns`
- `analyzeSearchIntent`
- `analyzeTopicCoverage`
- `analyzeFaqs`
- `analyzeStatistics`
- `analyzeExperts`
- `generateOutline`

### Task 5: Add pre-flight API key validation in UI

**File:** `components/SerpIntelligence.tsx`, `handleAnalyze()` (line 252)

Before calling `generateSerpIntelligenceReportMega()`, validate that the selected provider's API key exists in localStorage. If missing, set `setSearchError()` with a clear message and return early.

### Task 6: Add direct DeepSeek API URL as fallback

**File:** `services/serpAnalysisService.ts`, line 30

Add a fallback URL (`https://api.deepseek.com/v1/chat/completions`) alongside the proxy URL. If the proxy fails with a network error, retry with the direct URL. This addresses Bug #6 (proxy reliability).

### Task 7: Consolidate key retrieval

**File:** `services/serpAnalysisService.ts`

Ensure all functions use `getDeepSeekApiKey()` and `getBynaraApiKey()` helpers instead of direct `localStorage.getItem()` calls. This addresses Bug #7 (inconsistency).

## Files to Modify

| File | Tasks |
|------|-------|
| `services/serpAnalysisService.ts` | Tasks 1, 2, 3, 4, 6, 7 |
| `components/SerpIntelligence.tsx` | Task 5 |

## Validation

1. Select DeepSeek with no key → should show clear error message, not silent empty results
2. Select DeepSeek with invalid key → should show error, not silently return empty data
3. Select DeepSeek with valid key → analysis should complete with real data
4. Select DeepSeek with no key but Bynara key exists → should fall back to Bynara (Task 1)
5. Select Bynara with no Bynara key but DeepSeek key exists → should use DeepSeek (no regression)
6. Run analysis with all 13 individual functions → errors should propagate, not be swallowed