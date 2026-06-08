/**
 * Antigravity Scrape-as-Code Engine
 * popup.js - Interactive controls for the extension popup UI.
 */

document.addEventListener("DOMContentLoaded", () => {
  const toggleHover = document.getElementById("toggle-hover");
  const btnReset = document.getElementById("reset-session");
  const consoleLogs = document.getElementById("console-logs");
  
  const btnSimple = document.getElementById("btn-mode-simple");
  const btnAdvanced = document.getElementById("btn-mode-advanced");
  const locatorLabel = document.getElementById("locator-label");
  let currentMode = "simple";

  function updateModeUI() {
    if (currentMode === "simple") {
      btnSimple.classList.add("active");
      btnAdvanced.classList.remove("active");
      locatorLabel.textContent = "Visual Element Locator";
    } else {
      btnSimple.classList.remove("active");
      btnAdvanced.classList.add("active");
      locatorLabel.textContent = "Advanced Action Recorder";
    }
  }

  chrome.storage.local.get(["ag_extraction_mode"], (result) => {
    if (result && result.ag_extraction_mode) {
      currentMode = result.ag_extraction_mode;
      updateModeUI();
    }
  });

  btnSimple.addEventListener("click", () => {
    if (currentMode === "simple") return;
    currentMode = "simple";
    updateModeUI();
    chrome.storage.local.set({ ag_extraction_mode: "simple" });
    addConsoleLog("Switched to Simple extraction mode.");
  });

  btnAdvanced.addEventListener("click", () => {
    if (currentMode === "advanced") return;
    currentMode = "advanced";
    updateModeUI();
    chrome.storage.local.set({ ag_extraction_mode: "advanced" });
    addConsoleLog("Switched to Advanced extraction mode (Actions Recording).");
  });

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

  const btnTogglePhase = document.getElementById("btn-toggle-phase");
  const btnFinalizeRec = document.getElementById("btn-finalize-rec");
  const advancedDashboard = document.getElementById("advanced-dashboard");
  const selectionNotice = document.getElementById("selection-notice");
  const popupRecPhase = document.getElementById("popup-rec-phase");
  const popupRecCount = document.getElementById("popup-rec-count");
  let isSelectingAfterFinalize = false;

  function updateDashboardUI(recordingActive, phase, clickCount) {
    if (currentMode === "advanced" && recordingActive) {
      advancedDashboard.style.display = "flex";
      btnSimple.disabled = true;
      btnAdvanced.disabled = true;
      popupRecPhase.textContent = phase === "expand" ? "Expand Steps" : "Close Steps";
      popupRecPhase.style.color = phase === "expand" ? "#c2410c" : "#be123c";
      btnTogglePhase.textContent = phase === "expand" ? "Switch to Close" : "Switch to Expand";
      popupRecCount.textContent = clickCount || 0;
      selectionNotice.style.display = "none";
    } else {
      advancedDashboard.style.display = "none";
      btnSimple.disabled = false;
      btnAdvanced.disabled = false;
      if (isSelectingAfterFinalize) {
        selectionNotice.style.display = "block";
      } else {
        selectionNotice.style.display = "none";
      }
    }
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
          toggleHover.checked = response.enabled || response.recordingActive;
          isSelectingAfterFinalize = response.selectingTarget || false;
          updateDashboardUI(response.recordingActive, response.phase, response.count);
          addConsoleLog(`Hover tracker initialized to: ${toggleHover.checked ? "ON" : "OFF"}`);
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
    isSelectingAfterFinalize = false;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: "toggleHover", enabled: isEnabled, mode: currentMode }, (response) => {
          if (chrome.runtime.lastError) {
            addConsoleLog("Could not send enable command to active tab.", "error");
            toggleHover.checked = !isEnabled; // Revert change
          } else {
            addConsoleLog(`Hover tracking toggled ${isEnabled ? "ON" : "OFF"}`, isEnabled ? "success" : "info");
            if (currentMode === "advanced") {
              updateDashboardUI(isEnabled, "expand", 0);
            } else {
              updateDashboardUI(false, "expand", 0);
            }
          }
        });
      } else {
        addConsoleLog("Could not identify active tab.", "error");
        toggleHover.checked = !isEnabled; // Revert change
      }
    });
  });

  // Toggle phase in Advanced mode
  btnTogglePhase.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: "toggleRecordingPhase" }, (response) => {
          if (response && response.phase !== undefined) {
            updateDashboardUI(true, response.phase, response.count);
            addConsoleLog(`Switched recording phase to: ${response.phase === "expand" ? "Expand Steps" : "Close Steps"}`);
          }
        });
      }
    });
  });

  // Finalize recording session in Advanced mode
  btnFinalizeRec.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: "finalizeRecording" }, (response) => {
          isSelectingAfterFinalize = true;
          updateDashboardUI(false, "expand", 0);
          addConsoleLog("Recording finalized. Click on the webpage element you wish to scope.", "success");
        });
      }
    });
  });

  // Handle reset button clicks
  btnReset.addEventListener("click", () => {
    addConsoleLog("Refreshing extension highlight states...", "info");
    isSelectingAfterFinalize = false;
    updateDashboardUI(false, "expand", 0);
    toggleHover.checked = false;
    
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
    } else if (message.action === "actionRecorded") {
      toggleHover.checked = true;
      updateDashboardUI(true, message.phase, message.count);
      if (message.elementTag !== "resume" && message.elementTag !== "phase-toggle") {
        addConsoleLog(`[Recorded click] target: <${message.elementTag}>`, "success");
      }
      sendResponse({ status: "ok" });
    } else if (message.action === "recordingFinalized") {
      isSelectingAfterFinalize = true;
      toggleHover.checked = false;
      updateDashboardUI(false, "expand", 0);
      addConsoleLog("Recording finalized. Click on the webpage element you wish to scope.", "success");
      sendResponse({ status: "ok" });
    } else if (message.action === "scopingFinalized") {
      isSelectingAfterFinalize = false;
      toggleHover.checked = false;
      updateDashboardUI(false, "expand", 0);
      addConsoleLog("Scoping complete! Control panel opened on webpage.", "success");
      sendResponse({ status: "ok" });
    }
  });

  // Tabs switching logic
  const tabLocator = document.getElementById("tab-locator");
  const tabHistory = document.getElementById("tab-history");
  const tabSettings = document.getElementById("tab-settings");
  const locatorContent = document.getElementById("locator-content");
  const historyContent = document.getElementById("history-content");
  const settingsContent = document.getElementById("settings-content");
  const historyList = document.getElementById("history-list");

  tabLocator.addEventListener("click", () => {
    tabLocator.classList.add("active");
    tabHistory.classList.remove("active");
    tabSettings.classList.remove("active");
    locatorContent.style.display = "block";
    historyContent.style.display = "none";
    settingsContent.style.display = "none";
  });

  tabHistory.addEventListener("click", () => {
    tabHistory.classList.add("active");
    tabLocator.classList.remove("active");
    tabSettings.classList.remove("active");
    locatorContent.style.display = "none";
    historyContent.style.display = "block";
    settingsContent.style.display = "none";
    renderHistory();
  });

  tabSettings.addEventListener("click", () => {
    tabSettings.classList.add("active");
    tabLocator.classList.remove("active");
    tabHistory.classList.remove("active");
    locatorContent.style.display = "none";
    historyContent.style.display = "none";
    settingsContent.style.display = "block";
    loadExtensionToken();
  });

  // Token storage logic
  const tokenInput = document.getElementById("extension-token-input");
  const btnSaveToken = document.getElementById("btn-save-token");

  function loadExtensionToken() {
    chrome.storage.local.get(["ag_extension_token"], (result) => {
      if (result && result.ag_extension_token) {
        tokenInput.value = result.ag_extension_token;
      }
    });
  }

  // Load initially
  loadExtensionToken();

  btnSaveToken.addEventListener("click", () => {
    const token = tokenInput.value.trim();
    chrome.storage.local.set({ ag_extension_token: token }, () => {
      addConsoleLog("Extension Access Token saved!", "success");
      btnSaveToken.textContent = "Saved!";
      setTimeout(() => {
        btnSaveToken.textContent = "Save Token";
      }, 1500);
    });
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
            selectors: parser.selectors,
            detail_steps_enabled: parser.detail_steps_enabled,
            expand_steps: parser.expand_steps,
            close_steps: parser.close_steps,
            modal_selector: parser.modal_selector
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
