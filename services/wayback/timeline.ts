/**
 * Wayback Machine Timeline Builder
 * Groups historical snapshots into a structured timeline for UI display.
 *
 * Provides functions to:
 * - Group snapshots by year/month
 * - Build timeline entries for the Snapshot Timeline component
 * - Calculate capture frequency and trends
 * - Generate timeline summaries
 */

import type {
  WaybackSnapshot,
  WaybackTimeline,
  WaybackTimelineEntry,
} from '../../types';

/**
 * Groups snapshots by year.
 * Returns a Map where keys are years and values are arrays of snapshots.
 */
export const groupSnapshotsByYear = (
  snapshots: WaybackSnapshot[]
): Map<number, WaybackSnapshot[]> => {
  const groups = new Map<number, WaybackSnapshot[]>();

  for (const snapshot of snapshots) {
    const year = snapshot.date.getFullYear();
    const existing = groups.get(year) || [];
    existing.push(snapshot);
    groups.set(year, existing);
  }

  return groups;
};

/**
 * Groups snapshots by year and month.
 * Returns a Map where keys are "YYYY-MM" and values are arrays of snapshots.
 */
export const groupSnapshotsByMonth = (
  snapshots: WaybackSnapshot[]
): Map<string, WaybackSnapshot[]> => {
  const groups = new Map<string, WaybackSnapshot[]>();

  for (const snapshot of snapshots) {
    const year = snapshot.date.getFullYear();
    const month = String(snapshot.date.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    const existing = groups.get(key) || [];
    existing.push(snapshot);
    groups.set(key, existing);
  }

  return groups;
};

/**
 * Builds a timeline entry for a single year.
 */
const buildTimelineEntry = (
  year: number,
  snapshots: WaybackSnapshot[]
): WaybackTimelineEntry => {
  // Sort snapshots within the year by date (oldest first)
  const sorted = [...snapshots].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    year,
    snapshots: sorted,
    count: sorted.length,
  };
};

/**
 * Builds a complete timeline from an array of snapshots.
 * This is the primary function for creating timeline data for the UI.
 *
 * @param url - The original URL
 * @param snapshots - Array of WaybackSnapshot objects
 * @returns WaybackTimeline with grouped entries
 *
 * @example
 * const timeline = buildTimeline('https://example.com', snapshots);
 * timeline.timeline.forEach(entry => {
 *   console.log(`${entry.year}: ${entry.count} captures`);
 * });
 */
export const buildTimeline = (
  url: string,
  snapshots: WaybackSnapshot[]
): WaybackTimeline => {
  if (snapshots.length === 0) {
    return {
      url,
      totalCaptures: 0,
      firstCapture: null,
      lastCapture: null,
      timeline: [],
    };
  }

  // Sort all snapshots by date
  const sorted = [...snapshots].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstCapture = sorted[0].date;
  const lastCapture = sorted[sorted.length - 1].date;

  // Group by year
  const yearGroups = groupSnapshotsByYear(sorted);

  // Build timeline entries sorted by year descending (newest first)
  const timeline: WaybackTimelineEntry[] = [];
  const years = Array.from(yearGroups.keys()).sort((a, b) => b - a);

  for (const year of years) {
    const yearSnapshots = yearGroups.get(year)!;
    timeline.push(buildTimelineEntry(year, yearSnapshots));
  }

  return {
    url,
    totalCaptures: snapshots.length,
    firstCapture,
    lastCapture,
    timeline,
  };
};

/**
 * Builds a compact timeline with one entry per year showing only the count.
 * Useful for overview displays where individual snapshots aren't needed.
 */
export const buildCompactTimeline = (
  url: string,
  snapshots: WaybackSnapshot[]
): WaybackTimeline => {
  const fullTimeline = buildTimeline(url, snapshots);

  return {
    ...fullTimeline,
    timeline: fullTimeline.timeline.map(entry => ({
      ...entry,
      snapshots: [], // Omit individual snapshots for compact view
    })),
  };
};

/**
 * Gets the capture frequency trend.
 * Analyzes whether captures are increasing, decreasing, or stable over time.
 */
export const getCaptureTrend = (
  snapshots: WaybackSnapshot[]
): 'increasing' | 'decreasing' | 'stable' | 'irregular' => {
  if (snapshots.length < 6) return 'irregular';

  const yearGroups = groupSnapshotsByYear(snapshots);
  const years = Array.from(yearGroups.keys()).sort((a, b) => a - b);

  if (years.length < 3) return 'irregular';

  // Calculate captures per year
  const counts = years.map(year => yearGroups.get(year)!.length);

  // Simple trend analysis: compare first half vs second half
  const mid = Math.floor(counts.length / 2);
  const firstHalfAvg = counts.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const secondHalfAvg = counts.slice(mid).reduce((a, b) => a + b, 0) / (counts.length - mid);

  const ratio = secondHalfAvg / firstHalfAvg;

  if (ratio > 1.5) return 'increasing';
  if (ratio < 0.67) return 'decreasing';
  return 'stable';
};

/**
 * Generates a summary of the timeline for display.
 */
export const generateTimelineSummary = (timeline: WaybackTimeline): string => {
  if (timeline.totalCaptures === 0) {
    return 'No archived captures found for this URL.';
  }

  const yearRange = timeline.firstCapture && timeline.lastCapture
    ? `${timeline.firstCapture.getFullYear()}-${timeline.lastCapture.getFullYear()}`
    : 'unknown period';

  const peakYear = timeline.timeline.reduce((max, entry) =>
    entry.count > max.count ? entry : max
  , timeline.timeline[0]);

  return [
    `${timeline.totalCaptures} captures from ${yearRange}`,
    `${timeline.timeline.length} years archived`,
    peakYear ? `Peak year: ${peakYear.year} (${peakYear.count} captures)` : '',
  ].filter(Boolean).join(' | ');
};

/**
 * Selects representative snapshots from a timeline.
 * Picks the first, last, and evenly spaced snapshots in between.
 *
 * @param snapshots - Full array of snapshots
 * @param count - Number of representative snapshots to select (default: 5)
 * @returns Array of representative snapshots
 */
export const selectRepresentativeSnapshots = (
  snapshots: WaybackSnapshot[],
  count: number = 5
): WaybackSnapshot[] => {
  if (snapshots.length <= count) return snapshots;

  const sorted = [...snapshots].sort((a, b) => a.date.getTime() - b.date.getTime());
  const step = (sorted.length - 1) / (count - 1);
  const selected: WaybackSnapshot[] = [];

  for (let i = 0; i < count; i++) {
    const index = Math.round(i * step);
    selected.push(sorted[Math.min(index, sorted.length - 1)]);
  }

  return selected;
};

/**
 * Finds the closest snapshot to a given date.
 *
 * @param snapshots - Array of snapshots to search
 * @param targetDate - The target date to find closest to
 * @returns The closest snapshot or null if no snapshots
 */
export const findClosestSnapshot = (
  snapshots: WaybackSnapshot[],
  targetDate: Date
): WaybackSnapshot | null => {
  if (snapshots.length === 0) return null;

  let closest = snapshots[0];
  let minDiff = Math.abs(snapshots[0].date.getTime() - targetDate.getTime());

  for (let i = 1; i < snapshots.length; i++) {
    const diff = Math.abs(snapshots[i].date.getTime() - targetDate.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closest = snapshots[i];
    }
  }

  return closest;
};
