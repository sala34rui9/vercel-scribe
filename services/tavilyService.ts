/**
 * Tavily API Service
 * Provides Search, Extract, and Crawl functionality for AI-powered research
 */

const TAVILY_API_BASE = "https://api.tavily.com";
const LOCAL_STORAGE_KEY = 'user_tavily_api_key';

export const getTavilyApiKey = (): string => {
    const key = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (key && key.trim().length > 0) {
        return key.trim();
    }
    return '';
};

/**
 * Helper to log API diagnostics
 */
const logTavilyDiagnostics = (label: string, error?: Error) => {
    const apiKey = getTavilyApiKey();
    const keyPreview = apiKey ? `${apiKey.substring(0, 8)}...` : 'MISSING';
    console.log(`[Tavily ${label}] API Key: ${keyPreview}`);
    if (error) {
        console.error(`[Tavily ${label}] Error:`, error.message, error);
    }
};

export interface TavilySearchOptions {
    maxResults?: number;
    topic?: 'general' | 'news' | 'finance';
    includeAnswer?: boolean;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
}

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
}

/**
 * Tavily Search API - For real-time search, news, topic research
 * Uses the /search endpoint
 */
export const tavilySearch = async (
    query: string,
    options: TavilySearchOptions = {}
): Promise<{ content: string; sources: string[]; answer?: string }> => {
    const apiKey = getTavilyApiKey();

    if (!apiKey) {
        console.warn('[Tavily] API key is missing for search');
        return { content: '', sources: [] };
    }

    try {
        logTavilyDiagnostics('Search');

        const payload = {
            api_key: apiKey,
            query: query,
            max_results: options.maxResults || 10,
            topic: options.topic || 'general',
            include_answer: options.includeAnswer ?? true,
            search_depth: options.searchDepth || 'basic',
            include_domains: options.includeDomains || [],
            exclude_domains: options.excludeDomains || []
        };

        const response = await fetch(`${TAVILY_API_BASE}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`[Tavily] Search HTTP ${response.status}:`, errorData);

            if (response.status === 401) {
                throw new Error('Tavily API Key is invalid. Check your API key at tavily.com');
            }

            if (response.status === 429) {
                throw new Error('Tavily API rate limit exceeded. Try again later.');
            }

            throw new Error(`Tavily API Error (${response.status}): ${errorData.error || response.statusText}`);
        }

        const data = await response.json();

        // Process results
        const results: TavilySearchResult[] = data.results || [];

        // Build markdown content from results
        const contentLines = results.map((result: TavilySearchResult) => {
            const snippet = result.content ? result.content.substring(0, 300) : 'No description available';
            return `- **${result.title}**: ${snippet}...`;
        });

        const content = contentLines.join('\n');
        const sources = results.map((r: TavilySearchResult) => r.url).filter(Boolean);
        const answer = data.answer || undefined;

        console.log('[Tavily] Search successful:', results.length, 'results');

        return { content, sources, answer };
    } catch (error: any) {
        logTavilyDiagnostics('Search Error', error);
        return { content: '', sources: [] };
    }
};

export interface TavilyExtractOptions {
    extractDepth?: 'basic' | 'advanced';
    includeImages?: boolean;
}

export interface TavilyExtractResult {
    url: string;
    rawContent: string;
    images?: string[];
    failed?: boolean;
    error?: string;
}

/**
 * Tavily Extract API - For extracting content from specific URLs
 * Uses the /extract endpoint
 */
export const tavilyExtract = async (
    urls: string[],
    options: TavilyExtractOptions = {}
): Promise<{ results: TavilyExtractResult[] }> => {
    const apiKey = getTavilyApiKey();

    if (!apiKey) {
        console.warn('[Tavily] API key is missing for extract');
        return { results: [] };
    }

    if (!urls || urls.length === 0) {
        return { results: [] };
    }

    try {
        logTavilyDiagnostics('Extract');

        const payload = {
            api_key: apiKey,
            urls: urls.slice(0, 10), // Limit to 10 URLs per request
            extract_depth: options.extractDepth || 'basic',
            include_images: options.includeImages || false
        };

        const response = await fetch(`${TAVILY_API_BASE}/extract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`[Tavily] Extract HTTP ${response.status}:`, errorData);
            throw new Error(`Tavily Extract Error (${response.status}): ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        const results: TavilyExtractResult[] = data.results || [];

        console.log('[Tavily] Extract successful:', results.length, 'URLs processed');

        return { results };
    } catch (error: any) {
        logTavilyDiagnostics('Extract Error', error);
        return { results: [] };
    }
};

export interface TavilyCrawlOptions {
    instructions?: string;
    maxDepth?: number;
    maxLinks?: number;
}

export interface TavilyCrawlResult {
    url: string;
    content: string;
    title?: string;
}

/**
 * Tavily Crawl API - For website traversal and content extraction
 * Uses the /crawl endpoint (beta)
 * Ideal for brand voice detection, site architecture analysis
 */
export const tavilyCrawl = async (
    url: string,
    options: TavilyCrawlOptions = {}
): Promise<{ content: string; urls: string[]; pages: TavilyCrawlResult[] }> => {
    const apiKey = getTavilyApiKey();

    if (!apiKey) {
        console.warn('[Tavily] API key is missing for crawl');
        return { content: '', urls: [], pages: [] };
    }

    try {
        logTavilyDiagnostics('Crawl');

        const payload = {
            api_key: apiKey,
            url: url,
            instructions: options.instructions || 'Extract main content, brand voice, and site structure',
            max_depth: options.maxDepth || 2,
            max_links: options.maxLinks || 20
        };

        const response = await fetch(`${TAVILY_API_BASE}/crawl`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`[Tavily] Crawl HTTP ${response.status}:`, errorData);

            // Crawl is beta, provide helpful error message
            if (response.status === 404 || response.status === 501) {
                console.warn('[Tavily] Crawl endpoint may not be available. Falling back to extract.');
                // Fallback: Use extract on the single URL
                const extractResult = await tavilyExtract([url]);
                if (extractResult.results.length > 0) {
                    return {
                        content: extractResult.results[0].rawContent || '',
                        urls: [url],
                        pages: [{
                            url: url,
                            content: extractResult.results[0].rawContent || '',
                            title: 'Extracted Content'
                        }]
                    };
                }
                return { content: '', urls: [], pages: [] };
            }

            throw new Error(`Tavily Crawl Error (${response.status}): ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        const pages: TavilyCrawlResult[] = data.results || [];

        // Combine all page content for analysis
        const combinedContent = pages.map(p =>
            `## ${p.title || p.url}\n${p.content}`
        ).join('\n\n---\n\n');

        const crawledUrls = pages.map(p => p.url);

        console.log('[Tavily] Crawl successful:', pages.length, 'pages crawled');

        return {
            content: combinedContent,
            urls: crawledUrls,
            pages
        };
    } catch (error: any) {
        logTavilyDiagnostics('Crawl Error', error);
        return { content: '', urls: [], pages: [] };
    }
};

/**
 * Fetch real-time data using Tavily Search
 * Compatible interface with serpstackService and geminiService
 */
export const fetchRealTimeDataTavily = async (topic: string): Promise<{ content: string; sources: string[] }> => {
    const result = await tavilySearch(topic, {
        maxResults: 10,
        topic: 'news',
        includeAnswer: true,
        searchDepth: 'basic'
    });

    // If we have a direct answer, prepend it to the content
    let content = result.content;
    if (result.answer) {
        content = `**Summary:** ${result.answer}\n\n**Sources:**\n${result.content}`;
    }

    return { content, sources: result.sources };
};

/**
 * Scan for external links using Tavily Search
 * Returns authoritative sources for the given topic
 */
export const scanForExternalLinksTavily = async (
    topic: string,
    excludeDomain?: string
): Promise<Array<{ title: string; url: string; snippet?: string }>> => {
    const options: TavilySearchOptions = {
        maxResults: 15,
        topic: 'general',
        searchDepth: 'advanced'
    };

    if (excludeDomain) {
        options.excludeDomains = [excludeDomain];
    }

    const result = await tavilySearch(`${topic} authoritative sources research`, options);

    // Parse results back into link format
    const links: Array<{ title: string; url: string; snippet?: string }> = [];

    // We need to re-fetch to get structured results
    const apiKey = getTavilyApiKey();
    if (!apiKey) return [];

    try {
        const response = await fetch(`${TAVILY_API_BASE}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query: `${topic} authoritative sources`,
                max_results: 15,
                search_depth: 'advanced',
                exclude_domains: excludeDomain ? [excludeDomain] : []
            })
        });

        if (response.ok) {
            const data = await response.json();
            const results: TavilySearchResult[] = data.results || [];

            for (const r of results) {
                links.push({
                    title: r.title,
                    url: r.url,
                    snippet: r.content?.substring(0, 150) || 'External source'
                });
            }
        }
    } catch (e) {
        console.warn('[Tavily] External link scan error:', e);
    }

    return links.slice(0, 15);
};

/**
 * Extract content from manual reference URLs
 * Used when user provides specific URLs for research
 */
export const extractManualReferences = async (
    urls: string[]
): Promise<{ content: string; sources: string[] }> => {
    if (!urls || urls.length === 0) {
        return { content: '', sources: [] };
    }

    const result = await tavilyExtract(urls, { extractDepth: 'advanced' });

    const successfulResults = result.results.filter(r => !r.failed && r.rawContent);

    const content = successfulResults.map(r =>
        `### Reference: ${r.url}\n${r.rawContent?.substring(0, 1000) || 'Content not available'}...`
    ).join('\n\n');

    const sources = successfulResults.map(r => r.url);

    return { content, sources };
};

/**
 * Analyze brand website using Tavily Crawl
 * Used for deep research to understand brand voice and site architecture
 */
export const analyzeBrandWebsite = async (
    websiteUrl: string
): Promise<{
    brandVoice: string;
    siteArchitecture: string[];
    content: string
}> => {
    const crawlResult = await tavilyCrawl(websiteUrl, {
        instructions: 'Analyze brand voice, tone, key messaging, and site structure. Identify main sections and content themes.',
        maxDepth: 2,
        maxLinks: 15
    });

    if (!crawlResult.content) {
        return { brandVoice: '', siteArchitecture: [], content: '' };
    }

    // Extract site architecture (URLs found)
    const siteArchitecture = crawlResult.urls;

    // The crawled content contains brand information
    // In a more advanced implementation, we could use AI to extract brand voice
    const brandVoice = `Based on site analysis of ${websiteUrl}`;

    return {
        brandVoice,
        siteArchitecture,
        content: crawlResult.content
    };
};
