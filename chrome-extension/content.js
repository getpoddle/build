// Poddle Lens — Content Script
// Listens for a GET_PAGE_CONTENT message from the side panel and returns
// the best available text from the current page. Fires only on explicit request.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_PAGE_CONTENT') return false;

  try {
    const text = extractContent();
    sendResponse({
      success: true,
      text,
      title: document.title,
      url: window.location.href,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  } catch (err) {
    sendResponse({ success: false, error: err.message || 'Unknown error' });
  }

  // Return true to keep the async message channel open.
  return true;
});

function extractContent() {
  // 1. User's selected text takes priority — they chose exactly what matters.
  const selection = window.getSelection()?.toString().trim();
  if (selection && selection.length > 30) return selection;

  // 2. Semantic main content area.
  const semanticEl = document.querySelector(
    'article, main, [role="main"], .article-body, .post-content, .entry-content, #content, #main-content'
  );
  if (semanticEl) {
    const text = cleanText(semanticEl.innerText);
    if (text.length > 100) return text.slice(0, 8000);
  }

  // 3. Full body fallback, stripping boilerplate elements first.
  const clone = document.body.cloneNode(true);
  for (const el of clone.querySelectorAll(
    'script, style, noscript, nav, footer, header, aside, [aria-hidden="true"], .ad, .cookie-banner'
  )) {
    el.remove();
  }
  return cleanText(clone.innerText).slice(0, 8000);
}

function cleanText(raw) {
  return raw
    .replace(/\t/g, ' ')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
