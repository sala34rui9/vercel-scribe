# Plan: Fix Admin Usage Section Scroll at 100% Zoom

## Problem

The usage section only becomes scrollable when zoomed out to 80%. At 100% zoom, content overflows without triggering scrollbars.

## Root Cause

Two issues in the flexbox height chain:

1. **Flex `min-height: auto` default** — The admin wrapper div in `App.tsx:736` has `h-full` but no `min-h-0`. Flex items default to `min-height: auto`, causing the wrapper to expand to fit content rather than being constrained by the parent's `overflow-y-auto`. This prevents the outer scroll container from ever triggering.

2. **`overflow-hidden` clips scroll propagation** — The outer card in `AdminUsageContent.tsx:54` has `overflow-hidden`, which clips the inner table container's `overflow-auto` from propagating scroll behavior up the chain.

## Fixes

### Fix 1: `App.tsx` line 736

```tsx
// Before:
<div className="animate-in fade-in duration-300 h-full w-full">

// After:
<div className="animate-in fade-in duration-300 min-h-0 h-full w-full">
```

`min-h-0` overrides the flex default of `min-height: auto`, allowing the wrapper to shrink to the parent's constrained height (`calc(100vh-8rem)`), which enables `overflow-y-auto` to trigger when content overflows.

### Fix 2: `AdminUsageContent.tsx` line 54

```tsx
// Before:
<div className="max-w-6xl mx-auto flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative p-6">

// After:
<div className="max-w-6xl mx-auto flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 relative p-6">
```

Removing `overflow-hidden` allows the inner table container's `flex-1 overflow-auto` to function properly within the constrained height.

## Validation

1. Run `npx tsc --noEmit` — no new errors expected (no type changes)
2. Navigate to Admin → Usage tab with data loaded
3. Verify scrollbar appears at 100% zoom when table content exceeds viewport
4. Verify no layout regressions in other pages (Builder, Docs, SEO, etc.)

## Affected Files

- `App.tsx` (1 line)
- `components/AdminUsageContent.tsx` (1 line)

## Risks

- Minimal — both changes are single-class additions/removals in the height chain
- No impact on localStorage, state management, or API calls
