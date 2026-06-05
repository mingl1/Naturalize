/**
 * Antigravity Scrape-as-Code Engine
 * popup.js - Interactive controls for the extension popup UI.
 */

document.addEventListener("DOMContentLoaded", () => {
  const toggleHover = document.getElementById("toggle-hover");
  const btnReset = document.getElementById("reset-session");
  const consoleLogs = document.getElementById("console-logs");

  // Log message helper
  function addConsoleLog(text, type = "info") {
    const p = document.createElement("p");
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (type === "success") {
      p.className = "text-brand-emerald";
      p.textContent = `[${timestamp}] [success] ${text}`;
    } else if (type === "error") {
      p.className = "text-rose-400";
      p.textContent = `[${timestamp}] [error] ${text}`;
    } else {
      p.className = "text-slate-300";
      p.textContent = `[${timestamp}] [log] ${text}`;
    }
    
    consoleLogs.appendChild(p);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  // Load initial hover state from the active tab's content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab && activeTab.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: "getStatus" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          // If content script is not loaded or didn't respond, default to off
          toggleHover.checked = false;
          addConsoleLog("Hover tracker initialized to: OFF");
        } else {
          toggleHover.checked = response.enabled;
          addConsoleLog(`Hover tracker initialized to: ${response.enabled ? "ON" : "OFF"}`);
        }
      });
    } else {
      toggleHover.checked = false;
      addConsoleLog("Hover tracker initialized to: OFF");
    }
  });

  // Handle toggle switch changes
  toggleHover.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: "toggleHover", enabled: isEnabled }, (response) => {
          if (chrome.runtime.lastError) {
            addConsoleLog("Could not send enable command to active tab.", "error");
            toggleHover.checked = !isEnabled; // Revert change
          } else {
            addConsoleLog(`Hover tracking toggled ${isEnabled ? "ON" : "OFF"}`, isEnabled ? "success" : "info");
          }
        });
      } else {
        addConsoleLog("Could not identify active tab.", "error");
        toggleHover.checked = !isEnabled; // Revert change
      }
    });
  });

  // Handle reset button clicks
  btnReset.addEventListener("click", () => {
    addConsoleLog("Refreshing extension highlight states...", "info");
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "resetHighlight" })
          .then(() => addConsoleLog("Highlights successfully refreshed!", "success"))
          .catch((err) => {
            addConsoleLog("No active page connection. Reload page to re-initialize.", "error");
          });
      } else {
        addConsoleLog("Could not identify active tab.", "error");
      }
    });
  });

  // Listen for logs sent from the content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "logUpdate") {
      addConsoleLog(message.text, message.type || "info");
      sendResponse({ status: "ok" });
    }
  });
});
