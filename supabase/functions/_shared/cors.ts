// CORS headers for Supabase Edge Functions
// Allows your frontend to communicate with backend

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
