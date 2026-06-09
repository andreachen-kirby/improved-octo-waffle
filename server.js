const http = require('http');
const { URL } = require('url');

// Fetch HTML using built-in fetch + AbortController for a hard timeout
async function fetchHTML(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}`);

    return await res.text();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out after 10s — the site may be slow or unreachable');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Extract a <meta> tag's content by property or name attribute
function getMeta(html, property) {
  const escaped = property.replace(':', '\\:');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function getPageTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

// --- Server ---

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Only handle GET /
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Match Vercel's /api/preview path so local dev and production behave the same
  const reqUrl = new URL(req.url, `http://localhost:3000`);
  if (reqUrl.pathname !== '/api/preview') {
    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Not found. Use /api/preview?url=...' }));
  }
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    res.writeHead(400);
    return res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
  }

  try {
    new URL(targetUrl);
  } catch {
    res.writeHead(400);
    return res.end(JSON.stringify({ error: 'Invalid URL' }));
  }

  console.log(`[${new Date().toISOString()}] Fetching: ${targetUrl}`);

  try {
    const html = await fetchHTML(targetUrl);

    const title       = getMeta(html, 'og:title')       || getPageTitle(html)        || null;
    const description = getMeta(html, 'og:description') || getMeta(html, 'description') || null;
    const image       = getMeta(html, 'og:image')       || null;

    if (!title && !description && !image) {
      console.log(`  → No OG metadata found`);
      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'No Open Graph metadata found for this URL' }));
    }

    console.log(`  → OK: "${title}"`);
    res.writeHead(200);
    res.end(JSON.stringify({ title, description, image }));
  } catch (err) {
    console.log(`  → Error: ${err.message}`);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`LinkPreview server running at http://localhost:${PORT}`);
  console.log(`Usage: http://localhost:${PORT}/?url=https://example.com`);
});
