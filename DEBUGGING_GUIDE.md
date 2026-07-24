# Fetch Function Debugging Guide

## Problem: "TinyFish Bad Request: [object Object]" on all URLs

### Root Cause Analysis

The error occurs because:
1. The TinyFish Fetch API returns HTTP 400 (Bad Request)
2. The error response body contains an object that cannot be serialized with `JSON.stringify`
3. The previous implementation had a broken fallback using `searchWeb(url, ...)` which passed URLs as search queries

### Debugging Steps

#### Step 1: Check API Key
```
Open browser DevTools (F12) → Console:
localStorage.getItem('user_tinyfish_fetch_api_key')
```
- If `null` → API key is missing. Add it in Settings → API Provider Settings
- If empty string → Key was cleared
- If value exists → Proceed to Step 2

#### Step 2: Check Network Request
```
DevTools → Network tab → Filter by "fetch" or "tinyfish"
```
Look for:
- **Status 400**: Bad request (payload format issue)
- **Status 401**: Invalid API key
- **Status 403**: Key lacks permission
- **CORS error**: Browser blocks the request (shows as "CORS error" or red text)
- **NS_ERROR_DOM_INT_ERR**: Network-level failure

#### Step 3: Check Response Body
```
In Network tab → Click the failed request → Response tab
```
Common response formats:
```json
// Format 1: Simple error
{"error": "Invalid URL format"}

// Format 2: Nested error
{"error": {"code": "validation", "message": "URLs required"}}

// Format 3: Validation errors
{"errors": [{"field": "urls", "message": "must be an array"}]}

// Format 4: Detail field
{"detail": "Missing required parameter: urls"}
```

#### Step 4: Verify API Endpoint
The current endpoint is: `https://api.fetch.tinyfish.ai/`

Check if:
- The base URL has changed
- The trailing `/` is required
- The API version path is needed (e.g., `/v1/`)

#### Step 5: Test with Minimal Request
Open browser console and run:
```javascript
fetch('https://api.fetch.tinyfish.ai/', {
  method: 'POST',
  headers: {
    'X-API-Key': localStorage.getItem('user_tinyfish_fetch_api_key'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    urls: ['https://example.com'],
    purpose: 'research',
    format: 'markdown'
  })
}).then(r => r.json()).then(console.log).catch(console.error)
```

### Common Causes and Fixes

| Cause | Symptom | Fix |
|-------|---------|-----|
| Missing API key | Error: "API key is missing" | Add key in Settings |
| Invalid API key | Status 401 | Regenerate key from TinyFish |
| Wrong endpoint | Status 404 | Update `TINYFISH_FETCH_API_BASE` |
| Payload format | Status 400 with object error | Check required fields |
| CORS blocked | Red error in console | Use proxy or contact API provider |
| Rate limited | Status 429 | Wait and retry (built-in retry) |
| Server error | Status 500/502/503 | Check API status page |
| URL normalization | Some URLs fail | Ensure all URLs have protocol |

### Payload Structure Expected by API

```json
{
  "urls": ["https://example.com", "https://example2.com"],
  "purpose": "research",
  "format": "markdown",
  "links": false,
  "image_links": false,
  "ttl": 300,
  "per_url_timeout_ms": 45000,
  "exclude_selectors": [".comments", ".ads"]
}
```

### Improved Error Handling (Applied)

The updated service now:
1. Logs full request details to console on failure
2. Extracts error messages from multiple possible formats
3. Shows raw text if JSON parsing fails
4. Includes diagnostic panel in UI when fetch fails
5. Provides a "Test Connection" function for quick verification

### Diagnostic Panel in UI

When fetch fails, the UI now shows:
- The exact error message
- Whether the API key is set
- The endpoint being called
- Number of URLs attempted
- Quick fix suggestions
- "Log Debug Info" button for console output

### If Problem Persists

1. **Check TinyFish API status**: Visit https://tinyfish.ai or their status page
2. **Review API docs**: Verify the current endpoint and payload format
3. **Test with curl**:
   ```bash
   curl -X POST https://api.fetch.tinyfish.ai/ \
     -H "X-API-Key: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"urls":["https://example.com"],"purpose":"research","format":"markdown"}'
   ```
4. **Contact TinyFish support** with the error details from console logs
