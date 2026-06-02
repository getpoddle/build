// Poddle Lens — Content Script
// Listens for a GET_PAGE_CONTENT message from the side panel and returns
// the best available text from the current page.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_PAGE_CONTENT') return false;

  try {
    const text = extractContent();
    if (!text || text.length < 20) {
      sendResponse({
        success: false,
        error: 'Could not extract readable content from this page. Try selecting text first.',
      });
      return true;
    }
    sendResponse({
      success: true,
      text,
      title: document.title,
      url: window.location.href,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  } catch (err) {
    sendResponse({ success: false, error: err.message || 'Unknown error during extraction' });
  }

  return true;
});

function extractContent() {
  // 1. User's selected text takes priority — they chose exactly what matters.
  const selection = window.getSelection()?.toString().trim();
  if (selection && selection.length > 30) return selection;

  // 2. JSON-LD structured data (works on many news / recipe / product pages).
  const jsonLd = extractJsonLd();
  if (jsonLd && jsonLd.length > 80) return jsonLd.slice(0, 8000);

  // 3. <meta> description as a lightweight fallback hint (prepended later).
  const metaDesc = document.querySelector('meta[name="description"]')?.content?.trim() ?? '';

  // 4. Semantic main content area — try progressively broader selectors.
  const semanticSelectors = [
    'article',
    'main',
    '[role="main"]',
    '[role="article"]',
    '.article-body',
    '.article-content',
    '.post-content',
    '.post-body',
    '.entry-content',
    '.content-body',
    '.story-body',
    '.page-content',
    '#content',
    '#main-content',
    '#article-body',
    '.prose',
  ];

  for (const sel of semanticSelectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const text = getVisibleText(el);
    if (text.length > 120) {
      return (metaDesc ? metaDesc + '\n\n' : '') + text.slice(0, 8000);
    }
  }

  // 5. Heading + paragraph harvest — works well on SPAs and dashboards.
  const harvested = harvestHeadingsAndParagraphs();
  if (harvested.length > 100) {
    return (metaDesc ? metaDesc + '\n\n' : '') + harvested.slice(0, 8000);
  }

  // 6. Full body fallback, stripping boilerplate.
  const bodyText = getBodyFallback();
  if (bodyText.length > 80) {
    return (metaDesc ? metaDesc + '\n\n' : '') + bodyText.slice(0, 8000);
  }

  // 7. Last resort: just the meta description + page title.
  const titleText = document.title?.trim() ?? '';
  if (metaDesc || titleText) {
    return [titleText, metaDesc].filter(Boolean).join('\n\n');
  }

  return '';
}

// ── Helpers ──────────────────────────────────────────────────────

function getVisibleText(el) {
  // Temporarily clone to strip hidden/boilerplate children.
  const clone = el.cloneNode(true);
  for (const child of clone.querySelectorAll(
    'script, style, noscript, [aria-hidden="true"], .sr-only, ' +
    '.visually-hidden, [hidden], nav, footer, aside, ' +
    '.ad, .ads, .advertisement, .cookie-banner, .cookie-notice, ' +
    '.paywall, .subscription-wall, .newsletter-signup'
  )) {
    child.remove();
  }
  return cleanText(clone.innerText ?? '');
}

function harvestHeadingsAndParagraphs() {
  const nodes = document.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, td');
  const parts = [];
  for (const node of nodes) {
    // Skip invisible nodes.
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    const t = node.innerText?.trim();
    if (t && t.length > 15) parts.push(t);
    if (parts.length > 300) break;
  }
  return cleanText(parts.join('\n'));
}

function getBodyFallback() {
  if (!document.body) return '';
  const clone = document.body.cloneNode(true);
  for (const el of clone.querySelectorAll(
    'script, style, noscript, nav, footer, header, aside, ' +
    '[aria-hidden="true"], .ad, .ads, .cookie-banner, .cookie-notice, ' +
    '.menu, .navigation, .breadcrumb, .sidebar, .widget'
  )) {
    el.remove();
  }
  return cleanText(clone.innerText ?? '');
}

function extractJsonLd() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const parts = [];
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent);
      const text = jsonLdToText(data);
      if (text) parts.push(text);
    } catch { /* malformed JSON-LD — skip */ }
  }
  return parts.join('\n\n');
}

function jsonLdToText(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const fields = ['name', 'headline', 'description', 'articleBody', 'text', 'caption', 'abstract'];
  const parts = [];
  for (const f of fields) {
    if (typeof obj[f] === 'string' && obj[f].trim()) parts.push(obj[f].trim());
  }
  // Recurse into @graph arrays.
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) parts.push(jsonLdToText(item));
  }
  return parts.filter(Boolean).join('\n');
}

function cleanText(raw) {
  return (raw ?? '')
    .replace(/\t/g, ' ')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
