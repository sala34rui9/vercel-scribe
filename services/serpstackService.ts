const SERPSTACK_API_URL = "https://api.serpstack.com/search";
const LOCAL_STORAGE_KEY = 'user_serpstack_api_key';

export const getSERPStackApiKey = (): string => {
  const key = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (key && key.trim().length > 0) {
    return key.trim();
  }
  return '';
};

/**
 * Fetch real-time data and news using SERPStack API
 */
export const fetchRealTimeDataSERPStack = async (topic: string): Promise<{ content: string; sources: string[] }> => {
  const apiKey = getSERPStackApiKey();
  
  if (!apiKey) {
    console.warn('[SERPStack] API key is missing');
    return { content: '', sources: [] };
  }

  try {
    const query = `${topic} latest news trends`;
    const url = new URL(SERPSTACK_API_URL);
    url.searchParams.append('access_key', apiKey);
    url.searchParams.append('query', query);
    url.searchParams.append('num', '10');
    url.searchParams.append('type', 'news');
    url.searchParams.append('gl', 'us');
    url.searchParams.append('page', '1');

    console.log('[SERPStack] Fetching real-time data for:', topic);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[SERPStack] HTTP ${response.status}:`, errorData);

      if (response.status === 401) {
        throw new Error('SERPStack API Key is invalid. Check your API key at serpstack.com');
      }

      if (response.status === 429) {
        throw new Error('SERPStack API rate limit exceeded. Try again later.');
      }

      throw new Error(`SERPStack API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    if (!data.organic_results || data.organic_results.length === 0) {
      console.warn('[SERPStack] No results found for topic:', topic);
      return { content: '', sources: [] };
    }

    // Extract top 5-10 results
    const results = data.organic_results.slice(0, 10);
    
    // Build markdown content from results
    const contentLines = results.map((result: any) => {
      const snippet = result.snippet ? result.snippet.substring(0, 200) : 'No description available';
      return `- **${result.title}**: ${snippet}...`;
    });

    const content = contentLines.join('\n');

    // Extract sources (URLs)
    const sources = results
      .map((result: any) => result.link)
      .filter((link: string) => !!link);

    console.log('[SERPStack] Successfully fetched', results.length, 'results');
    
    return { content, sources };
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[SERPStack] Network error:', error);
      return { content: '', sources: [] };
    }

    console.error('[SERPStack] Error fetching real-time data:', error);
    return { content: '', sources: [] };
  }
};
