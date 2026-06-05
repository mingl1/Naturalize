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

  // Tabs switching logic
  const tabLocator = document.getElementById("tab-locator");
  const tabHistory = document.getElementById("tab-history");
  const locatorContent = document.getElementById("locator-content");
  const historyContent = document.getElementById("history-content");
  const historyList = document.getElementById("history-list");

  tabLocator.addEventListener("click", () => {
    tabLocator.classList.add("active");
    tabHistory.classList.remove("active");
    locatorContent.style.display = "block";
    historyContent.style.display = "none";
  });

  tabHistory.addEventListener("click", () => {
    tabHistory.classList.add("active");
    tabLocator.classList.remove("active");
    locatorContent.style.display = "none";
    historyContent.style.display = "block";
    renderHistory();
  });

  function renderHistory() {
    chrome.storage.local.get(["ag_saved_parsers"], (result) => {
      const parsers = result.ag_saved_parsers || [];
      historyList.innerHTML = "";

      if (parsers.length === 0) {
        historyList.innerHTML = '<p class="no-history-text">No saved parser scripts yet. Generate one to auto-save!</p>';
        return;
      }

      parsers.forEach((parser) => {
        const item = document.createElement("div");
        item.className = "history-item";
        
        const dateStr = new Date(parser.timestamp).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

        item.innerHTML = `
          <div class="history-item-header">
            <div class="history-item-title-container">
              <span class="history-item-title">${parser.title}</span>
              <span class="history-item-domain">${parser.domain}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="history-item-date">${dateStr}</span>
              <span class="history-expand-icon">▼</span>
            </div>
          </div>
          <div class="history-item-details" style="display: none;">
            <div class="history-url-row">
              <span class="history-detail-label">URL:</span>
              <a href="${parser.url}" target="_blank" class="history-url-link">${parser.url}</a>
            </div>
            <div class="history-selectors-row">
              <span class="history-detail-label">Selectors:</span>
              <code class="history-selectors-code">${JSON.stringify(parser.selectors)}</code>
            </div>
            <div class="history-code-viewport">
              <pre class="history-code-text"><code>${parser.code}</code></pre>
            </div>
            <div class="history-actions-row">
              <button class="btn-history-action btn-apply" data-id="${parser.id}">Apply to Page</button>
              <button class="btn-history-action btn-copy" data-id="${parser.id}">Copy</button>
              <button class="btn-history-action btn-delete" data-id="${parser.id}">Delete</button>
            </div>
          </div>
        `;

        // Expand/Collapse event
        const header = item.querySelector(".history-item-header");
        const details = item.querySelector(".history-item-details");
        const expandIcon = item.querySelector(".history-expand-icon");

        header.addEventListener("click", () => {
          const isHidden = details.style.display === "none";
          details.style.display = isHidden ? "flex" : "none";
          expandIcon.textContent = isHidden ? "▲" : "▼";
          expandIcon.style.color = isHidden ? "var(--color-brand-violet)" : "var(--color-text-muted)";
        });

        // Action events
        const btnCopy = item.querySelector(".btn-copy");
        btnCopy.addEventListener("click", (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(parser.code).then(() => {
            btnCopy.textContent = "Copied!";
            setTimeout(() => { btnCopy.textContent = "Copy"; }, 1500);
          });
        });

        const btnDelete = item.querySelector(".btn-delete");
        btnDelete.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteParser(parser.id);
        });

        const btnApply = item.querySelector(".btn-apply");
        btnApply.addEventListener("click", (e) => {
          e.stopPropagation();
          applyParserToActiveTab(parser);
        });

        historyList.appendChild(item);
      });
    });
  }

  function deleteParser(id) {
    chrome.storage.local.get(["ag_saved_parsers"], (result) => {
      let parsers = result.ag_saved_parsers || [];
      parsers = parsers.filter((p) => p.id !== id);
      chrome.storage.local.set({ ag_saved_parsers: parsers }, () => {
        renderHistory();
      });
    });
  }

  function applyParserToActiveTab(parser) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(
          activeTab.id,
          {
            action: "loadSavedParser",
            code: parser.code,
            selectors: parser.selectors
          },
          (response) => {
            if (chrome.runtime.lastError) {
              addConsoleLog("Could not apply parser. Reload/navigate to page first.", "error");
            } else {
              addConsoleLog("Parser code loaded successfully into control panel!", "success");
              const btnApply = document.querySelector(`.btn-apply[data-id="${parser.id}"]`);
              if (btnApply) {
                btnApply.textContent = "Applied!";
                btnApply.style.borderColor = "var(--color-brand-emerald)";
                btnApply.style.color = "var(--color-brand-emerald)";
                setTimeout(() => {
                  btnApply.textContent = "Apply to Page";
                  btnApply.style.borderColor = "";
                  btnApply.style.color = "";
                }, 1500);
              }
            }
          }
        );
      }
    });
  }
});
