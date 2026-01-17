/**
 * Supabase Client for Protected Backend Functions
 * 
 * This file contains ONLY API calls - no sensitive logic or prompts.
 * All your intellectual property is now protected on Supabase servers.
 */

import { createClient } from '@supabase/supabase-js';
import { ArticleConfig, InternalLink, ExternalLink } from '../types';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Generate Primary Keywords
 * Calls protected backend function
 */
export const generatePrimaryKeywords = async (topic: string, aiProvider: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('extract-keywords', {
      body: {
        topic,
        aiProvider,
        keywordType: 'primary'
      }
    });

    if (error) throw error;
    return data.keywords || [];
  } catch (error) {
    console.error('Error generating primary keywords:', error);
    return [];
  }
};

/**
 * Generate NLP Keywords
 * Calls protected backend function
 */
export const generateNLPKeywords = async (topic: string, aiProvider: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('extract-keywords', {
      body: {
        topic,
        aiProvider,
        keywordType: 'nlp'
      }
    });

    if (error) throw error;
    return data.keywords || [];
  } catch (error) {
    console.error('Error generating NLP keywords:', error);
    return [];
  }
};

/**
 * Generate Full SEO Strategy
 * Calls protected backend function
 */
export const generateFullSEOStrategy = async (
  topic: string, 
  aiProvider: string
): Promise<{ primaryKeywords: string[], nlpKeywords: string[] }> => {
  try {
    const { data, error } = await supabase.functions.invoke('extract-keywords', {
      body: {
        topic,
        aiProvider,
        keywordType: 'full'
      }
    });

    if (error) throw error;
    return {
      primaryKeywords: data.primaryKeywords || [],
      nlpKeywords: data.nlpKeywords || []
    };
  } catch (error) {
    console.error('Error generating full SEO strategy:', error);
    return { primaryKeywords: [], nlpKeywords: [] };
  }
};

/**
 * Scan for Internal Links
 * Calls protected backend function
 */
export const scanForInternalLinks = async (
  websiteUrl: string,
  topic: string,
  keywords: string[] = [],
  deepResearch = false
): Promise<{ links: InternalLink[], opportunities: any[] }> => {
  try {
    const { data, error } = await supabase.functions.invoke('scan-links', {
      body: {
        scanType: 'internal',
        websiteUrl,
        topic,
        keywords,
        deepResearch
      }
    });

    if (error) throw error;
    return {
      links: data.links || [],
      opportunities: data.opportunities || []
    };
  } catch (error) {
    console.error('Error scanning internal links:', error);
    return { links: [], opportunities: [] };
  }
};

/**
 * Scan for External Links
 * Calls protected backend function
 */
export const scanForExternalLinks = async (
  topic: string,
  excludeDomain?: string
): Promise<ExternalLink[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('scan-links', {
      body: {
        scanType: 'external',
        topic,
        excludeDomain
      }
    });

    if (error) throw error;
    return data.links || [];
  } catch (error) {
    console.error('Error scanning external links:', error);
    return [];
  }
};

/**
 * Generate Full Article
 * Calls protected backend function with all your secret prompts
 */
export const generateArticle = async (
  config: ArticleConfig,
  signal?: AbortSignal
): Promise<{ content: string; sources: string[] }> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-article', {
      body: config
    });

    if (error) throw error;
    return {
      content: data.content || '',
      sources: data.sources || []
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new DOMException('Aborted', 'AbortError');
    }
    console.error('Error generating article:', error);
    throw new Error('Failed to generate article. Please try again.');
  }
};

/**
 * Authentication helpers
 */
export const signUp = async (email: string, password: string) => {
  return await supabase.auth.signUp({ email, password });
};

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
