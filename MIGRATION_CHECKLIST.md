# Migration Checklist: Frontend → Supabase Backend

## ✅ Phase 1: Supabase Setup (30 minutes)

- [ ] Create Supabase account at https://supabase.com
- [ ] Create new Supabase project
- [ ] Copy Project URL and anon key
- [ ] Create `.env.local` file with Supabase credentials
- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Login to Supabase CLI: `supabase login`
- [ ] Link project: `supabase link --project-ref YOUR_REF`

## ✅ Phase 2: Secure Your API Keys (10 minutes)

- [ ] Set Gemini API key: `supabase secrets set GEMINI_API_KEY=your_key`
- [ ] Set DeepSeek API key: `supabase secrets set DEEPSEEK_API_KEY=your_key`
- [ ] Set Tavily API key: `supabase secrets set TAVILY_API_KEY=your_key`
- [ ] Verify secrets: `supabase secrets list`

## ✅ Phase 3: Deploy Backend Functions (15 minutes)

- [ ] Deploy generate-article: `supabase functions deploy generate-article`
- [ ] Deploy extract-keywords: `supabase functions deploy extract-keywords`
- [ ] Deploy scan-links: `supabase functions deploy scan-links`
- [ ] Verify deployments: `supabase functions list`

## ✅ Phase 4: Update Frontend Code (20 minutes)

- [ ] Install Supabase client: `npm install @supabase/supabase-js`
- [ ] Update `components/ArticleForm.tsx`:
  - [ ] Replace `import { generateArticle } from '../services/geminiService'`
  - [ ] With `import { generateArticle } from '../services/supabaseClient'`
  - [ ] Do the same for DeepSeek imports
- [ ] Update `components/Layout.tsx`:
  - [ ] Remove Gemini API key input field
  - [ ] Remove DeepSeek API key input field
  - [ ] Remove Tavily API key input field
  - [ ] Add authentication UI (optional)

## ✅ Phase 5: Test Locally (15 minutes)

- [ ] Start dev server: `npm run dev`
- [ ] Test keyword generation
- [ ] Test article generation with Gemini
- [ ] Test article generation with DeepSeek
- [ ] Test link scanning
- [ ] Check browser console for errors
- [ ] Verify no API keys visible in Network tab

## ✅ Phase 6: Deploy to Production (10 minutes)

- [ ] Add Supabase env vars to Vercel:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Commit changes: `git add . && git commit -m "Migrate to Supabase backend"`
- [ ] Push to GitHub: `git push`
- [ ] Verify Vercel deployment succeeds
- [ ] Test production app

## ✅ Phase 7: Cleanup (5 minutes)

- [ ] Remove old service files (optional - keep as backup):
  - [ ] `services/geminiService.ts` (logic now in backend)
  - [ ] `services/deepseekService.ts` (logic now in backend)
  - [ ] `services/tavilyService.ts` (logic now in backend)
- [ ] Update `.gitignore` to include `.env.local`
- [ ] Remove API keys from localStorage (they're server-side now)

## ✅ Phase 8: Security Verification (10 minutes)

- [ ] Open browser DevTools → Network tab
- [ ] Generate an article
- [ ] Verify API keys are NOT visible in any requests
- [ ] Verify prompts are NOT visible in any requests
- [ ] Check that only results are returned (not logic)
- [ ] Confirm authentication is working (if enabled)

## 🎉 Migration Complete!

### What's Protected Now:
- ✅ AI prompts and strategies (server-side)
- ✅ API keys (Supabase secrets)
- ✅ Business logic (backend functions)
- ✅ Research methods (hidden)

### What Competitors See:
- ❌ Your UI design (can be copyrighted)
- ❌ API endpoint names (but not implementation)
- ❌ General concept (protect with speed)

### Next Steps:
1. Monitor usage in Supabase dashboard
2. Set up authentication for users
3. Add rate limiting if needed
4. Consider adding analytics
5. Build your brand and move fast!

---

## 📞 Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **Check function logs**: `supabase functions logs generate-article`

---

**Total Time**: ~2 hours
**Difficulty**: Medium
**Protection Level**: Maximum 🔒
