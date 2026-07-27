# Plan: Move API Keys to Admin Panel

## Goal
Remove API keys from the navbar/top of interface and create a unified "API Keys" section within the Admin panel with sub-navigation.

## Decisions Made
- **Location**: Extend the Admin panel (not a new page or within SEO Settings)
- **Modal fate**: Remove entirely from Layout.tsx
- **Scope**: All keys unified — AI providers (Gemini, DeepSeek, Bynara, Tavily, TinyFish, TinyFish Fetch) + SE Ranking + Cloudflare
- **Admin layout**: Sidebar sub-nav within Admin to switch between "Usage" and "API Keys"

## Affected Files
1. `components/Layout.tsx` — Remove API key modal, badges, button, and related state
2. `components/AdminUsage.tsx` — Refactor into a shell with sub-navigation
3. `components/SeoSettings.tsx` — Remove SE Ranking and Cloudflare key inputs
4. `App.tsx` — Update admin page routing
5. `components/ApiKeysManagement.tsx` — **New file** for the unified API keys view

## Implementation Steps

### Step 1: Create `components/ApiKeysManagement.tsx`

A new component that consolidates all API key management into one view.

**Features:**
- Display all 8 credential entries in a card-based list
- Each card shows: provider name, status indicator (configured/not), masked key value with show/hide toggle, clear button
- Inline edit: click to expand and modify the value
- Save all changes to localStorage
- Success toast/feedback on save

**localStorage keys managed:**
| Key | Provider | Icon |
|-----|----------|------|
| `user_gemini_api_key` | Google Gemini | Zap (blue) |
| `user_deepseek_api_key` | DeepSeek | Cpu (indigo) |
| `user_bynara_api_key` | Bynara | Globe (purple) |
| `user_tavily_api_key` | Tavily | Search (emerald) |
| `user_tinyfish_api_key` | TinyFish | Fish (cyan) |
| `user_tinyfish_fetch_api_key` | TinyFish Fetch | Fish (cyan-600) |
| `user_se_ranking_api_key` | SE Ranking | BarChart3 (amber) |
| `user_cloudflare_api_token` | Cloudflare API Token | Globe (orange) |
| `user_cloudflare_api_url` | Cloudflare Account ID | Globe (orange) |

**UI Structure:**
```
┌─────────────────────────────────────────────────┐
│  🔑 API Provider Keys                            │
│  Manage all your API credentials in one place    │
├─────────────────────────────────────────────────┤
│  ┌─ Google Gemini ─────────────── [● Configured] │
│  │  AIzaSy••••••••••••••••••••••••••••           │
│  │  [👁 Show] [Edit] [Clear]                     │
│  └───────────────────────────────────────────────│
│  ┌─ DeepSeek ────────────────── [○ Not Set]      │
│  │  [Add Key]                                    │
│  └───────────────────────────────────────────────│
│  ... (one card per provider)                     │
│                                                  │
│  [Save All Changes]                              │
└─────────────────────────────────────────────────┘
```

**Component signature:**
```tsx
export const ApiKeysManagement: React.FC = () => { ... }
```

### Step 2: Refactor `components/AdminUsage.tsx` → `components/AdminPanel.tsx`

Convert the existing `AdminUsage` component into a shell with sidebar sub-navigation.

**Changes:**
- Rename component to `AdminPanel`
- Add a vertical sub-nav on the left side with two items:
  - "Usage" (Database icon) → renders existing usage dashboard content
  - "API Keys" (Key icon) → renders `<ApiKeysManagement />`
- Default view: Usage
- The existing usage table logic becomes an internal sub-component or stays inline

**UI Structure:**
```
┌──────────────────────────────────────────────────┐
│ ┌────────┬──────────────────────────────────────┐ │
│ │ Admin  │                                      │ │
│ │        │  (Usage or API Keys content)          │ │
│ │ Usage  │                                      │ │
│ │ Keys   │                                      │ │
│ │        │                                      │ │
│ └────────┴──────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Component signature:**
```tsx
export const AdminPanel: React.FC = () => { ... }
```

### Step 3: Update `App.tsx`

**Change at line 735-739:**
```tsx
// Before:
{activePage === 'admin' && (
  <div className="animate-in fade-in duration-300 h-full w-full">
    <AdminUsage />
  </div>
)}

