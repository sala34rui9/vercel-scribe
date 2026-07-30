/**
 * Wayback Machine Service - Main Facade
 * Provides a unified API for all Wayback Machine operations.
 *
 * This is the primary entry point for the application to interact with
 * the Wayback Machine. It delegates to specialized modules:
 * - availability.ts: Check if URLs have archived snapshots
 * - cdx.ts: Retrieve historical capture records
 * - parser.ts: Parse and transform API responses
 * - timeline.ts: Build timeline structures from snapshots
 * - extractor.ts: Extract content from archived pages
 *
 * Architecture: This service is designed to be provider-agnostic.
 * Future archive providers can be added behind the same interface.
 *
 * Usage:
 * ```typescript
 * import * as wayback from './services/waybackService';
 *
 * // Check if a URL is archived
 * const status = await wayback.checkAvailability('https://example.com');
 *
 * // Get all snapshots
 * const snapshots = await wayback.fetchSnapshots('https://example.com');
 *
 * // Build a timeline
 * const timeline = wayback.buildTimeline('https://example.com', snapshots);
 *
 * // Extract content from a snapshot
 * const content = await wayback.extractContent(snapshot);
 * ```
 */

import type {
  WaybackSnapshot,
  WaybackTimeline,
  WaybackExtractedContent,
  WaybackCdxOptions,
  WaybackExtractOptions,
  WaybackComparisonResult,
  WaybackSeoAnalysis,
  WaybackBacklinkRecovery,
  WaybackDomainAnalysis,
} from '../types';

// ============================================================
// Re-export all types for consumers
// ============================================================

export type {
  WaybackAvailabilityResponse,
  WaybackCdxRecord,
  WaybackSnapshot,
  WaybackTimelineEntry,
  WaybackTimeline,
  WaybackExtractedContent,
  WaybackComparisonResult,
  WaybackSeoAnalysis,
  WaybackBacklinkRecovery,
  WaybackDomainAnalysis,
  WaybackCdxOptions,
  WaybackExtractOptions,
} from '../types';

// ============================================================
// Availability API
// ============================================================

export {
  checkAvailability,
  isAvailable,
  fetchAvailabilityRaw,
  buildSnapshotUrl,
} from './wayback/availability';

// ============================================================
// CDX API
// ============================================================

export {
  fetchCdxRecords,
  fetchSnapshots,
  fetchUniqueSnapshots,
  fetchRecentSnapshots,
  fetchFirstSnapshot,
  fetchLatestSnapshot,
  countCaptures,
} from './wayback/cdx';

// ============================================================
// Parser Utilities
// ============================================================

export {
  parseWaybackTimestamp,
  waybackTimestampToIso,
  formatWaybackDate,
  formatWaybackDateTime,
  buildSnapshotUrl as buildSnapshotUrlFromParser,
  buildRawSnapshotUrl,
  parseCdxJsonRow,
  parseCdxJsonResponse,
  parseCdxTextResponse,
  cdxRecordToSnapshot,
  cdxRecordsToSnapshots,
  parseAvailabilityResponse,
  normalizeUrl,
  extractDomain,
  createFailedExtraction,
  createSuccessfulExtraction,
  filterHtmlSnapshots,
  deduplicateByDigest,
  filterSuccessfulRecords,
} from './wayback/parser';

// ============================================================
// Timeline Builder
// ============================================================

export {
  groupSnapshotsByYear,
  groupSnapshotsByMonth,
  buildTimeline,
  buildCompactTimeline,
  getCaptureTrend,
  generateTimelineSummary,
  selectRepresentativeSnapshots,
  findClosestSnapshot,
} from './wayback/timeline';

// ============================================================
// Content Extractor
// ============================================================

export {
  extractContent,
  extractMultipleContents,
  extractFromTimestamp,
  fetchArchivedContent,
} from './wayback/extractor';

// ============================================================
// High-Level Composite Operations
// These combine multiple modules for common workflows
// ============================================================

/**
 * Complete workflow: Check availability and extract content if available.
 * Ideal for the "Recover Deleted Content" use case.
 *
 * @param url - The URL to recover content for
 * @returns Extraction result or null if no archive exists
 */
