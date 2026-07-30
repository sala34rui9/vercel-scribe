import { describe, it, expect } from 'vitest';
import {
  groupSnapshotsByYear,
  groupSnapshotsByMonth,
  buildTimeline,
  buildCompactTimeline,
  getCaptureTrend,
  generateTimelineSummary,
  selectRepresentativeSnapshots,
  findClosestSnapshot,
} from '../wayback/timeline';
import type { WaybackSnapshot, WaybackTimeline } from '../../types';

// Helper to create test snapshots
const createSnapshot = (dateStr: string, url: string = 'https://example.com'): WaybackSnapshot => ({
  url,
  snapshotUrl: `https://web.archive.org/web/${dateStr.replace(/[-T:Z]/g, '').substring(0, 14)}/${url}`,
  timestamp: dateStr,
  date: new Date(dateStr),
  statusCode: 200,
  mimeType: 'text/html',
  length: 1000,
  isAvailable: true,
});

describe('groupSnapshotsByYear', () => {
  it('groups snapshots by year', () => {
    const snapshots = [
      createSnapshot('2024-01-15T12:00:00Z'),
      createSnapshot('2024-06-15T12:00:00Z'),
      createSnapshot('2023-01-15T12:00:00Z'),
      createSnapshot('2022-01-15T12:00:00Z'),
    ];
    const groups = groupSnapshotsByYear(snapshots);
    expect(groups.size).toBe(3);
    expect(groups.get(2024)).toHaveLength(2);
    expect(groups.get(2023)).toHaveLength(1);
    expect(groups.get(2022)).toHaveLength(1);
  });

  it('returns empty map for empty array', () => {
    const groups = groupSnapshotsByYear([]);
    expect(groups.size).toBe(0);
  });
});

describe('groupSnapshotsByMonth', () => {
  it('groups snapshots by year-month', () => {
    const snapshots = [
      createSnapshot('2024-01-15T12:00:00Z'),
      createSnapshot('2024-01-20T12:00:00Z'),
      createSnapshot('2024-02-15T12:00:00Z'),
      createSnapshot('2023-12-15T12:00:00Z'),
    ];
    const groups = groupSnapshotsByMonth(snapshots);
    expect(groups.size).toBe(3);
    expect(groups.get('2024-01')).toHaveLength(2);
    expect(groups.get('2024-02')).toHaveLength(1);
    expect(groups.get('2023-12')).toHaveLength(1);
  });
});

describe('buildTimeline', () => {
  it('builds complete timeline from snapshots', () => {
    const snapshots = [
      createSnapshot('2024-01-15T12:00:00Z'),
      createSnapshot('2024-06-15T12:00:00Z'),
      createSnapshot('2023-01-15T12:00:00Z'),
      createSnapshot('2022-01-15T12:00:00Z'),
    ];
    const timeline = buildTimeline('https://example.com', snapshots);

    expect(timeline.url).toBe('https://example.com');
    expect(timeline.totalCaptures).toBe(4);
    expect(timeline.firstCapture).toEqual(new Date('2022-01-15T12:00:00Z'));
    expect(timeline.lastCapture).toEqual(new Date('2024-06-15T12:00:00Z'));
    expect(timeline.timeline).toHaveLength(3); // 3 years
    expect(timeline.timeline[0].year).toBe(2024); // Newest first
    expect(timeline.timeline[0].count).toBe(2);
    expect(timeline.timeline[1].year).toBe(2023);
    expect(timeline.timeline[2].year).toBe(2022);
  });

  it('returns empty timeline for no snapshots', () => {
    const timeline = buildTimeline('https://example.com', []);
    expect(timeline.totalCaptures).toBe(0);
    expect(timeline.firstCapture).toBeNull();
    expect(timeline.lastCapture).toBeNull();
    expect(timeline.timeline).toEqual([]);
  });

  it('sorts snapshots within each year', () => {
    const snapshots = [
      createSnapshot('2024-06-15T12:00:00Z'),
      createSnapshot('2024-01-15T12:00:00Z'),
      createSnapshot('2024-03-15T12:00:00Z'),
    ];
    const timeline = buildTimeline('https://example.com', snapshots);
    expect(timeline.timeline[0].snapshots[0].date.getMonth()).toBe(0); // January
    expect(timeline.timeline[0].snapshots[1].date.getMonth()).toBe(2); // March
    expect(timeline.timeline[0].snapshots[2].date.getMonth()).toBe(5); // June
  });
});

