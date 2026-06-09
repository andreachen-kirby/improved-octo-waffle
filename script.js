const form = document.getElementById('preview-form');
const input = document.getElementById('url-input');
const btn = document.getElementById('submit-btn');
const result = document.getElementById('result');

// Show empty state on load
renderEmpty();

// Reset to empty state when input is cleared
input.addEventListener('input', () => {
  clearInlineError();
  if (!input.value.trim()) renderEmpty();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = input.value.trim();
  if (!raw) return;

  // 1. Validate URL format before making any request
  let url;
  try {
    url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    showInlineError('Please enter a valid URL starting with http:// or https://');
    return;
  }
  clearInlineError();

  setLoading(true);
  result.innerHTML = `
    <div class="skeleton">
      <div class="skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton-line domain"></div>
        <div class="skeleton-line title"></div>
        <div class="skeleton-line title2"></div>
        <div class="skeleton-line desc"></div>
        <div class="skeleton-line desc2"></div>
      </div>
    </div>
  `;

  try {
    const og = await fetchOGData(url.href);
    renderCard(og, url.href);
  } catch (err) {
    renderError(err);
  } finally {
    setLoading(false);
  }
});

// Error types for specific messages
class ServerDownError extends Error {}
class NetworkError extends Error {}
class NoMetadataError extends Error {}

async function fetchOGData(url) {
  // Relative URL works on Vercel (/api/preview) and locally via `node server.js`
  const apiUrl = `/api/preview?url=${encodeURIComponent(url)}`;
  let res;

  try {
    res = await fetch(apiUrl);
  } catch {
    throw new ServerDownError();
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('The server returned an unexpected response.');
  }

  if (res.status === 404) throw new NoMetadataError(data.error);
  if (res.status === 500) throw new NetworkError(data.error);
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');

  return data;
}

function renderCard({ title, description, image }, url) {
  let domain = '';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {}

  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
    : null;

  result.innerHTML = `
    <div class="card">
      ${image ? `
        <div class="card-image-wrap">
          <img class="card-image" src="${escapeHtml(image)}" alt="${escapeHtml(title || '')}"
               onerror="this.closest('.card-image-wrap').style.display='none'">
        </div>` : ''}
      <div class="card-body">
        ${domain ? `
          <div class="card-domain">
            ${faviconUrl ? `<img src="${escapeHtml(faviconUrl)}" alt="" aria-hidden="true" onerror="this.style.display='none'">` : ''}
            ${escapeHtml(domain)}
          </div>` : ''}
        ${title ? `<div class="card-title">${escapeHtml(title)}</div>` : ''}
        ${description ? `<div class="card-description">${escapeHtml(description)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderEmpty() {
  result.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🔗</div>
      <div class="empty-title">Paste a link above</div>
      <div class="empty-desc">Your preview card will appear here — title, description, image, and domain.</div>
    </div>
  `;
}

function renderError(err) {
  let icon, title, desc;

  if (err instanceof ServerDownError) {
    icon  = '🔌';
    title = 'Server is not running';
    desc  = 'Start it in your terminal with: <code>node server.js</code>';
  } else if (err instanceof NoMetadataError) {
    icon  = '🏷️';
    title = 'No preview available';
    desc  = 'This page does not have Open Graph tags, so there is nothing to preview. Try a different URL, like a news article or product page.';
  } else if (err instanceof NetworkError) {
    icon  = '🌐';
    title = 'Could not reach that page';
    desc  = escapeHtml(err.message || 'The server could not fetch the URL. The site may be down, blocking requests, or the URL may be incorrect.');
  } else {
    icon  = '⚠️';
    title = 'Something went wrong';
    desc  = escapeHtml(err.message || 'An unexpected error occurred. Please try again.');
  }

  result.innerHTML = `
    <div class="error">
      <div class="error-icon">${icon}</div>
      <div>
        <div class="error-title">${title}</div>
        <div class="error-desc">${desc}</div>
      </div>
    </div>
  `;
}

function showInlineError(message) {
  clearInlineError();
  const el = document.createElement('p');
  el.className = 'inline-error';
  el.id = 'inline-error';
  el.textContent = message;
  form.appendChild(el);
  input.classList.add('input-error');
}

function clearInlineError() {
  document.getElementById('inline-error')?.remove();
  input.classList.remove('input-error');
}

function setLoading(loading) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Loading…' : 'Preview';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
