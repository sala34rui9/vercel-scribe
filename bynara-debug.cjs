/**
 * Bynara API Debug Script
 * Run with: node bynara-debug.js
 * Tests the Bynara API directly to diagnose 403 / timeout errors
 */

const https = require('https');
const http = require('http');

const BYNARA_API_URL = 'https://router.bynara.id/v1/chat/completions';
const MODELS_URL = 'https://router.bynara.id/v1/models';

// Read API key from environment or prompt
const API_KEY = process.env.BYNARA_API_KEY || process.argv[2] || '';

if (!API_KEY) {
  console.log('Usage: node bynara-debug.js <API_KEY>');
  console.log('   or: BYNARA_API_KEY=xxx node bynara-debug.js');
  console.log('\nTo get your API key:');
  console.log('  1. Open SEO Scribe in browser');
  console.log('  2. Open DevTools (F12) → Console');
  console.log('  3. Run: localStorage.getItem("user_bynara_api_key")');
  console.log('  4. Copy the value and pass it as argument');
  process.exit(1);
}

const ALL_MODELS = [
  'mistral-large', 'deepseek-v4-flash', 'deepseek-v4-pro',
  'deepseek-v4-flash-alibaba', 'deepseek-v4-pro-alibaba',
  'claude-sonnet-5', 'gpt-5.4', 'grok-4.5', 'kimi-k3', 'glm-5.2', 'qwen3.7-max'
];

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === 'https:' ? https : http;

    const req = transport.request(urlObj, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 30s'));
    });

    req.on('error', (err) => reject(err));

    if (body) req.write(body);
    req.end();
  });
}

async function testModel(model, apiKey) {
  const payload = JSON.stringify({
    model: model,
    messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
    max_tokens: 20,
    stream: false
  });

  const start = Date.now();

  try {
    const result = await makeRequest(BYNARA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    let parsed;
    try { parsed = JSON.parse(result.body); } catch(e) { parsed = { raw: result.body }; }

    if (result.status === 200) {
      const content = parsed.choices?.[0]?.message?.content || 'N/A';
      return { model, ok: true, status: result.status, elapsed, content, raw: parsed };
    } else {
      const errMsg = parsed.error?.message || parsed.message || result.body.substring(0, 200);
      return { model, ok: false, status: result.status, elapsed, error: errMsg, raw: parsed };
    }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return { model, ok: false, status: 0, elapsed, error: err.message };
  }
}

async function testModelsList(apiKey) {
  try {
    const result = await makeRequest(MODELS_URL, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    let parsed;
    try { parsed = JSON.parse(result.body); } catch(e) { parsed = { raw: result.body }; }
    return { status: result.status, ok: result.status === 200, data: parsed };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  }
}

function printResult(r) {
  if (r.ok) {
    console.log(`  ✅ ${r.model.padEnd(30)} ${r.status} OK  (${r.elapsed}s) → "${r.content}"`);
  } else {
    console.log(`  ❌ ${r.model.padEnd(30)} ${r.status || 'ERR'} FAIL (${r.elapsed}s) → ${r.error}`);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('  BYNARA API DEBUG TOOL');
  console.log('='.repeat(70));
  console.log(`  API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 5)}`);
  console.log(`  Endpoint: ${BYNARA_API_URL}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // Test 1: Models List
  console.log('\n📋 TEST 1: Fetching available models...');
  const modelsResult = await testModelsList(API_KEY);
  if (modelsResult.ok) {
    const models = modelsResult.data.data || modelsResult.data.models || [];
    console.log(`  ✅ Found ${models.length} models`);
    if (models.length > 0) {
      console.log('  Available models:');
      models.forEach(m => console.log(`    - ${m.id || m.name || JSON.stringify(m).substring(0, 60)}`));
    }
  } else {
    console.log(`  ❌ Failed: ${modelsResult.status} ${modelsResult.error || ''}`);
    if (modelsResult.status === 403) {
      console.log('  → API key is invalid or expired. Get a new key at https://bynara.id/api/keys');
    } else if (modelsResult.status === 401) {
      console.log('  → Unauthorized. Check your API key.');
    }
  }

  // Test 2: Test each model
  console.log('\n🧪 TEST 2: Testing each model with minimal prompt...');
  const results = [];
  for (const model of ALL_MODELS) {
    const r = await testModel(model, API_KEY);
    printResult(r);
    results.push(r);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  // Summary
  const passed = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);

  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total: ${results.length} models tested`);
  console.log(`  ✅ Working: ${passed.length}`);
  console.log(`  ❌ Failed:  ${failed.length}`);

  if (passed.length > 0) {
    console.log('\n  Working models:');
    passed.forEach(r => console.log(`    ✅ ${r.model} (${r.elapsed}s)`));
  }

  if (failed.length > 0) {
    console.log('\n  Failed models:');
    failed.forEach(r => console.log(`    ❌ ${r.model}: ${r.status} - ${r.error}`));

    // Diagnose common issues
    const all403 = failed.every(r => r.status === 403);
    const all401 = failed.every(r => r.status === 401);
    const all404 = failed.every(r => r.status === 404);
    const allTimeout = failed.every(r => r.status === 0);

    console.log('\n  DIAGNOSIS:');
    if (all403) {
      console.log('  → All models returning 403 Forbidden.');
      console.log('  → Your API key is likely invalid, expired, or IP-restricted.');
      console.log('  → Action: Get a new key at https://bynara.id/api/keys');
    } else if (all401) {
      console.log('  → All models returning 401 Unauthorized.');
      console.log('  → Action: Verify your API key is correct.');
    } else if (all404) {
      console.log('  → All models returning 404 Not Found.');
      console.log('  → The model names may have changed. Check https://router.bynara.id/v1/models');
    } else if (allTimeout) {
      console.log('  → All requests timing out.');
      console.log('  → Network issue or Bynara API is down.');
    } else {
      const statusCodes = [...new Set(failed.map(r => r.status))];
      console.log(`  → Mixed errors: ${statusCodes.join(', ')}`);
      console.log('  → Some models may not be available on your plan.');
      console.log('  → Check your plan at https://bynara.id');
    }
  }

  console.log('\n' + '='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