describe('buildCompactTimeline', () => {
  it('builds timeline without individual snapshots', () => {
    const snapshots = [
      createSnapshot('2024-01-15T12:00:00Z'),
      createSnapshot('2023-01-15T12:00:00Z'),
    ];
    const timeline = buildCompactTimeline('https://example.com', snapshots);
    expect(timeline.totalCaptures).toBe(2);
    expect(timeline.timeline).toHaveLength(2);
    expect(timeline.timeline[0].snapshots).toEqual([]);
    expect(timeline.timeline[0].count).toBe(1);
  });
});

describe('getCaptureTrend', () => {
  it('returns increasing when captures grow over time', () => {
    const snapshots = [
      createSnapshot('2020-01-01T12:00:00Z'),
      createSnapshot('2021-01-01T12:00:00Z'),
      createSnapshot('2022-01-01T12:00:00Z'),
      createSnapshot('2022-06-01T12:00:00Z'),
      createSnapshot('2023-01-01T12:00:00Z'),
      createSnapshot('2023-06-01T12:00:00Z'),
      createSnapshot('2023-09-01T12:00:00Z'),
      createSnapshot('2024-01-01T12:00:00Z'),
      createSnapshot('2024-03-01T12:00:00Z'),
      createSnapshot('2024-06-01T12:00:00Z'),
      createSnapshot('2024-09-01T12:00:00Z'),
      createSnapshot('2024-12-01T12:00:00Z'),
    ];
    const trend = getCaptureTrend(snapshots);
    expect(trend).toBe('increasing');
  });

  it('returns irregular for insufficient data', () => {
    const snapshots = [
      createSnapshot('2024-01-01T12:00:00Z'),
      createSnapshot('2024-06-01T12:00:00Z'),
    ];
    const trend = getCaptureTrend(snapshots);
    expect(trend).toBe('irregular');
  });
});

describe('generateTimelineSummary', () => {
  it('generates summary for populated timeline', () => {
    const timeline: WaybackTimeline = {
      url: 'https://example.com',
      totalCaptures: 50,
      firstCapture: new Date('2020-01-01'),
      lastCapture: new Date('2024-12-01'),
      timeline: [
        { year: 2024, snapshots: [], count: 20 },
        { year: 2023, snapshots: [], count: 15 },
        { year: 2022, snapshots: [], count: 10 },
        { year: 2021, snapshots: [], count: 3 },
        { year: 2020, snapshots: [], count: 2 },
      ],
    };
    const summary = generateTimelineSummary(timeline);
    expect(summary).toContain('50 captures');
    expect(summary).toContain('2020-2024');
    expect(summary).toContain('Peak year: 2024');
  });

  it('generates message for empty timeline', () => {
    const timeline: WaybackTimeline = {
      url: 'https://example.com',
      totalCaptures: 0,
      firstCapture: null,
      lastCapture: null,
      timeline: [],
    };
    const summary = generateTimelineSummary(timeline);
    expect(summary).toContain('No archived captures');
  });
});

describe('selectRepresentativeSnapshots', () => {
  it('selects evenly spaced snapshots', () => {
    const snapshots = Array.from({ length: 20 }, (_, i) =>
      createSnapshot(`2024-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`)
    );
    const selected = selectRepresentativeSnapshots(snapshots, 5);
    expect(selected).toHaveLength(5);
    expect(selected[0].date.getDate()).toBe(1); // First
    expect(selected[4].date.getDate()).toBe(20); // Last
  });

  it('returns all snapshots if count >= length', () => {
    const snapshots = [
      createSnapshot('2024-01-01T12:00:00Z'),
      createSnapshot('2024-01-02T12:00:00Z'),
    ];
    const selected = selectRepresentativeSnapshots(snapshots, 5);
    expect(selected).toHaveLength(2);
  });
});

describe('findClosestSnapshot', () => {
  it('finds closest snapshot to target date', () => {
    const snapshots = [
      createSnapshot('2024-01-01T12:00:00Z'),
      createSnapshot('2024-06-01T12:00:00Z'),
      createSnapshot('2024-12-01T12:00:00Z'),
    ];
    const target = new Date('2024-05-15T12:00:00Z');
    const closest = findClosestSnapshot(snapshots, target);
    expect(closest?.date.getMonth()).toBe(5); // June (index 5)
  });

  it('returns null for empty array', () => {
    const closest = findClosestSnapshot([], new Date());
    expect(closest).toBeNull();
  });
});
