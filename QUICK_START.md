# Quick Start Guide

## 🚀 Get Your Protected Backend Running in 15 Minutes

### Step 1: Install Supabase CLI (2 minutes)
```bash
npm install -g supabase
```

### Step 2: Create Supabase Project (3 minutes)
1. Go to https://supabase.com
2. Click "New Project"
3. Name it and create
4. Copy your Project URL and anon key

### Step 3: Set Up Environment (2 minutes)
Create `.env.local`:
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Deploy Backend (5 minutes)
```bash
# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Set API keys (CRITICAL - These are now server-side only!)
supabase secrets set GEMINI_API_KEY=your_gemini_key
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_key
supabase secrets set TAVILY_API_KEY=your_tavily_key

# Deploy functions
supabase functions deploy generate-article
supabase functions deploy extract-keywords
supabase functions deploy scan-links
```

### Step 5: Install Frontend Dependency (1 minute)
```bash
npm install @supabase/supabase-js
```

### Step 6: Test (2 minutes)
```bash
npm run dev
```

Open your app and try generating an article!

---

## ✅ Verification Checklist

After setup, verify everything is protected:

1. **Open Browser DevTools → Network Tab**
2. **Generate an article**
3. **Check that:**
   - ✅ No API keys visible in requests
   - ✅ No prompts visible in requests
   - ✅ Only results are returned
   - ✅ Requests go to `supabase.co` domain

---

## 🔒 What's Protected Now

| Before | After |
|--------|-------|
| API keys in localStorage | ✅ Server-side secrets |
| Prompts in browser code | ✅ Backend functions |
| Logic visible to all | ✅ Black box |

---

## 📚 Next Steps

1. **Read**: `SUPABASE_SETUP.md` for detailed instructions
2. **Follow**: `MIGRATION_CHECKLIST.md` for step-by-step migration
3. **Understand**: `SECURITY_ARCHITECTURE.md` for how protection works

---

## 🆘 Need Help?

**Common Issues:**

1. **"Unauthorized" error**
   - Make sure you're logged in (if auth is enabled)
   - Check that Authorization header is being sent

2. **"API key missing" error**
   ```bash
   # Verify secrets are set
   supabase secrets list
   
   # Re-set if needed
   supabase secrets set GEMINI_API_KEY=your_key
   ```

3. **Function not found**
   ```bash
   # Check deployed functions
   supabase functions list
   
   # Redeploy if needed
   supabase functions deploy generate-article
   ```

4. **CORS errors**
   - Check that `corsHeaders` are in all responses
   - Verify OPTIONS requests are handled

---

## 🎉 Success!

Your intellectual property is now protected! Competitors can't see:
- ❌ Your AI prompts
- ❌ Your API keys
- ❌ Your business logic
- ❌ Your strategies

**Time to build and dominate!** 🚀
