# Plan: Separate 1-Click and Bulk Article Generation into Distinct Workflows

## Problem

`components/ArticleForm.tsx` (2129 lines) is a single monolithic component that renders both workflows using scattered `mode === 'single'` / `mode === 'bulk'` conditionals. This causes:
- Bulk-specific UI elements (queue textarea, auto-optimize checkbox) are always rendered but conditionally hidden
- Single-specific UI elements (topic input, manual keyword entry, link scan/select controls) are always rendered but hidden in bulk
- State for both modes (`bulkInput`, `autoOptimize`, `queueTopics`) lives in the same component
- `handleSubmit` builds different config shapes from the same form
- Users see irrelevant options for the mode they selected

## Solution

Split into two completely separate form components with zero shared state or conditional rendering between modes. Extract only the common field groups into reusable sub-components.

## Architecture

```
components/
  article/
    SingleArticleForm.tsx      ← NEW: 1-Click Blog Post only
    BulkArticleForm.tsx         ← NEW: Bulk Generation only
    Shared/
      AiProviderSection.tsx
      ImageSettingsSection.tsx
      BrandWebsiteSection.tsx
      ResearchTogglesSection.tsx
      FormattingSection.tsx
      ContentSettingsSection.tsx
      StyleSection.tsx
      ResourcesSection.tsx
```

## Task 1: Extract Shared Sub-Components

Create `components/article/Shared/` with stateless components. Each accepts props and returns JSX with no mode awareness.

### AiProviderSection.tsx
Props: provider, onProviderChange, deepSeekModel, onDeepSeekModelChange, bynaraModel, onBynaraModelChange, researchProvider, onResearchProviderChange
Source: ArticleForm.tsx lines 727-878

### ImageSettingsSection.tsx
Props: imageCount, onImageCountChange, imageModel, onImageModelChange, imageStyle, onImageStyleChange, imageRatio, onImageRatioChange
Source: ArticleForm.tsx lines 880-965

### BrandWebsiteSection.tsx
Props: websiteUrl, onWebsiteUrlChange, urlSavedSuccess, onSave, onClear
Source: ArticleForm.tsx lines 1073-1113

### ResearchTogglesSection.tsx
Props: deepResearch, onDeepResearchChange, realTimeData, onRealTimeDataChange, realTimeSearchProvider, onRealTimeSearchProviderChange, provider
Source: ArticleForm.tsx lines 1115-1192

### FormattingSection.tsx
Props: includeBulletPoints, onBulletPointsChange, includeTables, onTablesChange, includeBold, onBoldChange, includeItalics, onItalicsChange
Source: ArticleForm.tsx lines 1195-1254

### ContentSettingsSection.tsx
Props: type, onTypeChange, tone, onToneChange, targetCountry, onTargetCountryChange, wordCount, onWordCountChange
Source: ArticleForm.tsx lines 1653-1721

### StyleSection.tsx
Props: readability, onReadabilityChange, humanizeContent, onHumanizeChange, useCustomOpening, onUseCustomOpeningChange, openingStyle, onOpeningStyleChange, includeFaq, onIncludeFaqChange, includeConclusion, onIncludeConclusionChange
Source: ArticleForm.tsx lines 1731-1836

### ResourcesSection.tsx
Props: personalFileName, onFileUpload, onClear, personalResources
Source: ArticleForm.tsx lines 1837-1890

## Task 2: Create SingleArticleForm.tsx

File: components/article/SingleArticleForm.tsx

State (single-mode only):
- topic, primaryKeywords, primaryKeywordInput, isGeneratingPrimary
- nlpKeywords, isGeneratingKeywords
- foundLinks, contentOpportunities, selectedLinkUrls, isScanningLinks, isAutoSelecting
- isManualLinkInputOpen, manualLinkInput
- foundExternalLinks, selectedExternalLinkUrls, isScanningExternal

NO bulkInput, autoOptimize, or queueTopics.

Sections (in order):
1. AiProviderSection (shared)
2. ImageSettingsSection (shared)
3. BrandWebsiteSection (shared)
4. ResearchTogglesSection (shared)
5. FormattingSection (shared)
6. Topic Input (single-specific text input)
7. ContentSettingsSection (shared)
8. StyleSection (shared)
9. ResourcesSection (shared)
10. SEO Strategy (single-specific): Keyword provider selector, DeepSeek model, Primary Keywords manual+AI, NLP Keywords manual+AI
11. Internal Linking (single-specific): Scan button, Auto-Select/Top3/All/Rescan, links list, content opportunities
12. External Linking (single-specific): Enable, Find Sources, Auto-Select/Top3/All/None, links list
13. Submit: Generate SEO Article

Handlers use `topic` directly, no bulk logic.

## Task 3: Create BulkArticleForm.tsx

File: components/article/BulkArticleForm.tsx

State (bulk-mode only):
- bulkInput, autoOptimize, isGeneratingFullStrategy

NO topic, primaryKeywords, nlpKeywords, foundLinks, foundExternalLinks.

Sections (in order):
1. AiProviderSection (shared)
2. ImageSettingsSection (shared)
3. BrandWebsiteSection (shared)
4. ResearchTogglesSection (shared)
5. FormattingSection (shared)
6. Content Queue (bulk-specific): textarea, topics counter, Auto-Generate SEO Strategy checkbox
7. ContentSettingsSection (shared)
8. StyleSection (shared)
9. ResourcesSection (shared)
10. SEO Strategy (bulk-specific): Keyword provider selector, DeepSeek model, Auto-Optimization info card. NO manual keyword entry.
11. Internal Linking (bulk-specific): Auto-scan info message, manual upload/paste fallback. NO scan button, NO link checkboxes.
12. External Linking (bulk-specific): Enable, auto-find info message. NO manual source search.
13. Submit: Start Queue Processing (N)

## Task 4: Update App.tsx

1. Import SingleArticleForm and BulkArticleForm
2. Add formMode state: single | bulk
3. Add mode-switching tabs above editor
4. Render appropriate form
5. handleGenerate needs no changes

## Task 5: Preserve localStorage

Both forms must maintain same localStorage persistence. Put persistence logic in shared sub-components or a useArticleSettings hook.

## Task 6: Remove Old ArticleForm.tsx

After verification, delete components/ArticleForm.tsx.

## Files to Create
- components/article/SingleArticleForm.tsx
- components/article/BulkArticleForm.tsx
- components/article/Shared/AiProviderSection.tsx
- components/article/Shared/ImageSettingsSection.tsx
- components/article/Shared/BrandWebsiteSection.tsx
- components/article/Shared/ResearchTogglesSection.tsx
- components/article/Shared/FormattingSection.tsx
- components/article/Shared/ContentSettingsSection.tsx
- components/article/Shared/StyleSection.tsx
- components/article/Shared/ResourcesSection.tsx

## Files to Modify
- App.tsx: replace ArticleForm with mode-based rendering + add mode tabs
- components/ArticleForm.tsx: delete after migration
