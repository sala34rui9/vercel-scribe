# Deployment Flow: GitHub + Vercel + Supabase

## 🎯 Your Current Setup

```
┌─────────────────────────────────────────────────────────┐
│  YOUR COMPUTER                                           │
│  - Write code                                            │
│  - Test locally                                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ git push
                      ↓
┌─────────────────────────────────────────────────────────┐
│  GITHUB                                                  │
│  - Stores your code                                      │
│  - Version control                                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ Auto-trigger
                      ↓
┌─────────────────────────────────────────────────────────┐
│  VERCEL                                                  │
│  - Builds your frontend                                  │
│  - Deploys to production                                 │
│  - Serves your UI to users                               │
└─────────────────────────────────────────────────────────┘
```

---

## 🆕 Your New Setup (With Supabase)

```
┌─────────────────────────────────────────────────────────┐
│  YOUR COMPUTER                                           │
│  - Write code                                            │
│  - Test locally                                          │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
              │ git push                  │ supabase functions deploy
              ↓                           ↓
┌─────────────────────────┐   ┌─────────────────────────┐
│  GITHUB                 │   │  SUPABASE               │
│  - Frontend code        │   │  - Backend functions    │
│  - Version control      │   │  - API keys (secrets)   │
└─────────┬───────────────┘   └─────────┬───────────────┘
          │                             │
          │ Auto-trigger                │
          ↓                             │
┌─────────────────────────┐             │
│  VERCEL                 │             │
│  - Builds frontend      │             │
│  - Deploys UI           │             │
│  - Serves to users      │             │
└─────────┬───────────────┘             │
          │                             │
          │ When user generates article │
          │ Frontend calls backend      │
          └─────────────────────────────┘
                        │
                        ↓
              ┌─────────────────────┐
              │  USER SEES RESULT   │
              │  (No secrets shown) │
              └─────────────────────┘
```

---

## 📝 Step-by-Step Deployment Process

### One-Time Setup (Do Once)

```
Step 1: Create Supabase Project
┌─────────────────────────────────────┐
│ 1. Go to supabase.com               │
│ 2. Create new project               │
│ 3. Copy URL and anon key            │
└─────────────────────────────────────┘
         ↓
Step 2: Install Supabase CLI
┌─────────────────────────────────────┐
│ npm install -g supabase             │
└─────────────────────────────────────┘
         ↓
Step 3: Link Your Project
┌─────────────────────────────────────┐
│ supabase login                      │
│ supabase link --project-ref XXX     │
└─────────────────────────────────────┘
         ↓
Step 4: Set API Keys as Secrets
┌─────────────────────────────────────┐
│ supabase secrets set GEMINI_API_KEY │
│ supabase secrets set DEEPSEEK_KEY   │
│ supabase secrets set TAVILY_KEY     │
└─────────────────────────────────────┘
         ↓
Step 5: Deploy Backend Functions
┌─────────────────────────────────────┐
│ supabase functions deploy           │
│   generate-article                  │
│ supabase functions deploy           │
│   extract-keywords                  │
│ supabase functions deploy           │
│   scan-links                        │
└─────────────────────────────────────┘
         ↓
Step 6: Update Vercel Env Vars
┌─────────────────────────────────────┐
│ Go to Vercel Dashboard              │
│ Settings → Environment Variables    │
│ Add VITE_SUPABASE_URL               │
│ Add VITE_SUPABASE_ANON_KEY          │
└─────────────────────────────────────┘
         ↓
Step 7: Push to GitHub
┌─────────────────────────────────────┐
│ git add .                           │
│ git commit -m "Add Supabase"        │
│ git push origin main                │
└─────────────────────────────────────┘
         ↓
Step 8: Vercel Auto-Deploys
┌─────────────────────────────────────┐
│ Vercel detects push                 │
│ Builds and deploys automatically    │
│ Your app is live!                   │
└─────────────────────────────────────┘
```

---

## 🔄 Regular Workflow (After Setup)

### Scenario 1: Update Frontend (UI Changes)

```
1. Make changes to components/
   ↓
2. git add .
   git commit -m "Update UI"
   git push
   ↓
3. Vercel auto-deploys
   ↓
4. Done! ✅
```

**Time**: 2 minutes

---

### Scenario 2: Update Backend (Logic Changes)

```
1. Make changes to supabase/functions/
   ↓
2. supabase functions deploy function-name
   ↓
3. Done! ✅
```

**Time**: 1 minute

**Note**: No need to push to GitHub for backend changes!

---

### Scenario 3: Update API Keys

```
1. supabase secrets set KEY_NAME=new_value
   ↓
2. Done! ✅
```

**Time**: 30 seconds

**Note**: Functions automatically use new keys!

---

## 🗺️ Where Everything Lives

