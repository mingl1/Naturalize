/**
 * Antigravity Scrape-as-Code Engine
 * background.js - Background service worker for proxying API requests to bypass CSP/CORS constraints.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchBackend") {
    const { url, method, headers, body } = message;

    fetch(url, {
      method: method || "GET",
      headers: headers || {},
      body: body ? JSON.stringify(body) : undefined,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keeps the message channel open for sendResponse asynchronously
  }
});
