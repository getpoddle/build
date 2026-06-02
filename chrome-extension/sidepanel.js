// Poddle Lens — Side Panel Script
// Manages tab context, content extraction, and iframe communication.

const PODDLE_ORIGIN = 'https://poddleme.com';
const EXTENSION_VIEW_BASE = `${PODDLE_ORIGIN}/extension-view`;

const $ = (id) => document.getElementById(id);

const ui = {
  favicon:       $('tabFavicon'),
  title:         $('contextTitle'),
  url:           $('contextUrl'),
  btnAnalyze:    $('btnAnalyze'),
  toastBar:      $('toastBar'),
  toastMsg:      $('toastMessage'),
  statusDot:     $('statusDot'),
  statusLabel:   $('statusLabel'),
  frame:         $('poddleFrame'),
  loader:        $('iframeLoader'),
};

let currentTabId   = null;
let currentTabUrl  = null;
let iframeReady    = false;
let pendingContent = null;

// ── Status helpers ────────────────────────────────────────────

function setStatus(state, label) {
  ui.statusDot.className = `status-dot${state ? ` ${state}` : ''}`;
  ui.statusLabel.textContent = label;
}

function showToast(message, type = '') {
  ui.toastMsg.textContent = message;
  ui.toastBar.className = `toast-bar visible${type ? ` toast-${type}` : ''}`;
}

function clearToast() {
  ui.toastBar.className = 'toast-bar';
  ui.toastMsg.textContent = '';
}

// ── Tab context ───────────────────────────────────────────────

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function updateContextStrip(tab) {
  if (!tab) return;

  const title  = tab.title  || 'Untitled page';
  const url    = tab.url    || '';
  const domain = extractDomain(url);

  ui.title.textContent = title;
  ui.url.textContent   = domain;

  if (tab.favIconUrl) {
    ui.favicon.src     = tab.favIconUrl;
    ui.favicon.style.display = 'block';
  } else {
    ui.favicon.style.display = 'none';
  }

  currentTabId  = tab.id;
  currentTabUrl = url;
}

async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) updateContextStrip(tab);
  } catch (err) {
    console.warn('[Poddle Lens] Could not load tab info:', err);
  }
}

// ── iframe lifecycle ──────────────────────────────────────────

function buildFrameUrl(tabUrl) {
  if (!tabUrl) return EXTENSION_VIEW_BASE;
  return `${EXTENSION_VIEW_BASE}?source_url=${encodeURIComponent(tabUrl)}`;
}

function loadFrame(tabUrl) {
  iframeReady = false;
  ui.loader.classList.remove('hidden');
  setStatus('loading', 'Loading…');
  ui.frame.src = buildFrameUrl(tabUrl);
}

ui.frame.addEventListener('load', () => {
  ui.loader.classList.add('hidden');
  setStatus('', 'Ready');

  // If we have buffered content waiting for the frame, flush it now.
  if (pendingContent) {
    deliverContent(pendingContent);
    pendingContent = null;
  }
});

// ── Inbound messages from Poddle iframe ──────────────────────

window.addEventListener('message', (event) => {
  if (event.origin !== PODDLE_ORIGIN) return;

  const { type } = event.data || {};

  if (type === 'PODDLE_READY') {
    iframeReady = true;
    setStatus('', 'Ready');
    clearToast();
  }

  if (type === 'PODDLE_AUTH_REQUIRED') {
    setStatus('error', 'Sign in required');
    showToast('Sign in to Poddle to use Lens', 'error');
  }
});

// ── Content delivery to iframe ────────────────────────────────

function deliverContent({ text, title, url }) {
  if (!ui.frame.contentWindow) return;
  ui.frame.contentWindow.postMessage(
    { type: 'PODDLE_PAGE_CONTENT', text, title, url },
    PODDLE_ORIGIN
  );
  iframeReady = true;
  setStatus('', 'Ready');
  showToast('Review your prompt and send when ready', 'success');
  setTimeout(clearToast, 4000);
}

// ── Analyze button ────────────────────────────────────────────

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('data:') ||
    url.startsWith('javascript:') ||
    url === ''
  );
}

ui.btnAnalyze.addEventListener('click', async () => {
  if (!currentTabId) {
    showToast('No active tab detected', 'error');
    return;
  }

  if (isRestrictedUrl(currentTabUrl)) {
    showToast('Cannot analyze browser pages (chrome://, extensions, etc.)', 'error');
    setTimeout(() => { setStatus('', 'Ready'); clearToast(); }, 5000);
    return;
  }

  ui.btnAnalyze.disabled = true;
  setStatus('loading', 'Extracting…');
  showToast('Extracting page content…', 'loading');

  try {
    // Re-inject the content script so it is always fresh, even on pages that
    // loaded before the extension was installed or updated.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content.js'],
      });
    } catch (injErr) {
      // Injection can fail on PDFs, file:// pages, or sandboxed iframes.
      // Fall through — the declarative content_script may already be present.
      console.warn('[Poddle Lens] Script injection skipped:', injErr.message);
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(currentTabId, { type: 'GET_PAGE_CONTENT' });
    } catch {
      throw new Error('Could not reach the page. Try refreshing the tab, then click Analyze again.');
    }

    if (!response?.success) {
      throw new Error(response?.error || 'Content extraction failed');
    }

    showToast('Sending to Poddle Lens…', 'loading');
    setStatus('loading', 'Sending…');

    if (iframeReady) {
      deliverContent(response);
    } else {
      pendingContent = response;
    }
  } catch (err) {
    console.error('[Poddle Lens] Analyze error:', err);
    setStatus('error', 'Error');
    showToast(err.message || 'Could not extract content', 'error');
    setTimeout(() => {
      setStatus('', 'Ready');
      clearToast();
    }, 6000);
  } finally {
    ui.btnAnalyze.disabled = false;
  }
});

// ── Tab change listeners ──────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updateContextStrip(tab);
    loadFrame(tab.url);
  } catch {/* tab may not be accessible */}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== currentTabId) return;
  if (changeInfo.status === 'complete') {
    updateContextStrip(tab);
    loadFrame(tab.url);
  }
});

// ── Init ──────────────────────────────────────────────────────

(async () => {
  await loadCurrentTab();
  loadFrame(currentTabUrl);
})();