```
┌─────────────────────────────────────────────────────────┐
│  GITHUB (github.com/your-username/your-repo)            │
│                                                          │
│  ✅ Frontend code (components, services)                │
│  ✅ Backend code (supabase/functions/)                  │
│  ✅ Configuration files                                 │
│  ✅ Documentation                                       │
│                                                          │
│  ❌ API keys (in .gitignore)                           │
│  ❌ .env.local (in .gitignore)                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  VERCEL (vercel.com/your-project)                       │
│                                                          │
│  ✅ Deployed frontend (live website)                    │
│  ✅ Environment variables (Supabase URL & key)          │
│  ✅ Auto-deployment from GitHub                         │
│  ✅ Custom domain (if you have one)                     │
│                                                          │
│  ❌ Backend functions (those are on Supabase)          │
│  ❌ AI API keys (those are Supabase secrets)           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  SUPABASE (app.supabase.com/project/your-ref)           │
│                                                          │
│  ✅ Backend functions (your protected logic)            │
│  ✅ API keys as secrets (GEMINI, DEEPSEEK, TAVILY)      │
│  ✅ Database (if you use it)                            │
│  ✅ Authentication (if you enable it)                   │
│                                                          │
│  ❌ Frontend code (that's on Vercel)                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Flow

### Before (Vulnerable)

```
User Opens App
    ↓
Browser loads JavaScript
    ↓
JavaScript contains:
  - Your AI prompts ❌ EXPOSED
  - Your API keys ❌ EXPOSED
  - Your logic ❌ EXPOSED
    ↓
Competitor can copy everything ❌
```

---

### After (Protected)

```
User Opens App
    ↓
Browser loads JavaScript
    ↓
JavaScript contains:
  - UI components only ✅
  - Simple API calls ✅
  - No secrets ✅
    ↓
User clicks "Generate Article"
    ↓
Frontend calls Supabase
    ↓
Supabase Edge Function runs:
  - Verifies authentication ✅
  - Retrieves API keys from secrets ✅
  - Builds your SECRET prompt ✅
  - Calls AI service ✅
  - Returns ONLY the result ✅
    ↓
User sees article
    ↓
Competitor sees:
  - UI design (can copyright) ⚠️
  - API call to Supabase ⚠️
  - Article result ⚠️
    ↓
Competitor CANNOT see:
  - Your prompts ✅ PROTECTED
  - Your API keys ✅ PROTECTED
  - Your logic ✅ PROTECTED
```

---

## 📊 Deployment Checklist

### ✅ One-Time Setup (30 minutes)

- [ ] Create Supabase project
- [ ] Install Supabase CLI
- [ ] Login and link project
- [ ] Set API keys as Supabase secrets
- [ ] Deploy backend functions
- [ ] Create .env.local file
- [ ] Install @supabase/supabase-js
- [ ] Test locally
- [ ] Update Vercel environment variables
- [ ] Push to GitHub
- [ ] Verify Vercel deployment
- [ ] Test production app

### ✅ Verification (5 minutes)

- [ ] Open production app
- [ ] Open DevTools → Network tab
- [ ] Generate an article
- [ ] Verify NO API keys in requests
- [ ] Verify NO prompts in requests
- [ ] Verify requests go to supabase.co
- [ ] Verify article generates successfully

---

## 🎯 Quick Commands Reference

### Supabase Commands

```bash
# Login
supabase login

# Link project
supabase link --project-ref YOUR_REF

# Set secrets
supabase secrets set KEY_NAME=value

# List secrets
supabase secrets list

# Deploy function
supabase functions deploy function-name

# List functions
supabase functions list

# View logs
supabase functions logs function-name

# View logs in real-time
supabase functions logs function-name --follow
```

### Git Commands

```bash
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "Your message"

# Push to GitHub
git push origin main

# View commit history
git log
```

### NPM Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🆘 Common Issues & Solutions

### Issue: "Cannot find module '@supabase/supabase-js'"

**Solution:**
```bash
npm install @supabase/supabase-js
```

---

### Issue: "Unauthorized" in production

**Solution:**
1. Check Vercel environment variables
2. Verify VITE_SUPABASE_URL is correct
3. Verify VITE_SUPABASE_ANON_KEY is correct
4. Redeploy from Vercel dashboard

---

### Issue: "Function not found"

**Solution:**
```bash
# Check deployed functions
supabase functions list

# Redeploy if needed
supabase functions deploy generate-article
```

---

### Issue: Vercel build fails

**Solution:**
1. Check build logs in Vercel dashboard
2. Verify package.json has @supabase/supabase-js
3. Verify environment variables are set
4. Try manual redeploy

---

## 🎉 Success Indicators

You know everything is working when:

✅ Local dev server runs without errors
✅ Supabase functions are deployed
✅ Vercel deployment succeeds
✅ Production app loads
✅ Article generation works
✅ No API keys visible in Network tab
✅ No errors in browser console

---

## 📞 Support

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **GitHub Docs**: https://docs.github.com

---

## 🚀 You're Ready!

Your deployment flow is now:

1. **Write code** on your computer
2. **Push to GitHub** (frontend auto-deploys to Vercel)
3. **Deploy functions** to Supabase (when you update backend)
4. **Done!** Your app is live and protected

**Time to build and dominate!** 🔒🚀
