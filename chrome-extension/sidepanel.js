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

ui.btnAnalyze.addEventListener('click', async () => {
  if (!currentTabId) {
    showToast('No active tab detected', 'error');
    return;
  }

  ui.btnAnalyze.disabled = true;
  setStatus('loading', 'Extracting…');
  showToast('Extracting page content…', 'loading');

  try {
    // Inject the content script programmatically so it is always fresh.
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ['content.js'],
    });

    const response = await chrome.tabs.sendMessage(currentTabId, {
      type: 'GET_PAGE_CONTENT',
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Content extraction failed');
    }

    showToast('Sending to Poddle Lens…', 'loading');
    setStatus('loading', 'Sending…');

    if (iframeReady) {
      deliverContent(response);
    } else {
      // Buffer until the frame fires PODDLE_READY or load event.
      pendingContent = response;
    }
  } catch (err) {
    console.error('[Poddle Lens] Analyze error:', err);
    setStatus('error', 'Error');
    showToast(`Could not extract content: ${err.message}`, 'error');
    setTimeout(() => {
      setStatus('', 'Ready');
      clearToast();
    }, 5000);
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
