# Auto Model Selection: Flash for Extraction, Pro for Reasoning

## Goal

Automatically select the best DeepSeek model per analysis task — Flash for extraction-heavy work, Pro for reasoning-heavy work — reducing cost and latency without user-facing complexity.

## Design Decisions

1. **`callDeepSeek` gets a `model` parameter** — defaults to `'deepseek-v4-pro'` so all existing callers (fallback path, competitive strategy) are unaffected.
2. **SERP mega-call uses Flash** — All 13 analyses in the mega-call are extraction/summarization tasks (common topics, gaps, statistics, FAQs, structure counts). Flash handles these well. The existing `validateAndRepairResponse()` already guards against dropped sections.
3. **Competitive strategy mega-call uses Pro** — Weakness identification and competitive advantage ranking require deeper reasoning about what would actually outperform competitors. This is where quality matters most.
4. **Individual `analyze*` functions stay on Pro** — They're only used as fallback if the mega-call fails, so quality over speed is the right default there.
5. **No user-facing toggle** — Auto-selection is invisible. Users who want control can still set the model via the existing settings panel.

## Files to Modify

| File | Change |
|------|--------|
| `services/serpAnalysisService.ts` | Add `model` param to `callDeepSeek`; pass `flash` in `generateSerpIntelligenceReportMega` |
| `services/competitiveStrategyService.ts` | Pass `pro` in `generateCompetitiveStrategyMega` (explicit, even though it's the default) |

## Implementation

### Task 1: Add `model` parameter to `callDeepSeek`

**File**: `services/serpAnalysisService.ts`

Change signature from:
```typescript
export async function callDeepSeek(prompt: string): Promise<any>
```

To:
```typescript
export async function callDeepSeek(
  prompt: string,
  options?: { model?: 'deepseek-v4-pro' | 'deepseek-v4-flash' },
): Promise<any>
```

In the payload, replace hardcoded `"deepseek-v4-pro"` with `options?.model ?? 'deepseek-v4-pro'`.

### Task 2: Pass Flash to SERP mega-call

**File**: `services/serpAnalysisService.ts`

In `generateSerpIntelligenceReportMega`, change:
```typescript
const raw = await callDeepSeek(prompt);
```

To:
```typescript
const raw = await callDeepSeek(prompt, { model: 'deepseek-v4-flash' });
```

### Task 3: Pass Pro to competitive strategy mega-call

**File**: `services/competitiveStrategyService.ts`

In `generateCompetitiveStrategyMega`, change:
```typescript
const result = await callDeepSeek(prompt);
```

To:
```typescript
const result = await callDeepSeek(prompt, { model: 'deepseek-v4-pro' });
```

This is explicit for clarity — competitive strategy is the high-value reasoning work.

## Risk Mitigation

1. **Model availability**: If `deepseek-v4-flash` isn't available on the proxy, the API will return an error. The fallback to sequential Pro calls will still work since it uses the default model.
2. **Quality regression**: If Flash produces poor extraction (missed sections, weak insights), the `validateAndRepairResponse()` function handles structural completeness. Content quality issues can be caught by comparing outputs during testing.
3. **Easy revert**: If Flash quality is unsatisfactory, changing `generateSerpIntelligenceReportMega` back to Pro is a one-line change (remove the `model` option).

## Validation

1. Run the SERP analysis on 3-5 different topics and verify the mega-call output has all 13 sections populated
2. Compare Flash vs Pro output quality for the same URLs — check if topics/gaps/statistics are equally accurate
3. Verify competitive strategy still produces insightful weaknesses and advantages (Pro quality unchanged)
4. Confirm the fallback path still works by temporarily breaking the Flash model identifier and verifying sequential Pro calls execute