export const recoverContent = async (
  url: string,
  options: WaybackExtractOptions = {}
): Promise<WaybackExtractedContent | null> => {
  console.log(`[Wayback] Recovering content for: ${url}`);

  const { checkAvailability } = await import('./wayback/availability');
  const { extractContent } = await import('./wayback/extractor');

  const availability = await checkAvailability(url);
  if (!availability.isAvailable || !availability.snapshot) {
    console.log(`[Wayback] No archive found for: ${url}`);
    return null;
  }

  console.log(`[Wayback] Archive found from ${availability.snapshot.timestamp}, extracting...`);
  return extractContent(availability.snapshot, options);
};

/**
 * Complete workflow: Get full timeline for a URL.
 * Fetches all snapshots and builds a structured timeline.
 *
 * @param url - The URL to get timeline for
 * @param options - CDX query options
 * @returns Complete WaybackTimeline
 */
export const getFullTimeline = async (
  url: string,
  options: WaybackCdxOptions = {}
): Promise<WaybackTimeline> => {
  console.log(`[Wayback] Building timeline for: ${url}`);

  const { fetchSnapshots } = await import('./wayback/cdx');
  const { buildTimeline } = await import('./wayback/timeline');

  const snapshots = await fetchSnapshots(url, options);
  return buildTimeline(url, snapshots);
};

/**
 * Complete workflow: Compare two snapshots.
 * Extracts content from both and identifies differences.
 *
 * @param olderSnapshot - The older snapshot
 * @param newerSnapshot - The newer snapshot
 * @param options - Extraction options
 * @returns Comparison result with differences
 */
