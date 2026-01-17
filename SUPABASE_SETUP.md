# Supabase Backend Setup Guide

## 🔒 What This Protects

Your Supabase backend now protects:
- ✅ **AI Prompts & Strategies** - Your competitive advantage
- ✅ **API Keys** - Gemini, DeepSeek, Tavily keys are server-side only
- ✅ **Business Logic** - All algorithms run on Supabase servers
- ✅ **Link Scanning Strategies** - Your research methods are hidden
- ✅ **Keyword Extraction Logic** - Your SEO strategies are protected

**What competitors CAN'T see anymore:**
- Your AI prompts and instructions
- Your API keys
- How you process data
- Your optimization techniques
- Your secret sauce

---

## 📋 Prerequisites

1. **Supabase Account** - Sign up at https://supabase.com
2. **Supabase CLI** - Install globally:
   ```bash
   npm install -g supabase
   ```
3. **Git** - For version control

---

## 🚀 Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: `seo-scribe-backend` (or your choice)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait 2-3 minutes for setup to complete

---

## 🔑 Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

3. Create `.env.local` file in your project root:
   ```bash
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## 🔐 Step 3: Set Up Authentication (Optional but Recommended)

### Enable Email Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates if desired

### Enable Google OAuth (Optional)

1. Go to **Authentication** → **Providers**
2. Enable **Google** provider
3. Follow instructions to set up Google OAuth credentials

---

## 🛠️ Step 4: Deploy Your Backend Functions

### Login to Supabase CLI

```bash
supabase login
```

This will open a browser for authentication.

### Link Your Project

```bash
supabase link --project-ref your-project-ref
```

**To find your project ref:**
- Go to your Supabase dashboard
- Look at the URL: `https://app.supabase.com/project/YOUR-PROJECT-REF`
- Or go to **Settings** → **General** → **Reference ID**

### Set Your API Keys as Secrets

**CRITICAL:** Your AI API keys must be stored as Supabase secrets (server-side only).

```bash
# Set Gemini API Key
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here

# Set DeepSeek API Key
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Set Tavily API Key
supabase secrets set TAVILY_API_KEY=your_tavily_api_key_here
```

**Verify secrets were set:**
```bash
supabase secrets list
```

### Deploy All Functions

```bash
# Deploy all functions at once
supabase functions deploy generate-article
supabase functions deploy extract-keywords
supabase functions deploy scan-links
```

**Expected output:**
```
Deploying function generate-article...
Function generate-article deployed successfully!
URL: https://xxxxx.supabase.co/functions/v1/generate-article
```

---

## 📦 Step 5: Install Frontend Dependencies

```bash
npm install @supabase/supabase-js
```

---

## 🔄 Step 6: Update Your Frontend Code

### Update ArticleForm.tsx

Replace the old service imports with the new Supabase client:

```typescript
// OLD (Remove these):
// import { generateArticle } from '../services/geminiService';
// import { generateArticleDeepSeek } from '../services/deepseekService';

// NEW (Add this):
import { generateArticle } from '../services/supabaseClient';
```

The function signature remains the same, so your existing code should work without changes!

### Update Layout.tsx

Remove API key input fields (they're now server-side):

```typescript
// REMOVE: Gemini API Key input
// REMOVE: DeepSeek API Key input
// REMOVE: Tavily API Key input

// These are now stored securely in Supabase secrets
```

---

## ✅ Step 7: Test Your Setup

### Test Locally

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your app in the browser

3. Try generating an article:
   - Enter a topic
   - Click "Generate Article"
   - Check browser console for any errors

### Test Backend Functions Directly

You can test functions using curl:

```bash
# Test keyword extraction
curl -X POST 'https://xxxxx.supabase.co/functions/v1/extract-keywords' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "topic": "AI content writing",
    "aiProvider": "gemini",
    "keywordType": "primary"
  }'
```

---

## 🚀 Step 8: Deploy to Production

### Update Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Go to **Settings** → **Environment Variables**
3. Add:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key

4. Redeploy your app:
   ```bash
   git add .
   git commit -m "Migrate to Supabase backend"
   git push
   ```

---

## 🔍 Monitoring & Debugging

### View Function Logs

```bash
# View logs for a specific function
supabase functions logs generate-article

# Follow logs in real-time
supabase functions logs generate-article --follow
```

### Check Function Status

```bash
supabase functions list
```

### Test Function Locally (Before Deploying)

```bash
# Serve functions locally
supabase functions serve

# Test locally at http://localhost:54321/functions/v1/generate-article
```

---

## 🔒 Security Best Practices

### ✅ What's Protected Now

1. **API Keys**: Stored in Supabase secrets (server-side only)
2. **AI Prompts**: In backend functions (invisible to users)
3. **Business Logic**: Runs on Supabase servers (black box)
4. **Authentication**: Required for all function calls

### ✅ Additional Security Measures

1. **Enable Row Level Security (RLS)** on any database tables you create
2. **Set up rate limiting** in Supabase dashboard
3. **Monitor usage** in Supabase dashboard → **Usage**
4. **Rotate API keys** periodically

---

## 💰 Cost Considerations

### Supabase Pricing

- **Free Tier**: 
  - 500K Edge Function invocations/month
  - 2GB database storage
  - 50GB bandwidth
  - Perfect for getting started!

- **Pro Tier** ($25/month):
  - 2M Edge Function invocations/month
  - 8GB database storage
  - 250GB bandwidth

### Monitoring Usage

1. Go to **Settings** → **Usage**
2. Monitor:
   - Edge Function invocations
   - Database storage
   - Bandwidth

---

## 🐛 Troubleshooting

### "Unauthorized" Error

**Problem**: Function returns 401 Unauthorized

**Solution**:
1. Make sure user is logged in
2. Check that `Authorization` header is being sent
3. Verify JWT token is valid

### "API Key Missing" Error

**Problem**: Function can't find API keys

**Solution**:
```bash
# Verify secrets are set
supabase secrets list

# Re-set if needed
supabase secrets set GEMINI_API_KEY=your_key
```

### Function Timeout

**Problem**: Function takes too long and times out

**Solution**:
- Edge Functions have a 150-second timeout
- For long-running tasks, consider breaking into smaller functions
- Use streaming responses for real-time updates

### CORS Errors

**Problem**: Browser blocks requests due to CORS

**Solution**:
- Check that `corsHeaders` are included in all responses
- Verify `OPTIONS` preflight requests are handled

---

## 📚 Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **Edge Functions Guide**: https://supabase.com/docs/guides/functions
- **Authentication Guide**: https://supabase.com/docs/guides/auth
- **Supabase CLI Reference**: https://supabase.com/docs/reference/cli

---

## 🎉 Success!

Your app is now protected! Competitors can:
- ❌ NOT see your AI prompts
- ❌ NOT steal your API keys
- ❌ NOT copy your business logic
- ❌ NOT reverse engineer your strategies

They can only see:
- ✅ Your UI design (which you can copyright)
- ✅ Generic API endpoint names (but not what they do)
- ✅ Your general concept (protect with execution speed)

**Your intellectual property is now safe!** 🔒
