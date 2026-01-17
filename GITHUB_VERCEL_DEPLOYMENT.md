# GitHub + Vercel Deployment Guide

## 🎯 Overview

You already have:
- ✅ Code in GitHub
- ✅ Vercel connected to your GitHub repo
- ✅ Auto-deployment set up

Now you need to:
1. Deploy Supabase backend (one-time setup)
2. Update Vercel environment variables
3. Push to GitHub (auto-deploys as usual)

**Total Time**: 20 minutes

---

## 📋 Prerequisites

Before starting, make sure you have:
- [ ] GitHub account with your repo
- [ ] Vercel account connected to GitHub
- [ ] Your current API keys (Gemini, DeepSeek, Tavily)

---

## 🚀 Step-by-Step Deployment

### Step 1: Create Supabase Project (5 minutes)

1. **Go to Supabase**
   - Visit: https://supabase.com
   - Click "Start your project"
   - Sign in with GitHub (recommended)

2. **Create New Project**
   - Click "New Project"
   - **Organization**: Select or create one
   - **Name**: `seo-scribe-backend` (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users (e.g., US East, Europe West)
   - Click "Create new project"

3. **Wait for Setup**
   - Takes 2-3 minutes
   - You'll see a progress indicator
   - Don't close the tab!

4. **Get Your API Keys**
   - Once ready, go to **Settings** (gear icon) → **API**
   - Copy these two values:
     - **Project URL**: `https://xxxxx.supabase.co`
     - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Save them in a notepad temporarily

---

### Step 2: Install Supabase CLI (2 minutes)

Open your terminal and run:

```bash
# Install Supabase CLI globally
npm install -g supabase

# Verify installation
supabase --version
```

**Expected output**: `supabase version 1.x.x`

---

### Step 3: Login and Link Project (2 minutes)

```bash
# Login to Supabase (opens browser)
supabase login

# Navigate to your project folder
cd /path/to/your/project

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

**To find your Project Ref:**
- In Supabase dashboard, look at the URL
- Format: `https://app.supabase.com/project/YOUR_PROJECT_REF`
- Or go to **Settings** → **General** → **Reference ID**

**Example**:
```bash
supabase link --project-ref abcdefghijklmnop
```

---

### Step 4: Set Your API Keys as Supabase Secrets (3 minutes)

**CRITICAL**: Your API keys must be stored as Supabase secrets (server-side only).

```bash
# Set Gemini API Key
supabase secrets set GEMINI_API_KEY=your_actual_gemini_key_here

# Set DeepSeek API Key
supabase secrets set DEEPSEEK_API_KEY=your_actual_deepseek_key_here

# Set Tavily API Key
supabase secrets set TAVILY_API_KEY=your_actual_tavily_key_here
```

**Replace** `your_actual_gemini_key_here` with your real keys!

**Verify secrets were set:**
```bash
supabase secrets list
```

**Expected output**:
```
GEMINI_API_KEY
DEEPSEEK_API_KEY
TAVILY_API_KEY
```

---

### Step 5: Deploy Backend Functions (3 minutes)

```bash
# Deploy all three functions
supabase functions deploy generate-article
supabase functions deploy extract-keywords
supabase functions deploy scan-links
```

**Expected output for each**:
```
Deploying function generate-article...
Function generate-article deployed successfully!
URL: https://xxxxx.supabase.co/functions/v1/generate-article
```

**Verify deployment:**
```bash
supabase functions list
```

You should see all 3 functions listed.

---

### Step 6: Create .env.local File (1 minute)

In your project root, create `.env.local`:

```bash
# Create the file
touch .env.local

# Or on Windows:
type nul > .env.local
```

Add this content (replace with your actual values):

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: `.env.local` is already in `.gitignore`, so it won't be committed to GitHub.

---

### Step 7: Install Supabase Dependency (1 minute)

```bash
npm install @supabase/supabase-js
```

---

### Step 8: Test Locally (3 minutes)

```bash
# Start your dev server
npm run dev
```

**Test the app:**
1. Open http://localhost:5173 (or your dev port)
2. Try generating an article
3. Check browser console for errors
4. Open DevTools → Network tab
5. Verify requests go to `supabase.co` domain
6. Verify NO API keys are visible in requests

**If everything works locally, you're ready for production!**

---

### Step 9: Update Vercel Environment Variables (2 minutes)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project

2. **Go to Settings**
   - Click **Settings** tab
   - Click **Environment Variables** in sidebar

3. **Add Supabase Variables**
   - Click "Add New"
   - Add these two variables:

   **Variable 1:**
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://xxxxx.supabase.co` (your Supabase URL)
   - **Environment**: Select all (Production, Preview, Development)
   - Click "Save"

   **Variable 2:**
   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your anon key)
   - **Environment**: Select all (Production, Preview, Development)
   - Click "Save"

