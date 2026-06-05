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

  // Load initial hover state
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["hoverEnabled"], (result) => {
      const isEnabled = result.hoverEnabled !== false; // Default to true
      toggleHover.checked = isEnabled;
      addConsoleLog(`Hover tracker initialized to: ${isEnabled ? "ON" : "OFF"}`);
    });
  }

  // Handle toggle switch changes
  toggleHover.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ hoverEnabled: isEnabled }, () => {
        addConsoleLog(`Hover tracking toggled ${isEnabled ? "ON" : "OFF"}`, isEnabled ? "success" : "info");
        
        // Notify content scripts in all tabs
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: "toggleHover", enabled: isEnabled }).catch(() => {
              // Ignore errors for tabs without active content scripts
            });
          });
        });
      });
    }
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
