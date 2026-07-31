import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callDeepSeek } from '../serpAnalysisService';
import { callBynaraApi } from '../bynaraService';
import { AIProvider } from '../../types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

vi.mock('../bynaraService', async () => {
  const actual = await vi.importActual<typeof import('../bynaraService')>('../bynaraService');
  return {
    ...actual,
    callBynaraApi: vi.fn(),
  };
});

describe('callDeepSeek', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('routes Bynara requests through the edge proxy instead of direct fetch', async () => {
    const mockCallBynaraApi = vi.mocked(callBynaraApi);
    mockCallBynaraApi.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok": true}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    localStorage.setItem('user_bynara_api_key', 'test-bynara-key');
    localStorage.setItem('seo_scribe_provider', 'Bynara');

    const result = await callDeepSeek('Analyze this', {
      forceProvider: AIProvider.BYNARA,
      bynaraModel: 'mistral-large',
    });

    expect(mockCallBynaraApi).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });
});
