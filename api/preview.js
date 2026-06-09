// Vercel serverless function — available at /api/preview?url=https://...
// Fetches the target URL server-side (avoiding browser CORS restrictions)
// and returns its Open Graph metadata as JSON.

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
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 10s — the site may be slow or unreachable');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

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

// Vercel calls this function for every request to /api/preview
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel parses query params for us — no URL parsing needed
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  console.log(`Fetching: ${targetUrl}`);

  try {
    const html = await fetchHTML(targetUrl);

    const title       = getMeta(html, 'og:title')       || getPageTitle(html) || null;
    const description = getMeta(html, 'og:description') || getMeta(html, 'description') || null;
    const image       = getMeta(html, 'og:image')       || null;

    if (!title && !description && !image) {
      return res.status(404).json({ error: 'No Open Graph metadata found for this URL' });
    }

    return res.status(200).json({ title, description, image });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
};