4. **Remove Old Variables (Optional)**
   - You can now remove these (they're in Supabase secrets):
     - `API_KEY` (old Gemini key)
     - Any other API keys you had in Vercel

---

### Step 10: Commit and Push to GitHub (2 minutes)

```bash
# Check what files changed
git status

# Add all new files
git add .

# Commit with a descriptive message
git commit -m "Add Supabase backend for IP protection"

# Push to GitHub
git push origin main
```

**Or if your branch is named differently:**
```bash
git push origin master
```

---

### Step 11: Verify Vercel Deployment (2 minutes)

1. **Watch Vercel Deploy**
   - Vercel will automatically detect your push
   - Go to Vercel dashboard → Your project
   - You'll see a new deployment starting
   - Wait for it to complete (~2 minutes)

2. **Check Deployment Logs**
   - Click on the deployment
   - Check for any errors
   - Look for "Build Completed" message

3. **Test Production App**
   - Click "Visit" to open your live app
   - Try generating an article
   - Verify it works!

---

## ✅ Verification Checklist

After deployment, verify everything is protected:

### Backend Verification
- [ ] Supabase project created
- [ ] 3 Edge Functions deployed
- [ ] API keys set as Supabase secrets
- [ ] Functions accessible at `https://xxxxx.supabase.co/functions/v1/...`

### Frontend Verification
- [ ] `.env.local` created locally
- [ ] Vercel environment variables set
- [ ] Code pushed to GitHub
- [ ] Vercel deployment successful
- [ ] Production app works

### Security Verification
- [ ] Open production app
- [ ] Open DevTools → Network tab
- [ ] Generate an article
- [ ] Verify NO API keys in requests
- [ ] Verify NO prompts in requests
- [ ] Verify requests go to Supabase

---

## 🔍 Troubleshooting

### Issue 1: "supabase: command not found"

**Solution:**
```bash
# Reinstall Supabase CLI
npm install -g supabase

# Or use npx
npx supabase login
```

---

### Issue 2: "Project not linked"

**Solution:**
```bash
# Make sure you're in the project directory
cd /path/to/your/project

# Link again with correct project ref
supabase link --project-ref YOUR_PROJECT_REF
```

---

### Issue 3: "Function deployment failed"

**Solution:**
```bash
# Check function logs
supabase functions logs generate-article

# Try deploying again
supabase functions deploy generate-article
```

---

### Issue 4: "Unauthorized" error in production

**Solution:**
1. Check Vercel environment variables are set correctly
2. Verify Supabase URL and anon key are correct
3. Redeploy from Vercel dashboard

---

### Issue 5: "API key missing" error

**Solution:**
```bash
# Verify secrets are set
supabase secrets list

# Re-set if needed
supabase secrets set GEMINI_API_KEY=your_key
```

---

### Issue 6: Vercel build fails

**Solution:**
1. Check Vercel build logs for specific error
2. Make sure `@supabase/supabase-js` is in `package.json`
3. Verify environment variables are set in Vercel
4. Try redeploying from Vercel dashboard

---

## 🔄 Future Updates

### To Update Backend Functions

```bash
# Make changes to function code
# Then redeploy
supabase functions deploy generate-article
```

### To Update Frontend

```bash
# Make changes to your code
git add .
git commit -m "Update feature X"
git push origin main
# Vercel auto-deploys!
```

### To Update API Keys

```bash
# Update Supabase secrets
supabase secrets set GEMINI_API_KEY=new_key

# No need to redeploy functions - they'll use new key automatically
```

---

## 📊 Deployment Summary

### What Happens Where

| Component | Hosted On | Auto-Deploy |
|-----------|-----------|-------------|
| Frontend (UI) | Vercel | ✅ Yes (via GitHub push) |
| Backend Functions | Supabase | ❌ No (manual: `supabase functions deploy`) |
| API Keys | Supabase Secrets | ❌ No (manual: `supabase secrets set`) |
| Database | Supabase | N/A |

### Deployment Flow

```
1. You push code to GitHub
   ↓
2. Vercel detects push
   ↓
3. Vercel builds and deploys frontend
   ↓
4. Frontend calls Supabase backend
   ↓
5. Supabase runs your protected functions
   ↓
6. Results returned to user
```

---

## 💰 Cost Breakdown

### Supabase (Backend)
- **Free Tier**: 500K function calls/month
- **Cost**: $0/month (unless you exceed free tier)

### Vercel (Frontend)
- **Hobby Plan**: Free for personal projects
- **Cost**: $0/month (your current plan)

### GitHub
- **Free**: Unlimited public/private repos
- **Cost**: $0/month

**Total Monthly Cost**: $0 (on free tiers)

---

## 🎉 Success!

Your deployment is complete! Here's what you achieved:

### ✅ What's Live Now
- Frontend on Vercel (auto-deploys from GitHub)
- Backend on Supabase (protected functions)
- API keys secured (Supabase secrets)
- Your IP protected (competitors can't copy)

### ✅ Your Workflow Going Forward

**For Frontend Changes:**
```bash
# Make changes
git add .
git commit -m "Update UI"
git push
# Vercel auto-deploys!
```

**For Backend Changes:**
```bash
# Make changes to supabase/functions/
supabase functions deploy function-name
```

**For API Key Updates:**
```bash
supabase secrets set KEY_NAME=new_value
```

---

## 📞 Need Help?

- **Supabase Issues**: Check function logs with `supabase functions logs function-name`
- **Vercel Issues**: Check deployment logs in Vercel dashboard
- **GitHub Issues**: Verify your push with `git log`

---

## 🚀 You're Protected and Deployed!

Your app is now:
- ✅ Live on Vercel
- ✅ Protected by Supabase backend
- ✅ Secure from competitors
- ✅ Auto-deploying from GitHub

**Time to dominate the market!** 🔒🚀