export const compareSnapshots = async (
  olderSnapshot: WaybackSnapshot,
  newerSnapshot: WaybackSnapshot,
  options: WaybackExtractOptions = {}
): Promise<WaybackComparisonResult> => {
  console.log(`[Wayback] Comparing snapshots: ${olderSnapshot.timestamp} vs ${newerSnapshot.timestamp}`);

  const { extractContent } = await import('./wayback/extractor');

  const [olderContent, newerContent] = await Promise.all([
    extractContent(olderSnapshot, options),
    extractContent(newerSnapshot, options),
  ]);

  // Calculate content growth
  const olderLength = olderContent.content?.length || 0;
  const newerLength = newerContent.content?.length || 0;
  const contentGrowth = olderLength > 0
    ? ((newerLength - olderLength) / olderLength) * 100
    : 0;

  // Simple heading extraction (lines starting with # or containing heading-like patterns)
  const extractHeadings = (text: string): string[] => {
    if (!text) return [];
    return text.split('\n').filter(line =>
      /^#{1,6}\s/.test(line.trim()) ||
      /^[A-Z][^.!?]{10,80}$/.test(line.trim())
    ).map(line => line.replace(/^#{1,6}\s/, '').trim());
  };

  const olderHeadings = extractHeadings(olderContent.content || '');
  const newerHeadings = extractHeadings(newerContent.content || '');

  const addedSections = newerHeadings.filter(h => !olderHeadings.includes(h));
  const removedSections = olderHeadings.filter(h => !newerHeadings.includes(h));

  return {
    older: olderSnapshot,
    newer: newerSnapshot,
    olderContent: olderContent.fetchStatus === 'success' ? olderContent : undefined,
    newerContent: newerContent.fetchStatus === 'success' ? newerContent : undefined,
    addedSections,
    removedSections,
    changedHeadings: [...addedSections, ...removedSections],
    keywordChanges: [], // Placeholder for AI-powered keyword analysis
    contentGrowth: Math.round(contentGrowth * 100) / 100,
  };
};

/**
 * Complete workflow: Analyze historical SEO metrics.
 * Examines snapshots over time to identify SEO trends.
 *
 * @param url - The URL to analyze
 * @param options - CDX query options
 * @returns SEO analysis result
 */
export const analyzeHistoricalSeo = async (
  url: string,
  options: WaybackCdxOptions = { limit: 50 }
): Promise<WaybackSeoAnalysis> => {
  console.log(`[Wayback] Analyzing historical SEO for: ${url}`);

  const { fetchUniqueSnapshots } = await import('./wayback/cdx');
  const { extractContent } = await import('./wayback/extractor');
  const { getCaptureTrend } = await import('./wayback/timeline');

  const snapshots = await fetchUniqueSnapshots(url, options);

  if (snapshots.length === 0) {
    return {
      url,
      contentFreshnessScore: 0,
      historicalWordCount: [],
      headingEvolution: [],
      keywordEvolution: [],
      publishingTrend: 'unknown',
      missingTopics: [],
      recommendations: ['No archived snapshots found for analysis'],
    };
  }

  // Extract content from representative snapshots
  const { selectRepresentativeSnapshots } = await import('./wayback/timeline');
  const representative = selectRepresentativeSnapshots(snapshots, 5);
  const contents = await Promise.all(
    representative.map(s => extractContent(s, { maxContentLength: 10000 }))
  );

  const successfulContents = contents.filter(c => c.fetchStatus === 'success');

  // Calculate historical word counts
  const historicalWordCount = successfulContents.map(c =>
    c.content ? c.content.split(/\s+/).length : 0
  );

  // Extract headings evolution
  const headingEvolution = successfulContents.map(c => {
    if (!c.content) return [];
    return c.content.split('\n').filter(line =>
      /^#{1,6}\s/.test(line.trim())
    ).map(line => line.replace(/^#{1,6}\s/, '').trim());
  });

  // Calculate freshness score (0-100)
  const now = new Date();
  const lastSnapshotAge = snapshots.length > 0
    ? (now.getTime() - snapshots[snapshots.length - 1].date.getTime()) / (1000 * 60 * 60 * 24)
    : 365;
  const contentFreshnessScore = Math.max(0, Math.min(100, 100 - (lastSnapshotAge / 3.65)));

  // Determine publishing trend
  const publishingTrend = getCaptureTrend(snapshots);

  // Generate recommendations
  const recommendations: string[] = [];
  if (snapshots.length < 5) {
    recommendations.push('Limited archive history available for comprehensive analysis');
  }
  if (lastSnapshotAge > 180) {
    recommendations.push('Last capture is over 6 months old - page may be infrequently crawled');
  }
  if (historicalWordCount.length > 1) {
    const avgWords = historicalWordCount.reduce((a, b) => a + b, 0) / historicalWordCount.length;
    if (avgWords < 500) {
      recommendations.push('Historical content appears thin - consider expanding article depth');
    }
  }

  return {
    url,
    contentFreshnessScore: Math.round(contentFreshnessScore),
    historicalWordCount,
    headingEvolution,
    keywordEvolution: [], // Placeholder for AI-powered keyword analysis
    publishingTrend,
    missingTopics: [], // Placeholder for AI-powered topic analysis,
    recommendations,
  };
};

/**
 * Complete workflow: Analyze an expired domain.
 * Retrieves archive history to assess domain quality.
 *
 * @param domain - The domain to analyze
 * @returns Domain analysis result
 */
export const analyzeExpiredDomain = async (
  domain: string
): Promise<WaybackDomainAnalysis> => {
  console.log(`[Wayback] Analyzing expired domain: ${domain}`);

  const { fetchSnapshots, fetchFirstSnapshot, fetchLatestSnapshot } = await import('./wayback/cdx');
  const { extractContent } = await import('./wayback/extractor');
  const { getCaptureTrend } = await import('./wayback/timeline');

  const normalizedDomain = domain.match(/^https?:\/\//) ? domain : `https://${domain}`;

  try {
    const [snapshots, firstSnapshot, latestSnapshot] = await Promise.all([
      fetchSnapshots(normalizedDomain, { limit: 100 }),
      fetchFirstSnapshot(normalizedDomain),
      fetchLatestSnapshot(normalizedDomain),
    ]);

    // Extract content from latest snapshot for quality assessment
    let contentQuality: 'high' | 'medium' | 'low' | 'unknown' = 'unknown';
    let spamIndicators: string[] = [];
    let originalNiche = '';
    let businessCategory = 'unknown';

    if (latestSnapshot) {
      const content = await extractContent(latestSnapshot, { maxContentLength: 5000 });
      if (content.fetchStatus === 'success' && content.content) {
        const wordCount = content.content.split(/\s+/).length;

        // Simple quality heuristic
        if (wordCount > 1000) contentQuality = 'high';
        else if (wordCount > 300) contentQuality = 'medium';
        else contentQuality = 'low';

        // Check for spam indicators
        const spamPatterns = [
          { pattern: /buy\s+now/i, indicator: 'Aggressive sales language' },
          { pattern: /click\s+here/i, indicator: 'Clickbait phrases' },
          { pattern: /free\s+money/i, indicator: 'Spam-like promises' },
          { pattern: /casino|poker|lottery/i, indicator: 'Gambling content' },
          { pattern: /viagra|cialis/i, indicator: 'Pharmaceutical spam' },
        ];

        for (const { pattern, indicator } of spamPatterns) {
          if (pattern.test(content.content)) {
            spamIndicators.push(indicator);
          }
        }

        // Try to determine niche from title
        if (content.title) {
          originalNiche = content.title.substring(0, 100);
        }
      }
    }

    // Determine publishing frequency
    const publishingFrequency = (() => {
      if (snapshots.length < 2) return 'unknown' as const;
      const trend = getCaptureTrend(snapshots);
      if (trend === 'increasing') return 'weekly' as const;
      if (trend === 'stable') return 'monthly' as const;
      if (trend === 'decreasing') return 'irregular' as const;
      return 'irregular' as const;
    })();

    return {
      domain,
      originalNiche,
      contentQuality,
      spamIndicators,
      historicalHomepage: latestSnapshot,
      businessCategory,
      publishingFrequency,
      totalCaptures: snapshots.length,
      firstCapture: firstSnapshot?.date || null,
      lastCapture: latestSnapshot?.date || null,
    };
  } catch (error: any) {
    console.error(`[Wayback] Domain analysis failed: ${error.message}`);
    return {
      domain,
      originalNiche: '',
      contentQuality: 'unknown',
      spamIndicators: [],
      historicalHomepage: null,
      businessCategory: 'unknown',
      publishingFrequency: 'unknown',
      totalCaptures: 0,
      firstCapture: null,
      lastCapture: null,
    };
  }
};

/**
 * Complete workflow: Generate backlink recovery recommendations.
 *
 * @param url - The deleted URL that has backlinks
 * @param backlinkCount - Number of backlinks pointing to this URL
 * @returns Backlink recovery recommendation
 */
export const getBacklinkRecoveryRecommendation = async (
  url: string,
  backlinkCount: number = 0
): Promise<WaybackBacklinkRecovery> => {
  console.log(`[Wayback] Analyzing backlink recovery for: ${url}`);

  const { checkAvailability } = await import('./wayback/availability');
  const { extractContent } = await import('./wayback/extractor');

  const availability = await checkAvailability(url);

  if (!availability.isAvailable) {
    return {
      url,
      hasBacklinks: backlinkCount > 0,
      backlinkCount,
      recommendation: 'rewrite',
      reason: 'No archived snapshot available - create new content on the topic',
      topic: '',
    };
  }

  const content = availability.snapshot
    ? await extractContent(availability.snapshot, { maxContentLength: 3000 })
    : null;

  const topic = content?.title || content?.content?.substring(0, 100) || '';

  // Determine recommendation based on backlink count and content availability
  let recommendation: 'restore' | 'redirect' | 'merge' | 'rewrite' = 'rewrite';
  let reason = '';
  let suggestedTarget: string | undefined;

  if (backlinkCount > 50 && content?.fetchStatus === 'success') {
    recommendation = 'restore';
    reason = `High-value backlinks (${backlinkCount}) with recoverable content - restore the page`;
  } else if (backlinkCount > 10 && content?.fetchStatus === 'success') {
    recommendation = 'merge';
    reason = `Moderate backlinks (${backlinkCount}) - merge content into a related article`;
    suggestedTarget = 'related-article';
  } else if (backlinkCount > 0) {
    recommendation = 'redirect';
    reason = `Few backlinks (${backlinkCount}) - set up a redirect to relevant content`;
    suggestedTarget = 'relevant-page';
  } else {
    recommendation = 'rewrite';
    reason = 'No significant backlinks - create fresh content on the topic';
  }

  return {
    url,
    hasBacklinks: backlinkCount > 0,
    backlinkCount,
    recommendation,
    reason,
    suggestedTarget,
    topic,
  };
};
