// Poddle Lens — Background Service Worker
// Registers the side panel and opens it when the extension icon is clicked.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab.windowId == null) return;
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (err) {
    console.error('[Poddle Lens] Failed to open side panel:', err);
  }
});