// After:
{activePage === 'admin' && (
  <div className="animate-in fade-in duration-300 h-full w-full">
    <AdminPanel />
  </div>
)}
```

**Update imports (line 6):**
```tsx
// Before:
import { AdminUsage } from './components/AdminUsage';

// After:
import { AdminPanel } from './components/AdminPanel';
```

### Step 4: Clean up `components/Layout.tsx`

**Remove:**
- Lines 16: `showKeyModal` state
- Lines 19-27: All API key state variables (`geminiKey`, `deepSeekKey`, etc.)
- Lines 29-35: All `has*Key` state variables
- Lines 37: `saveStatus` state
- Lines 39-95: The entire `useEffect` that reads API keys from localStorage
- Lines 97-146: `handleSaveKeys` function
- Lines 148-188: All `clear*` functions
- Lines 202-232: API key status badges from navbar
- Lines 253-260: Key icon button from navbar
- Lines 361-538: The entire API Key Modal

**Keep:**
- The `Key` import can be removed from line 2
- The `ShieldCheck`, `AlertCircle`, `Cpu`, `Zap`, `Search`, `Home`, `FileText`, `Grid`, `BookOpen`, `Mic`, `Newspaper`, `MapPin`, `HelpCircle`, `ChevronLeft`, `ChevronRight`, `BarChart3`, `Globe`, `Target`, `Fish`, `TrendingUp`, `Settings` imports — only remove `Key`, `X`, `Save` if no longer used elsewhere in Layout

**After removal, Layout.tsx will be ~250 lines** (down from 541)

### Step 5: Clean up `components/SeoSettings.tsx`

**Remove SE Ranking and Cloudflare key inputs:**
- Lines 11: `seRankingKey` state
- Lines 14: `hasSeRankingKey` state
- Lines 16-17: `cloudflareApiUrl`, `cloudflareApiToken` states
- Lines 29-46: The `useEffect` that reads these from localStorage (keep domain loading)
- Lines 51-58: SE Ranking save logic in `handleSaveSettings`
- Lines 74-86: Cloudflare save logic in `handleSaveSettings`
- Lines 183-188: `clearSeRanking` function
- Lines 236-266: SE Ranking input section in JSX
- Lines 268-341: Cloudflare Image API section in JSX

**Keep:**
- Domain targeting section (target domain, competitor domain)
- Intelligence Radar section (scan functionality)
- The `seo_settings_updated` event dispatch (other code may depend on it)

**Update the header text** from "SEO Intelligence Settings" to reflect it's now focused on domain targeting and scanning.

## Validation Plan

1. **Manual testing:**
   - Open app → verify navbar no longer shows API key badges or Key button
   - Navigate to Admin → verify sub-nav shows "Usage" and "API Keys"
   - Click "API Keys" → verify all 8 credential cards render
   - Add a key → verify it saves to localStorage
   - Navigate to SEO Settings → verify SE Ranking and Cloudflare inputs are gone
   - Verify existing functionality still works (article generation, SERP, etc.)

2. **localStorage verification:**
   - All keys should still be stored under the same localStorage keys
   - No data migration needed

3. **Type checking:**
   - Run `npm run typecheck` or equivalent to ensure no TypeScript errors

## Risks / Considerations
- The `seo_settings_updated` custom event is listened to by Layout.tsx — after removing the listener, ensure no other code depends on it (SeoSettings still dispatches it)
- The `Key`, `X`, `Save`, `ShieldCheck` icons from lucide-react may become unused imports in Layout.tsx — clean those up
- The `AdminUsage` component's "Settings" error message references "the settings modal" — update this text to reference the Admin panel
