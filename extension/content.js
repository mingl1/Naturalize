/**
 * Antigravity Scrape-as-Code Engine
 * content.js - Intercepts mouse hovers and highlights DOM elements with high-end aesthetics.
 */

(function () {
  // Prevent multiple injections
  if (window.__antigravity_content_injected) {
    return;
  }
  window.__antigravity_content_injected = true;

  console.log("🚀 Antigravity Scrape-as-Code Content Script Active.");

  let hoverEnabled = false;
  let currentTarget = null;

  let clickedElement = null;
  let ancestors = [];
  let selectedParent = null;
  let generatedCode = "";
  let inferredSelectors = null;
  let nextButtonSelector = "";
  let isSelectingNextButton = false;
  let isGeneratingCode = false;
  let isPaginationActive = false;
  let paginationTimeoutId = null;
  let isUnloading = false;

  // Detail steps and recording variables
  let extractionMode = "simple"; // 'simple' | 'advanced'
  let isRecording = false;
  let recordingPhase = "expand"; // 'expand' | 'close'
  let recordedExpandActions = []; // array of { type: "click" | "wait", element, selector, delay }
  let recordedCloseActions = []; // array of { type: "click" | "wait", element, selector, delay }
  let lastActionTime = 0;

  let detailStepsEnabled = false;
  let expandSteps = []; // array of { type, target }
  let closeSteps = []; // array of { type, target }
  let modalSelector = "";
  let pickingStepIndex = null; // null | number | 'modal' | 'expand_<idx>' | 'close_<idx>'

  // Check if extension context is valid
  function isContextValid() {
    return (
      typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id
    );
  }

  // Helper to proxy fetch requests through background service worker to bypass CSP/mixed-content blocks
  async function fetchFromBackend(url, method, body) {
    if (!isContextValid()) {
      throw new Error("Extension context is invalid. Please reload the page.");
    }

    // Retrieve token from local storage
    const token = await new Promise((resolveToken) => {
      chrome.storage.local.get(["ag_extension_token"], (res) => {
        resolveToken(res?.ag_extension_token || "");
      });
    });

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "fetchBackend",
          url,
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response) {
            reject(new Error("No response received from background worker."));
          } else if (!response.success) {
            reject(new Error(response.error || "Background fetch failed."));
          } else {
            resolve(response.data);
          }
        },
      );
    });
  }

  // Updates the Generate Parser button disabled state based on pagination settings and generation state
  function updateCodegenButtonState() {
    const codegenBtn = document.getElementById("ag-codegen-btn");
    if (!codegenBtn) return;

    if (isGeneratingCode || isPaginationActive) {
      codegenBtn.disabled = true;
      return;
    }

    const isPaginateEnabled =
      document.getElementById("ag-paginate-toggle")?.checked;
    if (isPaginateEnabled && !nextButtonSelector) {
      codegenBtn.disabled = true;
      codegenBtn.title =
        "Please select a Next Page Button before generating parser.";
    } else {
      codegenBtn.disabled = false;
      codegenBtn.removeAttribute("title");
    }
  }

  // Create hover highlight overlay container
  const overlay = document.createElement("div");
  overlay.id = "antigravity-hover-overlay";

  // Set overlay styling (glassmorphism style with violet neon border)
  Object.assign(overlay.style, {
    position: "absolute",
    pointerEvents: "none", // Critical to not block mouse events
    zIndex: "999999",
    border: "2px solid rgba(139, 92, 246, 0.8)", // Violet neon
    borderRadius: "4px",
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    boxShadow:
      "0 0 12px rgba(139, 92, 246, 0.4), inset 0 0 4px rgba(139, 92, 246, 0.2)",
    transition:
      "top 0.1s ease-out, left 0.1s ease-out, width 0.1s ease-out, height 0.1s ease-out",
    display: "none",
    boxSizing: "border-box",
  });

  // Create floating info badge
  const badge = document.createElement("div");
  badge.id = "antigravity-hover-badge";
  Object.assign(badge.style, {
    position: "absolute",
    top: "-24px",
    left: "0",
    backgroundColor: "#1e1b4b", // Dark indigo
    color: "#a78bfa", // Light violet
    fontSize: "10px",
    fontFamily: "monospace",
    padding: "2px 6px",
    borderRadius: "3px",
    border: "1px solid rgba(139, 92, 246, 0.5)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
  });

  overlay.appendChild(badge);
  document.body.appendChild(overlay);

  // Create parent highlight overlay container (emerald neon border)
  const parentOverlay = document.createElement("div");
  parentOverlay.id = "antigravity-parent-overlay";
  Object.assign(parentOverlay.style, {
    position: "absolute",
    pointerEvents: "none",
    zIndex: "999998",
    border: "2px dashed rgba(52, 211, 153, 0.9)", // Emerald neon dashed border
    borderRadius: "4px",
    backgroundColor: "rgba(52, 211, 153, 0.05)",
    boxShadow:
      "0 0 16px rgba(52, 211, 153, 0.3), inset 0 0 6px rgba(52, 211, 153, 0.15)",
    transition:
      "top 0.15s ease-out, left 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out",
    display: "none",
    boxSizing: "border-box",
  });

  const parentBadge = document.createElement("div");
  parentBadge.id = "antigravity-parent-badge";
  Object.assign(parentBadge.style, {
    position: "absolute",
    top: "-24px",
    left: "0",
    backgroundColor: "#064e3b", // Dark green/emerald
    color: "#34d399", // Emerald green
    fontSize: "10px",
    fontFamily: "monospace",
    padding: "2px 6px",
    borderRadius: "3px",
    border: "1px solid rgba(52, 211, 153, 0.5)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
  });
  parentOverlay.appendChild(parentBadge);
  document.body.appendChild(parentOverlay);

  // Track hover movements
  document.addEventListener(
    "mouseover",
    (e) => {
      if (!hoverEnabled && !isSelectingTargetAfterRecord) return;
      if (isRecording) return;

      const target = e.target;

      // Do not highlight the overlays, badge, or panel itself
      if (
        target === overlay ||
        overlay.contains(target) ||
        target === parentOverlay ||
        parentOverlay.contains(target) ||
        target === document.body ||
        target === document.documentElement ||
        document.getElementById("antigravity-depth-panel")?.contains(target)
      ) {
        return;
      }

      currentTarget = target;
      updateOverlay(target);
    },
    true,
  );

  document.addEventListener(
    "mouseout",
    (e) => {
      if (e.target === currentTarget) {
        overlay.style.display = "none";
        currentTarget = null;
      }
    },
    true,
  );

  // Keep overlays in sync with scrolling/resizing
  window.addEventListener(
    "scroll",
    () => {
      if (hoverEnabled && currentTarget) updateOverlay(currentTarget);
      if (selectedParent) updateParentOverlay(selectedParent);
    },
    true,
  );

  window.addEventListener("resize", () => {
    if (hoverEnabled && currentTarget) updateOverlay(currentTarget);
    if (selectedParent) updateParentOverlay(selectedParent);
  });

  window.addEventListener("beforeunload", () => {
    isUnloading = true;
    if (paginationTimeoutId) {
      clearTimeout(paginationTimeoutId);
    }
  });

  /**
   * Updates hover overlay position and badge details based on target element
   */
  function updateOverlay(target) {
    const rect = target.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    const width = rect.width;
    const height = rect.height;
    const top = rect.top + scrollTop;
    const left = rect.left + scrollLeft;

    if (isSelectingNextButton) {
      Object.assign(overlay.style, {
        display: "block",
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: "2px solid rgba(236, 72, 153, 0.8)", // Pink neon
        backgroundColor: "rgba(236, 72, 153, 0.08)",
        boxShadow:
          "0 0 12px rgba(236, 72, 153, 0.4), inset 0 0 4px rgba(236, 72, 153, 0.2)",
      });
      badge.textContent = `[Next Page Trigger] ${target.tagName.toLowerCase()}`;
      badge.style.border = "1px solid rgba(236, 72, 153, 0.5)";
      badge.style.color = "#f472b6";
      badge.style.backgroundColor = "#500724";
    } else {
      Object.assign(overlay.style, {
        display: "block",
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: "2px solid rgba(139, 92, 246, 0.8)", // Violet neon
        backgroundColor: "rgba(139, 92, 246, 0.08)",
        boxShadow:
          "0 0 12px rgba(139, 92, 246, 0.4), inset 0 0 4px rgba(139, 92, 246, 0.2)",
      });
      let label = target.tagName.toLowerCase();
      if (target.id) {
        label += `#${target.id}`;
      }
      if (target.className && typeof target.className === "string") {
        const classes = target.className
          .split(/\s+/)
          .filter((c) => c && !c.startsWith("antigravity"))
          .slice(0, 2);
        if (classes.length > 0) {
          label += `.${classes.join(".")}`;
        }
      }
      label += ` [${Math.round(width)}x${Math.round(height)}]`;
      badge.textContent = label;
      badge.style.border = "1px solid rgba(139, 92, 246, 0.5)";
      badge.style.color = "#a78bfa";
      badge.style.backgroundColor = "#1e1b4b";
    }

    if (rect.top < 28) {
      badge.style.top = "2px";
      badge.style.left = "2px";
    } else {
      badge.style.top = "-24px";
      badge.style.left = "0";
    }
  }

  /**
   * Updates parent overlay position and badge details
   */
  function updateParentOverlay(target) {
    if (!target) {
      parentOverlay.style.display = "none";
      return;
    }
    const rect = target.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    const width = rect.width;
    const height = rect.height;
    const top = rect.top + scrollTop;
    const left = rect.left + scrollLeft;

    Object.assign(parentOverlay.style, {
      display: "block",
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
    });

    let label = `[Selected Bounding Box] ${target.tagName.toLowerCase()}`;
    if (target.id) {
      label += `#${target.id}`;
    }
    if (target.className && typeof target.className === "string") {
      const classes = target.className
        .split(/\s+/)
        .filter((c) => c && !c.startsWith("antigravity"))
        .slice(0, 2);
      if (classes.length > 0) {
        label += `.${classes.join(".")}`;
      }
    }
    label += ` [${Math.round(width)}x${Math.round(height)}]`;
    parentBadge.textContent = label;

    if (rect.top < 28) {
      parentBadge.style.top = "2px";
      parentBadge.style.left = "2px";
    } else {
      parentBadge.style.top = "-24px";
      parentBadge.style.left = "0";
    }
  }

  // Intercept element click to freeze standard navigation and open selection control panel
  document.addEventListener(
    "click",
    (e) => {
      if (isRecording) {
        // Exclude recorder bar and depth panel clicks
        if (
          document
            .getElementById("antigravity-recorder-bar")
            ?.contains(e.target) ||
          e.target.id === "antigravity-recorder-bar" ||
          document
            .getElementById("antigravity-depth-panel")
            ?.contains(e.target) ||
          e.target.id === "antigravity-depth-panel"
        ) {
          return;
        }

        const now = Date.now();
        const elapsed = lastActionTime > 0 ? now - lastActionTime : 0;
        lastActionTime = now;

        const selector = generateCssSelector(e.target);
        const fullSelector = generateFullUniqueCssSelector(e.target);
        const actions =
          recordingPhase === "expand"
            ? recordedExpandActions
            : recordedCloseActions;

        if (elapsed > 100) {
          actions.push({ type: "wait", target: String(elapsed) });
        }
        actions.push({
          type: "click",
          element: e.target,
          selector: selector,
          fullSelector: fullSelector,
        });

        saveRecordingState();
        addPanelLog(`[Recorded] Click on: <${e.target.tagName.toLowerCase()}>`);

        // Notify popup
        if (isContextValid()) {
          try {
            chrome.runtime.sendMessage({
              action: "actionRecorded",
              phase: recordingPhase,
              count: getRecordingClickCount(),
              elementTag: e.target.tagName.toLowerCase(),
            });
          } catch (err) {
            // ignore if popup closed
          }
        }

        updateRecorderBarUI();
        return; // standard link/button behavior triggers on page
      }

      // 2. If picking element for a step or modal selector, capture and block click
      if (pickingStepIndex !== null) {
        if (
          document.getElementById("antigravity-depth-panel")?.contains(e.target)
        )
          return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        const selector = generateCssSelector(target);

        if (pickingStepIndex === "modal") {
          modalSelector = selector;
          const input = document.getElementById("ag-modal-selector");
          if (input) input.value = modalSelector;
          addPanelLog(`Selected modal selector: ${modalSelector}`, "success");
        } else {
          const parts = pickingStepIndex.split("_");
          const phase = parts[0];
          const idx = parseInt(parts[1], 10);
          const step = phase === "expand" ? expandSteps[idx] : closeSteps[idx];

          if (step) {
            if (step.type === "click_relative") {
              const itemSel = inferredSelectors?.item_selector;
              const itemContainer = itemSel ? target.closest(itemSel) : null;

              if (itemContainer) {
                step.target = generateRelativeCssSelector(
                  target,
                  itemContainer,
                );
                addPanelLog(
                  `Selected relative selector: ${step.target}`,
                  "success",
                );
              } else {
                step.target = selector;
                addPanelLog(
                  `Selected selector (absolute fallback, no item container found): ${step.target}`,
                  "warning",
                );
              }
            } else {
              step.target = selector;
              addPanelLog(
                `Selected absolute selector: ${step.target}`,
                "success",
              );
            }
          }
        }

        pickingStepIndex = null;
        hoverEnabled = false;
        overlay.style.display = "none";
        renderDetailSteps();
        return;
      }

      if (!hoverEnabled && !isSelectingTargetAfterRecord) return;

      // Do not intercept clicks within our own panel or overlays
      if (
        e.target === overlay ||
        overlay.contains(e.target) ||
        e.target === parentOverlay ||
        parentOverlay.contains(e.target) ||
        document.getElementById("antigravity-depth-panel")?.contains(e.target)
      ) {
        return;
      }

      // Prevent normal link navigation/button clicks
      e.preventDefault();
      e.stopPropagation();

      if (isSelectingNextButton) {
        nextButtonSelector = generateCssSelector(e.target);
        const input = document.getElementById("ag-next-selector-input");
        if (input) {
          input.value = nextButtonSelector;
        }
        isSelectingNextButton = false;
        addPanelLog(
          `Selected Next Page Button selector: ${nextButtonSelector}`,
          "success",
        );

        const selectBtn = document.getElementById("ag-select-next-btn");
        if (selectBtn) {
          selectBtn.textContent = "Select Next Button";
          selectBtn.classList.remove("ag-btn-primary");
          selectBtn.classList.add("ag-btn-secondary");
        }
        overlay.style.display = "none";
        updateCodegenButtonState();
        return;
      }

      if (isSelectingTargetAfterRecord) {
        isSelectingTargetAfterRecord = false;
        if (isContextValid()) {
          try {
            chrome.runtime.sendMessage({ action: "scopingFinalized" });
          } catch (err) {
            // ignore
          }
        }
      }

      console.log("🎯 Selected element for scoping:", e.target);

      injectPanel();

      clickedElement = e.target;
      ancestors = getAncestors(clickedElement);

      // Set slider range
      const slider = document.getElementById("ag-depth-slider");
      slider.max = ancestors.length - 1;
      slider.value = 0;

      // Initialize depth selection at level 0 (self)
      handleDepthChange(0);

      // Slide in depth panel
      const panel = document.getElementById("antigravity-depth-panel");
      panel.classList.add("active");

      addPanelLog(
        `Visual scope initiated for element: <${clickedElement.tagName.toLowerCase()}>`,
        "success",
      );
    },
    true,
  );

  /**
   * Helper to retrieve all ancestors up to the body element
   */
  function getAncestors(el) {
    const list = [el];
    let parent = el.parentElement;
    while (parent && parent.tagName !== "HTML") {
      list.push(parent);
      if (parent.tagName === "BODY") break;
      parent = parent.parentElement;
    }
    return list;
  }

  /**
   * Closes the control panel and resets highlighted overlays
   */
  function closePanel() {
    const panel = document.getElementById("antigravity-depth-panel");
    if (panel) {
      panel.classList.remove("active");
    }
    parentOverlay.style.display = "none";
    selectedParent = null;
    clickedElement = null;
    ancestors = [];
  }

  /**
   * Handles slider value adjustments and updates parent overlay box and breadcrumbs
   */
  function handleDepthChange(depth) {
    if (depth >= ancestors.length) return;
    selectedParent = ancestors[depth];

    let label = `${depth}`;
    if (depth === 0) label += " (Self)";
    else if (depth === 1) label += " (Parent)";
    else if (depth === 2) label += " (Grandparent)";
    else label += " (Ancestor)";
    document.getElementById("ag-depth-val").textContent = label;

    updateParentOverlay(selectedParent);
    renderBreadcrumbs(depth);

    processRecordedActions(selectedParent);

    addPanelLog(
      `Traversed hierarchy: level ${depth} tag selected (${selectedParent.tagName.toLowerCase()})`,
    );
  }

  /**
   * Appends clickable tag nodes representing the node hierarchy context
   */
  function renderBreadcrumbs(selectedDepth) {
    const container = document.getElementById("ag-tree-breadcrumbs");
    if (!container) return;
    container.innerHTML = "";

    for (let i = ancestors.length - 1; i >= 0; i--) {
      const el = ancestors[i];
      const span = document.createElement("span");
      span.className =
        "ag-tree-item" + (i === selectedDepth ? " selected" : "");

      let text = el.tagName.toLowerCase();
      if (el.id) text += `#${el.id}`;
      else if (el.className && typeof el.className === "string") {
        const firstClass = el.className
          .split(/\s+/)
          .filter((c) => c && !c.startsWith("antigravity"))[0];
        if (firstClass) text += `.${firstClass}`;
      }
      span.textContent = text;
      span.style.cursor = "pointer";

      // Let user click tags to change depth directly
      span.addEventListener("click", () => {
        const slider = document.getElementById("ag-depth-slider");
        if (slider) {
          slider.value = i;
          handleDepthChange(i);
        }
      });

      container.appendChild(span);

      if (i > 0) {
        const arrow = document.createElement("span");
        arrow.className = "ag-tree-arrow";
        arrow.textContent = " > ";
        container.appendChild(arrow);
      }
    }
  }

  /**
   * Log writer that streams logs to both the sliding panel and the popup terminal in real-time
   */
  function addPanelLog(text, type = "info") {
    const panelLogs = document.getElementById("ag-terminal-logs");
    if (panelLogs) {
      const p = document.createElement("p");
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      if (type === "success") {
        p.className = "ag-log-success";
        p.textContent = `[${timestamp}] [success] ${text}`;
      } else if (type === "error") {
        p.className = "ag-log-error";
        p.textContent = `[${timestamp}] [error] ${text}`;
      } else {
        p.className = "ag-log-info";
        p.textContent = `[${timestamp}] [log] ${text}`;
      }

      panelLogs.appendChild(p);
      panelLogs.scrollTop = panelLogs.scrollHeight;
    }

    if (isContextValid() && chrome.runtime.sendMessage) {
      try {
        chrome.runtime
          .sendMessage({ action: "logUpdate", text, type })
          .catch(() => {
            // Ignore failures when the extension popup is not open
          });
      } catch (e) {
        // Ignore failures gracefully when the extension context is invalidated
      }
    }
  }

  /**
   * Generates a unique CSS selector for a given element
   */
  function generateCssSelector(el) {
    if (el.id) {
      return `#${el.id}`;
    }
    let parts = [];
    let cur = el;
    while (cur && cur.tagName !== "BODY" && cur.tagName !== "HTML") {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += `#${cur.id}`;
        parts.unshift(part);
        break;
      }
      if (cur.className && typeof cur.className === "string") {
        const classes = cur.className
          .split(/\s+/)
          .filter(
            (c) =>
              c &&
              !c.startsWith("antigravity") &&
              !c.startsWith("selected") &&
              c.trim() !== "",
          );
        if (classes.length > 0) {
          part += `.${classes.join(".")}`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    if (parts.length === 0) {
      return el.tagName.toLowerCase();
    }
    return parts.join(" > ");
  }

  /**
   * Cleans HTML container snippet to avoid payload bloating (removes SVG, scripts, canvas, base64 images)
   */
  function cleanHtmlSnippet(element) {
    const clone = element.cloneNode(true);

    const selectorsToRemove = [
      "script",
      "style",
      "noscript",
      "iframe",
      "svg",
      "canvas",
      "embed",
      "object",
    ];
    selectorsToRemove.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((node) => node.remove());
    });

    clone.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src && src.startsWith("data:")) {
        img.setAttribute("src", "");
      }
    });

    clone
      .querySelectorAll("[id^='antigravity']")
      .forEach((node) => node.remove());

    return clone.innerHTML;
  }

  /**
   * Submits HTML snippet to FastAPI generate-parser endpoint
   */
  async function runCodeGen() {
    if (!selectedParent) return;

    const isPaginateEnabled =
      document.getElementById("ag-paginate-toggle")?.checked;
    if (isPaginateEnabled && !nextButtonSelector) {
      addPanelLog(
        "Please select a Next Page Button before generating parser.",
        "error",
      );
      return;
    }

    addPanelLog("Starting parsing pipeline...", "info");
    addPanelLog(
      "Cleaning and sanitizing HTML snippet (removing scripts/media/base64)...",
    );

    let finalSelectedParent = selectedParent;
    if (
      detailStepsEnabled &&
      (expandSteps.length > 0 || closeSteps.length > 0)
    ) {
      const firstItem = getItemContainerOfClicked(
        clickedElement,
        selectedParent,
      );
      if (firstItem) {
        addPanelLog(
          "Expanding first item to capture detailed code generation snippet...",
          "info",
        );
        await executeStepsForElement(firstItem, expandSteps);

        finalSelectedParent = selectedParent.cloneNode(true);
        if (modalSelector) {
          const modalEl = document.querySelector(modalSelector);
          if (modalEl) {
            const children = Array.from(selectedParent.children);
            const idx = children.indexOf(firstItem);
            if (idx !== -1 && finalSelectedParent.children[idx]) {
              finalSelectedParent.children[idx].appendChild(
                modalEl.cloneNode(true),
              );
            }
          }
        }

        await executeStepsForElement(firstItem, closeSteps);
      }
    }

    const htmlSnippet = cleanHtmlSnippet(finalSelectedParent);

    isGeneratingCode = true;
    updateCodegenButtonState();
    document.getElementById("ag-execute-btn").disabled = true;
    document.getElementById("ag-code-view").textContent =
      "# Code generation in progress...";

    addPanelLog(
      "Transmitting snippet to FastAPI control plane (http://127.0.0.1:8000)...",
    );

    const userContext =
      document.getElementById("ag-user-context-input")?.value || "";
    const webpageContext = {
      url: window.location.href,
      title: document.title || "",
      description:
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || "",
      keywords:
        document
          .querySelector('meta[name="keywords"]')
          ?.getAttribute("content") || "",
    };

    let collectionName = "visual_extract_items";
    if (isContextValid() && chrome.storage && chrome.storage.local) {
      try {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(["ag_selected_collection"], resolve);
        });
        if (result && result.ag_selected_collection) {
          collectionName = result.ag_selected_collection;
        }
      } catch (e) {
        console.error("Error reading collection name:", e);
      }
    }

    fetchFromBackend("http://127.0.0.1:8000/api/generate-parser", "POST", {
      html_snippet: htmlSnippet,
      context_url: window.location.href,
      user_context: userContext,
      webpage_context: webpageContext,
      collection_name: collectionName,
    })
      .then((data) => {
        isGeneratingCode = false;
        updateCodegenButtonState();

        if (data.success) {
          generatedCode = data.generated_code;
          inferredSelectors = data.selectors;
          deduplicationKeys = data.deduplication_keys || ["title"];

          document.getElementById("ag-code-view").textContent = generatedCode;
          document.getElementById("ag-execute-btn").disabled = false;

          addPanelLog(
            "BeautifulSoup parser generated successfully!",
            "success",
          );
          addPanelLog(
            `Inferred Selectors: ${JSON.stringify(inferredSelectors)}`,
            "success",
          );
          addPanelLog(
            `Recommended Deduplication Keys: ${JSON.stringify(deduplicationKeys)}`,
            "success",
          );
          autoSaveParser(generatedCode, inferredSelectors, deduplicationKeys);
        } else {
          addPanelLog(
            `Backend failed to generate code: ${data.message}`,
            "error",
          );
          document.getElementById("ag-code-view").textContent =
            `# Generation Failed:\n# ${data.message}`;
        }
      })
      .catch((err) => {
        isGeneratingCode = false;
        updateCodegenButtonState();
        addPanelLog(`Failed to connect to FastAPI: ${err.message}`, "error");
        addPanelLog(
          "Please check if the backend is running at http://127.0.0.1:8000",
          "error",
        );
        document.getElementById("ag-code-view").textContent =
          `# Connection Error:\n# Could not reach FastAPI server at http://127.0.0.1:8000\n# Error: ${err.message}`;
      });
  }

  /**
   * Auto-saves the generated parser code to chrome.storage.local
   */
  function autoSaveParser(code, selectors, dedupKeys) {
    if (!isContextValid() || !chrome.storage || !chrome.storage.local) {
      addPanelLog("Extension context invalid; auto-save skipped.", "error");
      return;
    }

    try {
      chrome.storage.local.get(["ag_saved_parsers"], (result) => {
        let parsers = result.ag_saved_parsers || [];

        const newParser = {
          id: "parser_" + Date.now(),
          url: window.location.href,
          domain: window.location.hostname,
          timestamp: Date.now(),
          code: code,
          selectors: selectors,
          deduplication_keys: dedupKeys || ["title"],
          title: document.title || window.location.hostname,
          detail_steps_enabled: detailStepsEnabled,
          expand_steps: expandSteps,
          close_steps: closeSteps,
          modal_selector: modalSelector,
        };

        const existingIdx = parsers.findIndex((p) => p.code === code);
        if (existingIdx !== -1) {
          parsers[existingIdx].timestamp = Date.now();
          parsers[existingIdx].url = window.location.href;
          parsers[existingIdx].title =
            document.title || window.location.hostname;
          parsers[existingIdx].deduplication_keys = dedupKeys || ["title"];
          parsers[existingIdx].detail_steps_enabled = detailStepsEnabled;
          parsers[existingIdx].expand_steps = expandSteps;
          parsers[existingIdx].close_steps = closeSteps;
          parsers[existingIdx].modal_selector = modalSelector;
        } else {
          parsers.unshift(newParser);
        }

        if (parsers.length > 50) {
          parsers = parsers.slice(0, 50);
        }

        chrome.storage.local.set({ ag_saved_parsers: parsers }, () => {
          addPanelLog("Parser automatically saved to history!", "success");
        });
      });
    } catch (e) {
      addPanelLog(`Failed to auto-save parser: ${e.message}`, "error");
    }
  }

  /**
   * Generates a signature of the current page content to detect updates
   */
  function getPageSignature() {
    if (selectedParent) {
      try {
        const children = Array.from(selectedParent.children);
        return children
          .slice(0, 3)
          .map((c) => c.textContent.trim())
          .join("|");
      } catch (e) {
        // Fallback
      }
    }
    return document.body ? document.body.textContent.slice(0, 500) : "";
  }

  /**
   * Runs the dry run parser execution against the full document HTML in the sandbox
   */
  /**
   * Runs the dry run parser execution against the full document HTML in the sandbox
   */
  async function runParserExecution() {
    if (!generatedCode) return;

    let collectionName = "visual_extract_items";
    if (isContextValid() && chrome.storage && chrome.storage.local) {
      try {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(["ag_selected_collection"], resolve);
        });
        if (result && result.ag_selected_collection) {
          collectionName = result.ag_selected_collection;
        }
      } catch (e) {
        console.error("Error reading collection name:", e);
      }
    }

    // Check if auto-pagination is toggled
    const isPaginateEnabled =
      document.getElementById("ag-paginate-toggle")?.checked;
    if (isPaginateEnabled) {
      if (!nextButtonSelector) {
        addPanelLog(
          "Please select a Next Page Button selector first.",
          "error",
        );
        return;
      }

      const maxPages =
        parseInt(document.getElementById("ag-max-pages").value, 10) || 3;
      const delay =
        parseInt(document.getElementById("ag-page-delay").value, 10) || 1500;

      addPanelLog(
        `Initializing pagination dry-run. Target: ${maxPages} pages.`,
        "info",
      );

      const firstPageHtml = await getExpandedPageHtml();

      const paginationState = {
        active: true,
        next_selector: nextButtonSelector,
        max_pages: maxPages,
        current_page: 1,
        collected_html: [firstPageHtml],
        generated_code: generatedCode,
        collection_name: collectionName,
        unique_key: deduplicationKeys[0] || "title",
        unique_keys: deduplicationKeys,
        delay: delay,
        last_signature: getPageSignature(),
      };

      if (isContextValid() && chrome.storage && chrome.storage.local) {
        try {
          isPaginationActive = true;
          updateCodegenButtonState();
          chrome.storage.local.set(
            { ag_pagination_state: paginationState },
            () => {
              runPaginationLoop();
            },
          );
        } catch (e) {
          isPaginationActive = false;
          updateCodegenButtonState();
          addPanelLog("Failed to write state: context invalidated.", "error");
        }
      } else {
        addPanelLog(
          "Extension context is invalid. Please reload the page.",
          "error",
        );
      }
      return;
    }

    addPanelLog("Capturing full document HTML for dry run...", "info");
    const fullHtml = await getExpandedPageHtml();

    document.getElementById("ag-execute-btn").disabled = true;
    addPanelLog(`Executing parser against page DOM inside backend sandbox (Collection: ${collectionName})...`);

    fetchFromBackend("http://127.0.0.1:8000/api/execute-parser", "POST", {
      generated_code: generatedCode,
      full_html: fullHtml,
      collection_name: collectionName,
      unique_key: deduplicationKeys[0] || "title",
      unique_keys: deduplicationKeys,
    })
      .then((data) => {
        document.getElementById("ag-execute-btn").disabled = false;

        if (data.success) {
          addPanelLog(
            `Parsed ${data.items_count} items successfully! Check results below.`,
            "success",
          );
          if (data.logs) {
            addPanelLog(`Backend logs:\n${data.logs}`);
          }

          const recordsView = document.getElementById("ag-records-view");
          recordsView.innerHTML = "";

          if (data.parsed_items && data.parsed_items.length > 0) {
            data.parsed_items.forEach((item, idx) => {
              const card = document.createElement("div");
              card.className = "ag-record-card";
              card.innerHTML = `
              <div style="font-weight: 700; color: #f8fafc; margin-bottom: 2px;">[${idx + 1}] ${item.title || "No Title"}</div>
              <div style="color: #34d399; margin-bottom: 4px;">Price: $${item.price !== undefined ? item.price : "N/A"}</div>
              <div style="color: #64748b; word-break: break-all;">Link: <a href="${item.source_url || "#"}" target="_blank" style="color: #a78bfa; text-decoration: none;">${item.source_url || "N/A"}</a></div>
            `;
              recordsView.appendChild(card);
            });
          } else {
            recordsView.innerHTML = `<p style="color: #64748b; font-size: 10px; margin: 0; font-style: italic;">Zero items returned by parser.</p>`;
          }
        } else {
          addPanelLog(`Execution failed: ${data.logs}`, "error");
        }
      })
      .catch((err) => {
        document.getElementById("ag-execute-btn").disabled = false;
        addPanelLog(`Execution request failed: ${err.message}`, "error");
      });
  }

  /**
   * Orchestrates the pagination loop step by step
   */
  function runPaginationLoop() {
    if (!isContextValid() || !chrome.storage || !chrome.storage.local) {
      addPanelLog(
        "Extension context is invalid. Aborting pagination loop.",
        "error",
      );
      isPaginationActive = false;
      updateCodegenButtonState();
      return;
    }

    try {
      chrome.storage.local.get(["ag_pagination_state"], (result) => {
        const state = result ? result.ag_pagination_state : null;
        if (!state || !state.active) return;

        if (state.current_page >= state.max_pages) {
          addPanelLog(
            "All requested pages captured. Submitting to backend parser...",
            "success",
          );
          finishPagination(state);
          return;
        }

        let nextBtn = document.querySelector(state.next_selector);
        if (nextBtn) {
          const clickableParent = nextBtn.closest("a, button");
          if (clickableParent) {
            nextBtn = clickableParent;
          }
        }
        if (!nextBtn) {
          addPanelLog(
            `Next page button not found using selector: '${state.next_selector}'. Completing extraction early with ${state.collected_html.length} pages.`,
            "error",
          );
          finishPagination(state);
          return;
        }

        addPanelLog(
          `Page ${state.current_page}/${state.max_pages} processed. Triggering navigation to next page...`,
          "info",
        );

        state.current_page += 1;
        if (isContextValid() && chrome.storage && chrome.storage.local) {
          try {
            chrome.storage.local.set({ ag_pagination_state: state }, () => {
              if (
                nextBtn.tagName === "A" &&
                nextBtn.href &&
                !nextBtn.href.startsWith("javascript:")
              ) {
                addPanelLog(`Manually navigating to: ${nextBtn.href}`, "info");
                window.location.href = nextBtn.href;
              } else {
                nextBtn.click();
              }

              let retries = 0;
              const maxRetries = 25; // 25 * 200ms = 5 seconds

              function checkSPAUpdate() {
                if (isUnloading) return;
                if (
                  isContextValid() &&
                  chrome.storage &&
                  chrome.storage.local
                ) {
                  try {
                    chrome.storage.local.get(["ag_pagination_state"], (res) => {
                      const current_state = res
                        ? res.ag_pagination_state
                        : null;
                      if (
                        current_state &&
                        current_state.active &&
                        current_state.current_page === state.current_page
                      ) {
                        const currentSignature = getPageSignature();
                        if (
                          currentSignature === current_state.last_signature &&
                          retries < maxRetries
                        ) {
                          retries++;
                          addPanelLog(
                            `Waiting for page content to update (retry ${retries}/${maxRetries})...`,
                            "info",
                          );
                          paginationTimeoutId = setTimeout(checkSPAUpdate, 200);
                          return;
                        }

                        addPanelLog(
                          `SPA/AJAX update detected. Capturing Page ${current_state.current_page}...`,
                          "info",
                        );
                        (async () => {
                          const expandedHtml = await getExpandedPageHtml();
                          current_state.collected_html.push(expandedHtml);
                          current_state.last_signature = currentSignature;
                          if (
                            isContextValid() &&
                            chrome.storage &&
                            chrome.storage.local
                          ) {
                            try {
                              chrome.storage.local.set(
                                { ag_pagination_state: current_state },
                                () => {
                                  runPaginationLoop();
                                },
                              );
                            } catch (e) {
                              addPanelLog(
                                "Failed to write state: context invalidated.",
                                "error",
                              );
                            }
                          }
                        })();
                      }
                    });
                  } catch (e) {
                    addPanelLog(
                      "Failed to read state: context invalidated.",
                      "error",
                    );
                  }
                }
              }

              paginationTimeoutId = setTimeout(checkSPAUpdate, state.delay);
            });
          } catch (e) {
            addPanelLog("Failed to write state: context invalidated.", "error");
          }
        }
      });
    } catch (e) {
      addPanelLog("Failed to read state: context invalidated.", "error");
    }
  }

  /**
   * Finishes pagination and submits the HTML collection
   */
  function finishPagination(state) {
    submitAggregatedHtmls(
      state.collected_html,
      state.generated_code,
      state.collection_name,
      state.unique_key,
      state.unique_keys,
    );
    if (isContextValid() && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.remove(["ag_pagination_state"]);
      } catch (e) {
        // Ignore cleanup failure
      }
    }

    isPaginationActive = false;
    updateCodegenButtonState();
    const executeBtn = document.getElementById("ag-execute-btn");
    if (executeBtn) executeBtn.disabled = false;
  }

  /**
   * Sends the collected page HTML array to the backend for unified parsing
   */
  function submitAggregatedHtmls(
    htmls,
    code,
    collectionName,
    uniqueKey,
    uniqueKeys,
  ) {
    addPanelLog(
      `Submitting ${htmls.length} aggregated pages for parser execution...`,
      "info",
    );

    const executeBtn = document.getElementById("ag-execute-btn");
    if (executeBtn) executeBtn.disabled = true;

    fetchFromBackend("http://127.0.0.1:8000/api/execute-parser", "POST", {
      generated_code: code,
      full_htmls: htmls,
      collection_name: collectionName,
      unique_key: uniqueKey,
      unique_keys: uniqueKeys,
    })
      .then((data) => {
        if (executeBtn) executeBtn.disabled = false;

        if (data.success) {
          addPanelLog(
            `Parsed ${data.items_count} items across ${htmls.length} pages successfully! Check results below.`,
            "success",
          );
          if (data.logs) {
            addPanelLog(`Backend logs:\n${data.logs}`);
          }

          const recordsView = document.getElementById("ag-records-view");
          if (recordsView) {
            recordsView.innerHTML = "";
            if (data.parsed_items && data.parsed_items.length > 0) {
              data.parsed_items.forEach((item, idx) => {
                const card = document.createElement("div");
                card.className = "ag-record-card";
                card.innerHTML = `
                <div style="font-weight: 700; color: #f8fafc; margin-bottom: 2px;">[${idx + 1}] ${item.title || "No Title"}</div>
                <div style="color: #34d399; margin-bottom: 4px;">Price: $${item.price !== undefined ? item.price : "N/A"}</div>
                <div style="color: #64748b; word-break: break-all;">Link: <a href="${item.source_url || "#"}" target="_blank" style="color: #a78bfa; text-decoration: none;">${item.source_url || "N/A"}</a></div>
              `;
                recordsView.appendChild(card);
              });
            } else {
              recordsView.innerHTML = `<p style="color: #64748b; font-size: 10px; margin: 0; font-style: italic;">Zero items returned by parser.</p>`;
            }
          }
        } else {
          addPanelLog(`Execution failed: ${data.logs}`, "error");
        }
      })
      .catch((err) => {
        if (executeBtn) executeBtn.disabled = false;
        addPanelLog(
          `Aggregated execution request failed: ${err.message}`,
          "error",
        );
      });
  }

  /**
   * Resumes a stored active pagination session after page navigation
   */
  function checkAndResumePagination() {
    if (!isContextValid() || !chrome.storage || !chrome.storage.local) return;
    try {
      chrome.storage.local.get(["ag_pagination_state"], (result) => {
        const state = result ? result.ag_pagination_state : null;
        if (state && state.active) {
          console.log(
            "🔄 Antigravity: Resuming pagination session from storage...",
            state,
          );

          isPaginationActive = true;
          generatedCode = state.generated_code;
          nextButtonSelector = state.next_selector;

          injectPanel();

          const panel = document.getElementById("antigravity-depth-panel");
          if (panel) {
            panel.classList.add("active");

            document.getElementById("ag-paginate-toggle").checked = true;
            document.getElementById("ag-pagination-controls").style.display =
              "flex";
            document.getElementById("ag-next-selector-input").value =
              nextButtonSelector;
            document.getElementById("ag-max-pages").value = state.max_pages;
            document.getElementById("ag-page-delay").value = state.delay;

            updateCodegenButtonState();
            document.getElementById("ag-execute-btn").disabled = true;
            document.getElementById("ag-code-view").textContent = generatedCode;
          }

          addPanelLog(
            `Resuming pagination: Page ${state.current_page}/${state.max_pages} loaded.`,
            "info",
          );

          if (state.collected_html.length < state.current_page) {
            (async () => {
              const expandedHtml = await getExpandedPageHtml();
              state.collected_html.push(expandedHtml);
              state.last_signature = getPageSignature();
              if (isContextValid() && chrome.storage && chrome.storage.local) {
                try {
                  chrome.storage.local.set(
                    { ag_pagination_state: state },
                    () => {
                      paginationTimeoutId = setTimeout(() => {
                        if (isUnloading) return;
                        runPaginationLoop();
                      }, state.delay);
                    },
                  );
                } catch (e) {
                  addPanelLog(
                    "Failed to write resume state: context invalidated.",
                    "error",
                  );
                }
              }
            })();
          } else {
            paginationTimeoutId = setTimeout(() => {
              if (isUnloading) return;
              runPaginationLoop();
            }, state.delay);
          }
        }
      });
    } catch (e) {
      console.error("Error in checkAndResumePagination:", e);
    }
  }

  let isSelectingTargetAfterRecord = false;

  function saveRecordingState() {
    if (isContextValid() && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({
          ag_recording_state: {
            active: isRecording,
            phase: recordingPhase,
            expand_actions: recordedExpandActions,
            close_actions: recordedCloseActions,
            last_action_time: lastActionTime,
          },
        });
      } catch (e) {
        // ignore
      }
    }
  }

  function clearRecordingState() {
    if (isContextValid() && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.remove(["ag_recording_state"]);
      } catch (e) {
        // ignore
      }
    }
  }

  function getRecordingClickCount() {
    const expandClicks = recordedExpandActions.filter(
      (a) => a.type === "click",
    ).length;
    const closeClicks = recordedCloseActions.filter(
      (a) => a.type === "click",
    ).length;
    return expandClicks + closeClicks;
  }

  function toggleRecordingPhase() {
    if (recordingPhase === "expand") {
      recordingPhase = "close";
      addPanelLog("Switched recorder to Close Steps phase.", "info");
    } else {
      recordingPhase = "expand";
      addPanelLog("Switched recorder to Expand Steps phase.", "info");
    }
    saveRecordingState();
  }

  function cancelRecordingSession() {
    isRecording = false;
    isSelectingTargetAfterRecord = false;
    recordedExpandActions = [];
    recordedCloseActions = [];
    removeRecorderBar();
    clearRecordingState();
    hoverEnabled = false;
    overlay.style.display = "none";
    addPanelLog("Recording session cancelled.", "info");
  }

  function finalizeRecordingSession() {
    isRecording = false;
    isSelectingTargetAfterRecord = true;
    removeRecorderBar();
    clearRecordingState();
    addPanelLog(
      "Action recording finalized. Please hover and click the item element to define scope.",
      "success",
    );
  }

  function showRecorderBar() {
    removeRecorderBar();

    if (!document.getElementById("antigravity-recorder-styles")) {
      const style = document.createElement("style");
      style.id = "antigravity-recorder-styles";
      style.textContent = `
        #antigravity-recorder-bar {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 40px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #f8fafc;
          pointer-events: auto;
          user-select: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ag-rec-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: #818cf8;
        }

        .ag-rec-divider {
          color: rgba(255, 255, 255, 0.2);
          font-size: 14px;
        }

        .ag-rec-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .ag-rec-pulse-dot {
          width: 8px;
          height: 8px;
          background-color: #ef4444;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          animation: ag-pulse 1.6s infinite;
        }

        @keyframes ag-pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }

        #ag-rec-phase-text {
          font-weight: 700;
          color: #fb923c;
        }

        #ag-rec-count-text {
          font-weight: 700;
          color: #34d399;
        }

        .ag-rec-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 20px;
          transition: all 0.2s ease;
        }

        .ag-rec-btn:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.1);
        }

        .ag-rec-btn-done {
          color: #34d399;
          background: rgba(52, 211, 153, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.2);
        }

        .ag-rec-btn-done:hover {
          color: #10b981;
          background: rgba(52, 211, 153, 0.2);
          border-color: rgba(52, 211, 153, 0.4);
        }
      `;
      document.head.appendChild(style);
    }

    const bar = document.createElement("div");
    bar.id = "antigravity-recorder-bar";
    bar.innerHTML = `
      <div class="ag-rec-title">ANTIGRAVITY ADVANCED RECORDER</div>
      <div class="ag-rec-divider">|</div>
      <div class="ag-rec-status">
        <span class="ag-rec-pulse-dot"></span>
        Recording: <span id="ag-rec-phase-text">Expand Steps</span> (<span id="ag-rec-count-text">0</span>)
      </div>
      <div class="ag-rec-divider">|</div>
      <button id="ag-rec-toggle-phase-btn" class="ag-rec-btn">[Switch to Close Steps]</button>
      <div class="ag-rec-divider">|</div>
      <button id="ag-rec-finalize-btn" class="ag-rec-btn ag-rec-btn-done">[Done: Select Catalog Item]</button>
    `;

    document.body.appendChild(bar);

    document
      .getElementById("ag-rec-toggle-phase-btn")
      .addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleRecordingPhase();
        updateRecorderBarUI();

        if (isContextValid()) {
          try {
            chrome.runtime.sendMessage({
              action: "actionRecorded",
              phase: recordingPhase,
              count: getRecordingClickCount(),
              elementTag: "phase-toggle",
            });
          } catch (err) {}
        }
      });

    document
      .getElementById("ag-rec-finalize-btn")
      .addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        finalizeRecordingSession();

        if (isContextValid()) {
          try {
            chrome.runtime.sendMessage({ action: "recordingFinalized" });
          } catch (err) {}
        }
      });

    updateRecorderBarUI();
  }

  function updateRecorderBarUI() {
    const phaseText = document.getElementById("ag-rec-phase-text");
    const countText = document.getElementById("ag-rec-count-text");
    const toggleBtn = document.getElementById("ag-rec-toggle-phase-btn");

    if (phaseText) {
      phaseText.textContent =
        recordingPhase === "expand" ? "Expand Steps" : "Close Steps";
      phaseText.style.color =
        recordingPhase === "expand" ? "#fb923c" : "#f87171";
    }
    if (countText) {
      countText.textContent = getRecordingClickCount();
    }
    if (toggleBtn) {
      toggleBtn.textContent =
        recordingPhase === "expand"
          ? "[Switch to Close Steps]"
          : "[Switch to Expand Steps]";
    }
  }

  function removeRecorderBar() {
    const bar = document.getElementById("antigravity-recorder-bar");
    if (bar) bar.remove();
  }

  function generateFullUniqueCssSelector(el) {
    if (!el) return "";
    if (el === document.body) return "body";
    if (el === document.documentElement) return "html";
    let parts = [];
    let cur = el;
    while (cur && cur.tagName !== "BODY" && cur.tagName !== "HTML") {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += `#${cur.id}`;
      }
      if (cur.className && typeof cur.className === "string") {
        const classes = cur.className
          .split(/\s+/)
          .filter(
            (c) =>
              c &&
              !c.startsWith("antigravity") &&
              !c.startsWith("selected") &&
              c.trim() !== "",
          );
        if (classes.length > 0) {
          part += `.${classes.join(".")}`;
        }
      }
      if (cur.parentElement) {
        const siblings = Array.from(cur.parentElement.children);
        const idx = siblings.indexOf(cur) + 1;
        part += `:nth-child(${idx})`;
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    parts.unshift("body");
    return parts.join(" > ");
  }

  function getRelativeSelector(fullSelector, parentSelector, parentElement) {
    const el = document.querySelector(fullSelector);
    if (el && parentElement && parentElement.contains(el)) {
      return generateRelativeCssSelector(el, parentElement);
    }
    if (fullSelector.startsWith(parentSelector + " > ")) {
      let rel = fullSelector.slice(parentSelector.length + 3);
      let cleanRel = rel.replace(/:nth-child\(\d+\)/g, "");
      return cleanRel;
    }
    return fullSelector;
  }

  function generateRelativeCssSelector(el, parent) {
    if (!parent || !parent.contains(el) || el === parent) {
      return generateCssSelector(el);
    }
    let parts = [];
    let cur = el;
    while (cur && cur !== parent) {
      let part = cur.tagName.toLowerCase();
      if (cur.className && typeof cur.className === "string") {
        const classes = cur.className
          .split(/\s+/)
          .filter(
            (c) =>
              c &&
              !c.startsWith("antigravity") &&
              !c.startsWith("selected") &&
              c.trim() !== "",
          );
        if (classes.length > 0) {
          part += `.${classes.join(".")}`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  function getItemContainerOfClicked(clicked, parent) {
    if (!parent || !clicked || !parent.contains(clicked)) return null;
    let cur = clicked;
    while (
      cur &&
      cur.parentElement !== parent &&
      cur.parentElement !== document.body
    ) {
      cur = cur.parentElement;
    }
    return cur;
  }

  function processRecordedActions(parent) {
    if (recordedExpandActions.length === 0 && recordedCloseActions.length === 0)
      return;

    const itemContainer = getItemContainerOfClicked(clickedElement, parent);

    expandSteps = mapRecordedActionsToSteps(
      recordedExpandActions,
      itemContainer,
    );
    closeSteps = mapRecordedActionsToSteps(recordedCloseActions, itemContainer);

    detailStepsEnabled = true;

    // Refresh UI
    renderDetailSteps();
  }

  function mapRecordedActionsToSteps(actions, itemContainer) {
    const steps = [];
    const parentSelector = itemContainer
      ? generateFullUniqueCssSelector(itemContainer)
      : null;

    actions.forEach((action) => {
      if (action.type === "wait") {
        steps.push({ type: "wait", target: action.target });
      } else if (action.type === "click") {
        let isInside = false;
        let relativeSelector = "";

        if (action.element && action.element.isConnected && itemContainer) {
          if (itemContainer.contains(action.element)) {
            isInside = true;
            relativeSelector = generateRelativeCssSelector(
              action.element,
              itemContainer,
            );
          }
        } else if (parentSelector && action.fullSelector) {
          if (
            action.fullSelector === parentSelector ||
            action.fullSelector.startsWith(parentSelector + " > ")
          ) {
            isInside = true;
            relativeSelector = getRelativeSelector(
              action.fullSelector,
              parentSelector,
              itemContainer,
            );
          }
        }

        if (isInside) {
          steps.push({ type: "click_relative", target: relativeSelector });
        } else {
          steps.push({
            type: "click_absolute",
            target: action.selector || action.fullSelector,
          });
        }
      }
    });
    return steps;
  }

  function renderDetailSteps() {
    const toggle = document.getElementById("ag-details-toggle");
    if (toggle) toggle.checked = detailStepsEnabled;

    const controls = document.getElementById("ag-details-controls");
    if (controls) controls.style.display = detailStepsEnabled ? "flex" : "none";

    const modalInput = document.getElementById("ag-modal-selector");
    if (modalInput) modalInput.value = modalSelector;

    const expandContainer = document.getElementById("ag-expand-steps-list");
    if (expandContainer) {
      expandContainer.innerHTML = "";
      expandSteps.forEach((step, idx) => {
        expandContainer.appendChild(createStepRowHTML("expand", step, idx));
      });
    }

    const closeContainer = document.getElementById("ag-close-steps-list");
    if (closeContainer) {
      closeContainer.innerHTML = "";
      closeSteps.forEach((step, idx) => {
        closeContainer.appendChild(createStepRowHTML("close", step, idx));
      });
    }
  }

  function createStepRowHTML(phase, step, idx) {
    const row = document.createElement("div");
    row.className = "ag-step-row";
    Object.assign(row.style, {
      display: "flex",
      gap: "6px",
      alignItems: "center",
      marginTop: "4px",
    });
    row.setAttribute("data-phase", phase);
    row.setAttribute("data-index", idx);

    let placeholder = "Selector inside item";
    if (step.type === "click_absolute") placeholder = "Selector on page";
    else if (step.type === "wait") placeholder = "Delay in ms";

    row.innerHTML = `
      <select class="ag-input ag-step-type" style="flex: 1.2; height: 28px; padding: 2px 4px; font-size: 9px; line-height: 1.2;">
        <option value="click_relative" ${step.type === "click_relative" ? "selected" : ""}>Click (Rel)</option>
        <option value="click_absolute" ${step.type === "click_absolute" ? "selected" : ""}>Click (Abs)</option>
        <option value="wait" ${step.type === "wait" ? "selected" : ""}>Wait (ms)</option>
      </select>
      <input type="text" class="ag-input ag-step-target" placeholder="${placeholder}" value="${step.target || ""}" style="flex: 2; height: 28px; font-size: 9.5px; line-height: 1.2;">
      ${
        step.type !== "wait"
          ? `
        <button class="ag-btn ag-btn-secondary ag-pick-step-btn" style="flex: 0.4; height: 28px; padding: 0 4px; min-height: 28px; font-size: 9px;">
          Pick
        </button>
      `
          : ""
      }
      <button class="ag-btn ag-btn-secondary ag-delete-step-btn" style="flex: 0.3; height: 28px; padding: 0; min-height: 28px; color: var(--color-brand-rose); font-size: 14px; font-weight: bold;">
        &times;
      </button>
    `;

    const typeSelect = row.querySelector(".ag-step-type");
    const targetInput = row.querySelector(".ag-step-target");
    const pickBtn = row.querySelector(".ag-pick-step-btn");
    const deleteBtn = row.querySelector(".ag-delete-step-btn");

    typeSelect.addEventListener("change", (e) => {
      step.type = e.target.value;
      if (step.type === "wait") {
        step.target = "500";
      } else {
        step.target = "";
      }
      renderDetailSteps();
    });

    targetInput.addEventListener("input", (e) => {
      step.target = e.target.value;
    });

    if (pickBtn) {
      pickBtn.addEventListener("click", () => {
        startPickingForStep(phase, idx);
      });
    }

    deleteBtn.addEventListener("click", () => {
      if (phase === "expand") {
        expandSteps.splice(idx, 1);
      } else {
        closeSteps.splice(idx, 1);
      }
      renderDetailSteps();
    });

    return row;
  }

  function startPickingForStep(phase, idx) {
    pickingStepIndex = `${phase}_${idx}`;
    hoverEnabled = true;
    addPanelLog(
      `Click on the target element on the page to set selector...`,
      "info",
    );

    const row = document.querySelector(
      `.ag-step-row[data-phase="${phase}"][data-index="${idx}"]`,
    );
    if (row) {
      const pickBtn = row.querySelector(".ag-pick-step-btn");
      if (pickBtn) {
        pickBtn.textContent = "Click...";
        pickBtn.style.color = "var(--color-brand-emerald)";
      }
    }
  }

  function startPickingForModal() {
    pickingStepIndex = "modal";
    hoverEnabled = true;
    addPanelLog(
      `Click on the modal/popup element on the page to set selector...`,
      "info",
    );

    const pickBtn = document.getElementById("ag-pick-modal-btn");
    if (pickBtn) {
      pickBtn.textContent = "Click...";
      pickBtn.style.color = "var(--color-brand-emerald)";
    }
  }

  async function executeStepsForElement(item, steps) {
    for (const step of steps) {
      if (step.type === "click_relative") {
        if (step.target) {
          const target = item.querySelector(step.target);
          if (target) {
            target.scrollIntoView({ block: "nearest" });
            target.click();
          } else {
            addPanelLog(
              `  [Step warning] Relative target not found: '${step.target}'`,
              "error",
            );
          }
        }
      } else if (step.type === "click_absolute") {
        if (step.target) {
          const target = document.querySelector(step.target);
          if (target) {
            target.scrollIntoView({ block: "nearest" });
            target.click();
          } else {
            addPanelLog(
              `  [Step warning] Absolute target not found: '${step.target}'`,
              "error",
            );
          }
        }
      } else if (step.type === "wait") {
        const ms = parseInt(step.target, 10) || 500;
        await new Promise((resolve) => setTimeout(resolve, ms));
      }
    }
  }

  async function getExpandedPageHtml() {
    if (
      !detailStepsEnabled ||
      (expandSteps.length === 0 && closeSteps.length === 0)
    ) {
      return document.documentElement.outerHTML;
    }

    const itemSel = inferredSelectors?.item_selector;
    if (!itemSel) {
      addPanelLog(
        "Warning: No item selector found. Skipping detail steps.",
        "error",
      );
      return document.documentElement.outerHTML;
    }

    const items = Array.from(document.querySelectorAll(itemSel));
    if (items.length === 0) {
      addPanelLog(
        `No items found matching selector: '${itemSel}'. Skipping detail steps.`,
        "info",
      );
      return document.documentElement.outerHTML;
    }

    addPanelLog(
      `Executing detail expansion for ${items.length} items on page...`,
      "info",
    );

    const expandedItemHtmls = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      addPanelLog(`  Expanding item ${i + 1}/${items.length}...`, "info");

      await executeStepsForElement(item, expandSteps);

      const itemClone = item.cloneNode(true);

      if (modalSelector) {
        const modalEl = document.querySelector(modalSelector);
        if (modalEl) {
          itemClone.appendChild(modalEl.cloneNode(true));
        }
      }

      expandedItemHtmls.push(itemClone.outerHTML);

      await executeStepsForElement(item, closeSteps);
    }

    const pageClone = document.documentElement.cloneNode(true);

    const panelInClone = pageClone.querySelector("#antigravity-depth-panel");
    if (panelInClone) panelInClone.remove();

    const clonedItems = pageClone.querySelectorAll(itemSel);
    clonedItems.forEach((clonedItem, idx) => {
      if (expandedItemHtmls[idx]) {
        const parent = clonedItem.parentNode;
        if (parent) {
          const temp = document.createElement("div");
          temp.innerHTML = expandedItemHtmls[idx];
          const newChild = temp.firstElementChild;
          if (newChild) {
            parent.replaceChild(newChild, clonedItem);
          }
        }
      }
    });

    addPanelLog("Detail expansion steps completed successfully.", "success");
    return pageClone.outerHTML;
  }

  /**
   * Injects CSS and DOM structure of depth panel into page
   */
  function injectPanel() {
    if (document.getElementById("antigravity-depth-panel")) return;

    // Inject CSS styles
    const styleEl = document.createElement("style");
    styleEl.id = "antigravity-panel-styles";
    styleEl.textContent = `
      #antigravity-depth-panel {
        /* Solarized Light (Neomorphic Cream & Teal) variables */
        --font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        --font-mono: 'Lora', 'Courier New', serif;
        --color-bg: #f5f0e6;
        --color-card-bg: #ebe5d8;
        --color-border: rgba(15, 118, 110, 0.25);
        --color-text-white: #0f172a;
        --color-text-primary: #2d3748;
        --color-text-muted: #718096;
        --color-brand-violet: #0f766e;
        --color-brand-emerald: #15803d;
        --color-brand-rose: #be123c;
        
        --border-radius-main: 0px;
        --border-radius-inner: 10px;
        --border-radius-pill: 20px;
        --border-style-main: none;
        
        --color-gradient-start: #0f766e;
        --color-gradient-end: #0f766e;
        --terminal-bg: #eee8d5;
        
        --ag-btn-primary-bg: #f5f0e6;
        --ag-btn-primary-text: var(--color-brand-violet);
        --ag-btn-primary-border: 1px solid rgba(15, 118, 110, 0.15);
        --ag-btn-primary-shadow: 4px 4px 8px #e3dbcc, -4px -4px 8px #ffffff;
        
        --ag-btn-secondary-bg: #f5f0e6;
        --ag-btn-secondary-text: var(--color-text-primary);
        --ag-btn-secondary-border: 1px solid rgba(15, 118, 110, 0.15);
        
        --slider-thumb-radius: 50%;
        --slider-thumb-bg: var(--color-brand-violet);
        --slider-thumb-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        --slider-thumb-border: 1px solid rgba(255, 255, 255, 0.4);
        
        position: fixed;
        top: 0;
        right: -420px;
        width: 400px;
        height: 100vh;
        background: var(--color-bg);
        border-left: 1px solid rgba(15, 118, 110, 0.15);
        box-shadow: -8px 0 16px rgba(0,0,0,0.05);
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        color: var(--color-text-white);
        font-family: var(--font-sans);
        transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease, border 0.3s ease;
        box-sizing: border-box;
      }
      #antigravity-depth-panel.active {
        right: 0;
      }
      #antigravity-depth-panel * {
        box-sizing: border-box;
        font-family: inherit;
      }
      .ag-panel-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--color-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .ag-panel-title-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ag-panel-title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.05em;
        background: transparent;
        color: var(--color-brand-violet);
        margin: 0;
      }
      .ag-panel-close {
        background: none;
        border: none;
        color: var(--color-text-muted);
        font-size: 20px;
        cursor: pointer;
        transition: color 0.2s;
        padding: 0 4px;
      }
      .ag-panel-close:hover {
        color: var(--color-brand-rose);
      }
      .ag-panel-body {
        padding: 20px;
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .ag-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .ag-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .ag-scrollbar::-webkit-scrollbar-thumb {
        background: var(--color-border);
        border-radius: 2px;
      }
      .ag-panel-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ag-section-label {
        font-size: 9.5px;
        color: var(--color-brand-violet);
        font-family: var(--font-mono);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .ag-slider-container {
        background: #f5f0e6;
        border: none;
        border-radius: var(--border-radius-inner);
        padding: 12px 16px;
        box-shadow: inset 3px 3px 6px #e3dbcc, inset -3px -3px 6px #ffffff;
      }
      .ag-slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .ag-slider-title {
        font-size: 11px;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .ag-depth-value {
        font-size: 12px;
        font-weight: 700;
        color: var(--color-brand-emerald);
        font-family: var(--font-mono);
      }
      .ag-slider {
        -webkit-appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #e5dec9;
        outline: none;
        margin: 8px 0;
      }
      .ag-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: var(--slider-thumb-radius, 50%);
        background: var(--slider-thumb-bg);
        cursor: pointer;
        box-shadow: var(--slider-thumb-shadow);
        border: var(--slider-thumb-border);
      }
      .ag-tree-path {
        font-family: var(--font-mono);
        font-size: 10px;
        background: var(--terminal-bg);
        border: none;
        padding: 8px 12px;
        border-radius: var(--border-radius-inner);
        overflow-x: auto;
        white-space: nowrap;
        box-shadow: inset 2px 2px 5px #e3dbcc, inset -2px -2px 5px #ffffff;
      }
      .ag-tree-item {
        color: var(--color-text-muted);
      }
      .ag-tree-arrow {
        color: var(--color-text-muted);
        margin: 0 4px;
      }
      .ag-tree-item.selected {
        color: var(--color-brand-emerald);
        font-weight: 700;
      }
      .ag-terminal {
        background: var(--terminal-bg) !important;
        border: none !important;
        border-radius: var(--border-radius-inner) !important;
        padding: 10px;
        font-family: var(--font-mono) !important;
        font-size: 10px !important;
        height: 140px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
        box-shadow: inset 3px 3px 6px #e3dbcc, inset -3px -3px 6px #ffffff !important;
      }
      .ag-terminal p {
        margin: 0 !important;
        line-height: 1.4 !important;
        white-space: pre-wrap !important;
        word-break: break-all !important;
        background: transparent !important;
        font-family: var(--font-mono) !important;
      }
      .ag-log-system {
        color: var(--color-brand-violet) !important;
      }
      .ag-log-success {
        color: var(--color-brand-emerald) !important;
      }
      .ag-log-error {
        color: var(--color-brand-rose) !important;
      }
      .ag-log-info {
        color: var(--color-text-primary) !important;
      }
      .ag-code-container {
        position: relative;
        background: var(--terminal-bg) !important;
        border: none !important;
        border-radius: var(--border-radius-inner) !important;
        padding: 10px;
        height: 180px;
        overflow-y: auto;
        box-shadow: inset 3px 3px 6px #e3dbcc, inset -3px -3px 6px #ffffff !important;
      }
      .ag-code-block {
        font-family: var(--font-mono) !important;
        font-size: 9.5px !important;
        color: var(--color-text-primary) !important;
        white-space: pre !important;
        margin: 0 !important;
        background: transparent !important;
      }
      .ag-copy-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        background: #f5f0e6;
        border: 1px solid rgba(15, 118, 110, 0.15);
        border-radius: 4px;
        color: var(--color-brand-violet);
        font-size: 9px;
        padding: 3px 6px;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 2px 2px 4px rgba(0,0,0,0.05);
      }
      .ag-copy-btn:hover {
        box-shadow: 1px 1px 2px rgba(0,0,0,0.05);
      }
      .ag-records-container {
        background: var(--terminal-bg) !important;
        border: none !important;
        border-radius: var(--border-radius-inner) !important;
        padding: 10px;
        height: 140px;
        overflow-y: auto;
        box-shadow: inset 3px 3px 6px #e3dbcc, inset -3px -3px 6px #ffffff !important;
      }
      .ag-record-card {
        background: var(--color-card-bg) !important;
        border: var(--border-style-main) !important;
        border-radius: var(--border-radius-inner) !important;
        padding: 6px 8px !important;
        margin-bottom: 6px !important;
        font-family: var(--font-mono) !important;
        font-size: 9.5px !important;
        color: var(--color-text-primary) !important;
        box-shadow: 2px 2px 4px rgba(0,0,0,0.04);
      }
      .ag-btn-group {
        display: flex;
        gap: 8px;
      }
      .ag-btn {
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        padding: 8px 12px;
        border-radius: var(--border-radius-inner);
        cursor: pointer;
        transition: all 0.15s ease;
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
      }
      .ag-btn-primary {
        color: var(--ag-btn-primary-text, white) !important;
        background: var(--ag-btn-primary-bg) !important;
        border: var(--ag-btn-primary-border) !important;
        box-shadow: var(--ag-btn-primary-shadow) !important;
      }
      .ag-btn-secondary {
        color: var(--ag-btn-secondary-text) !important;
        background: var(--ag-btn-secondary-bg) !important;
        border: var(--ag-btn-secondary-border) !important;
      }
      .ag-btn:hover {
        box-shadow: 2px 2px 4px #e3dbcc, -2px -2px 4px #ffffff !important;
      }
      .ag-btn:active {
        box-shadow: inset 3px 3px 6px #e3dbcc, inset -3px -3px 6px #ffffff !important;
      }
      .ag-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .switch {
        position: relative;
        display: inline-block;
        width: 38px;
        height: 22px;
      }
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #fee2e2;
        border: 1px solid rgba(190, 18, 60, 0.12);
        transition: all .3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 20px;
        box-shadow: inset 2px 2px 5px rgba(190, 18, 60, 0.08), 
                    inset -2px -2px 5px #ffffff;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: #be123c;
        transition: all .3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 50%;
        box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.15), 
                    -1px -1px 3px rgba(255, 255, 255, 0.9);
      }
      .switch input:checked + .slider {
        background-color: #d1fae5 !important;
        border-color: rgba(21, 128, 61, 0.2) !important;
        box-shadow: inset 2px 2px 5px rgba(21, 128, 61, 0.08), 
                    inset -2px -2px 5px #ffffff !important;
      }
      .switch input:checked + .slider:before {
        transform: translateX(18px) !important;
        background-color: #15803d !important;
      }
      .ag-input {
        background: var(--terminal-bg) !important;
        border: 1px solid var(--color-border) !important;
        border-radius: 4px !important;
        color: var(--color-text-primary) !important;
        font-size: 10px !important;
        padding: 4px 6px !important;
        font-family: var(--font-mono) !important;
        box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.08) !important;
        outline: none !important;
        transition: border-color 0.2s !important;
      }
      .ag-input:focus {
        border-color: var(--color-brand-violet) !important;
      }
      .ag-input-label {
        font-size: 9px !important;
        color: var(--color-text-muted) !important;
      }
    `;
    document.head.appendChild(styleEl);

    // Create Depth Panel HTML
    const panel = document.createElement("div");
    panel.id = "antigravity-depth-panel";
    panel.innerHTML = `
      <div class="ag-panel-header">
        <div class="ag-panel-title-container">
          <span class="ag-panel-title">ANTIGRAVITY CONTROL PANEL</span>
        </div>
        <button id="ag-close-panel-btn" class="ag-panel-close">&times;</button>
      </div>
      <div class="ag-panel-body ag-scrollbar">
        <!-- Depth Slider -->
        <div class="ag-panel-section">
          <span class="ag-section-label">1. Ancestor Depth Selection</span>
          <div class="ag-slider-container">
            <div class="ag-slider-header">
              <span class="ag-slider-title">Parent Container Level</span>
              <span id="ag-depth-val" class="ag-depth-value">0 (Self)</span>
            </div>
            <input type="range" id="ag-depth-slider" class="ag-slider" min="0" max="0" value="0">
          </div>
        </div>

        <!-- Hierarchy Breadcrumbs -->
        <div class="ag-panel-section">
          <span class="ag-section-label">2. Target Selector Tree</span>
          <div id="ag-tree-breadcrumbs" class="ag-tree-path ag-scrollbar">
            <!-- tags injected here -->
          </div>
        </div>

        <!-- User Context Input -->
        <div class="ag-panel-section">
          <span class="ag-section-label">3. Parsing Instructions / Context</span>
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
            <textarea id="ag-user-context-input" placeholder="Optional: Describe fields or instructions (e.g. 'Extract rating and rating count', 'This is a job board, extract salary')." class="ag-input" style="height: 50px; resize: vertical; width: 100%; box-sizing: border-box; font-family: inherit; font-size: 10px;"></textarea>
          </div>
        </div>

        <!-- Item Detail Expansion -->
        <div class="ag-panel-section" style="border-top: 1px solid var(--color-border); padding-top: 12px; margin-top: 4px;">
          <span class="ag-section-label">4. Item Detail Expansion</span>
          <div class="ag-slider-container" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="ag-slider-title">Enable Detail Expansion Steps</span>
              <label class="switch">
                <input type="checkbox" id="ag-details-toggle">
                <span class="slider"></span>
              </label>
            </div>
            <div id="ag-details-controls" style="display: none; flex-direction: column; gap: 8px; margin-top: 4px;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span class="ag-input-label">Modal Selector (Optional)</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <input type="text" id="ag-modal-selector" placeholder="e.g. .modal-content, .dialog" class="ag-input" style="flex: 1; height: 28px;">
                  <button id="ag-pick-modal-btn" class="ag-btn ag-btn-secondary" style="font-size: 10px; padding: 0 8px; min-height: 24px; height: 28px; flex: 0.3;">Pick</button>
                </div>
              </div>
              
              <!-- Expand Steps Container -->
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                <span class="ag-input-label" style="font-weight: 700; color: var(--color-brand-violet);">Expand Steps (Pre-Capture)</span>
                <div id="ag-expand-steps-list" style="display: flex; flex-direction: column; gap: 4px;">
                  <!-- Dynamically populated -->
                </div>
                <button id="ag-add-expand-step-btn" class="ag-btn ag-btn-secondary" style="font-size: 9px; padding: 2px 6px; min-height: 20px; height: 22px; width: 110px; margin-top: 2px;">
                  + Add Expand Step
                </button>
              </div>

              <!-- Close Steps Container -->
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px; border-top: 1px dashed rgba(15, 118, 110, 0.15); padding-top: 6px;">
                <span class="ag-input-label" style="font-weight: 700; color: var(--color-brand-violet);">Close Steps (Post-Capture)</span>
                <div id="ag-close-steps-list" style="display: flex; flex-direction: column; gap: 4px;">
                  <!-- Dynamically populated -->
                </div>
                <button id="ag-add-close-step-btn" class="ag-btn ag-btn-secondary" style="font-size: 9px; padding: 2px 6px; min-height: 20px; height: 22px; width: 100px; margin-top: 2px;">
                  + Add Close Step
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination Settings -->
        <div class="ag-panel-section" style="border-top: 1px solid var(--color-border); padding-top: 12px; margin-top: 4px;">
          <span class="ag-section-label">5. Pagination Settings</span>
          <div class="ag-slider-container" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="ag-slider-title">Enable Auto-Pagination</span>
              <label class="switch">
                <input type="checkbox" id="ag-paginate-toggle">
                <span class="slider"></span>
              </label>
            </div>
            <div id="ag-pagination-controls" style="display: none; flex-direction: column; gap: 8px; margin-top: 4px;">
              <div style="display: flex; gap: 8px; align-items: center;">
                <button id="ag-select-next-btn" class="ag-btn ag-btn-secondary" style="font-size: 10px; padding: 4px 8px; flex: 1; min-height: 24px; height: 28px;">
                  Select Next Button
                </button>
                <input type="text" id="ag-next-selector-input" placeholder="CSS Selector" class="ag-input" style="flex: 2; height: 28px;">
              </div>
              <div style="display: flex; gap: 12px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                  <span class="ag-input-label">Max Pages</span>
                  <input type="number" id="ag-max-pages" value="3" min="1" max="10" class="ag-input" style="height: 24px;">
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                  <span class="ag-input-label">Delay (ms)</span>
                  <input type="number" id="ag-page-delay" value="1500" min="200" max="10000" class="ag-input" style="height: 24px;">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="ag-panel-section" style="border-top: 1px solid var(--color-border); padding-top: 12px; margin-top: 4px;">
          <span class="ag-section-label">6. Scrape Actions</span>
          <div class="ag-btn-group">
            <button id="ag-codegen-btn" class="ag-btn ag-btn-primary">Generate Parser</button>
            <button id="ag-execute-btn" class="ag-btn ag-btn-secondary" disabled>Dry Run Execution</button>
          </div>
        </div>

        <!-- Terminal Logs -->
        <div class="ag-panel-section">
          <span class="ag-section-label">7. System Execution Logs</span>
          <div id="ag-terminal-logs" class="ag-terminal ag-scrollbar">
            <p class="ag-log-system">[system] Visual capture ready. Awaiting bounding box selection.</p>
          </div>
        </div>

        <!-- Generated Code Viewport -->
        <div class="ag-panel-section">
          <span class="ag-section-label">8. Generated Parser Code</span>
          <div class="ag-code-container ag-scrollbar">
            <button id="ag-copy-code-btn" class="ag-copy-btn">Copy</button>
            <pre id="ag-code-view" class="ag-code-block"># Standby. Awaiting code generation...</pre>
          </div>
        </div>

        <!-- Extracted Records -->
        <div class="ag-panel-section">
          <span class="ag-section-label">9. Extracted Catalog Items</span>
          <div id="ag-records-view" class="ag-records-container ag-scrollbar">
            <p style="color: #64748b; font-size: 10px; margin: 0; font-style: italic;">No records extracted yet.</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners
    document
      .getElementById("ag-close-panel-btn")
      .addEventListener("click", () => {
        closePanel();
      });

    const slider = document.getElementById("ag-depth-slider");
    slider.addEventListener("input", (e) => {
      const depth = parseInt(e.target.value, 10);
      handleDepthChange(depth);
    });

    document.getElementById("ag-codegen-btn").addEventListener("click", () => {
      runCodeGen();
    });

    document.getElementById("ag-execute-btn").addEventListener("click", () => {
      runParserExecution();
    });

    // Pagination Listeners
    document
      .getElementById("ag-paginate-toggle")
      .addEventListener("change", (e) => {
        const controls = document.getElementById("ag-pagination-controls");
        if (e.target.checked) {
          controls.style.display = "flex";
        } else {
          controls.style.display = "none";
        }
        updateCodegenButtonState();
      });

    document
      .getElementById("ag-select-next-btn")
      .addEventListener("click", () => {
        isSelectingNextButton = !isSelectingNextButton;
        const selectBtn = document.getElementById("ag-select-next-btn");
        if (isSelectingNextButton) {
          selectBtn.textContent = "Click Next Button on Page...";
          selectBtn.classList.remove("ag-btn-secondary");
          selectBtn.classList.add("ag-btn-primary");
          addPanelLog(
            "Hover and click the 'Next' page button on the website.",
            "info",
          );
        } else {
          selectBtn.textContent = "Select Next Button";
          selectBtn.classList.remove("ag-btn-primary");
          selectBtn.classList.add("ag-btn-secondary");
        }
      });

    document
      .getElementById("ag-next-selector-input")
      .addEventListener("input", (e) => {
        nextButtonSelector = e.target.value;
        updateCodegenButtonState();
      });

    document
      .getElementById("ag-copy-code-btn")
      .addEventListener("click", () => {
        if (generatedCode) {
          navigator.clipboard.writeText(generatedCode).then(() => {
            const btn = document.getElementById("ag-copy-code-btn");
            btn.textContent = "Copied!";
            setTimeout(() => {
              btn.textContent = "Copy";
            }, 2000);
            addPanelLog("Parser script copied to clipboard.", "success");
          });
        }
      });
    // Detail Triggering Listeners
    document
      .getElementById("ag-details-toggle")
      .addEventListener("change", (e) => {
        detailStepsEnabled = e.target.checked;
        document.getElementById("ag-details-controls").style.display =
          detailStepsEnabled ? "flex" : "none";
        if (
          detailStepsEnabled &&
          expandSteps.length === 0 &&
          closeSteps.length === 0
        ) {
          // Add default relative click step
          expandSteps.push({ type: "click_relative", target: "" });
        }
        renderDetailSteps();
      });

    document
      .getElementById("ag-modal-selector")
      .addEventListener("input", (e) => {
        modalSelector = e.target.value;
      });

    document
      .getElementById("ag-pick-modal-btn")
      .addEventListener("click", () => {
        startPickingForModal();
      });

    document
      .getElementById("ag-add-expand-step-btn")
      .addEventListener("click", () => {
        expandSteps.push({ type: "click_relative", target: "" });
        renderDetailSteps();
      });

    document
      .getElementById("ag-add-close-step-btn")
      .addEventListener("click", () => {
        closeSteps.push({ type: "click_absolute", target: "" });
        renderDetailSteps();
      });

    renderDetailSteps();
    updateCodegenButtonState();
  }

  // Check and resume any active pagination session
  checkAndResumePagination();

  function checkAndResumeRecording() {
    if (isContextValid() && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        ["ag_recording_state", "ag_extraction_mode"],
        (result) => {
          if (result && result.ag_extraction_mode) {
            extractionMode = result.ag_extraction_mode;
          }
          if (
            result &&
            result.ag_recording_state &&
            result.ag_recording_state.active
          ) {
            const state = result.ag_recording_state;
            isRecording = true;
            recordingPhase = state.phase || "expand";
            recordedExpandActions = state.expand_actions || [];
            recordedCloseActions = state.close_actions || [];
            lastActionTime = state.last_action_time || Date.now();

            showRecorderBar();
            addPanelLog(
              "Resumed active Advanced Mode recording session.",
              "info",
            );

            // Sync with popup if it is open
            if (isContextValid()) {
              try {
                chrome.runtime.sendMessage({
                  action: "actionRecorded",
                  phase: recordingPhase,
                  count: getRecordingClickCount(),
                  elementTag: "resume",
                });
              } catch (err) {}
            }
          }
        },
      );
    }
  }

  checkAndResumeRecording();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getStatus") {
      sendResponse({
        enabled: hoverEnabled,
        recordingActive: isRecording,
        phase: recordingPhase,
        count: getRecordingClickCount(),
        selectingTarget: isSelectingTargetAfterRecord,
      });
    } else if (message.action === "toggleHover") {
      extractionMode = message.mode || "simple";
      if (extractionMode === "advanced") {
        isRecording = message.enabled;
        if (isRecording) {
          recordedExpandActions = [];
          recordedCloseActions = [];
          recordingPhase = "expand";
          lastActionTime = Date.now();
          saveRecordingState();
          showRecorderBar();
          hoverEnabled = false;
          overlay.style.display = "none";
          addPanelLog(
            "Advanced Mode: Action recording session started.",
            "info",
          );
        } else {
          cancelRecordingSession();
        }
      } else {
        isRecording = false;
        removeRecorderBar();
        hoverEnabled = message.enabled;
        if (!hoverEnabled) {
          overlay.style.display = "none";
          currentTarget = null;
          closePanel();
        }
      }
      sendResponse({ status: "ok" });
    } else if (message.action === "toggleRecordingPhase") {
      toggleRecordingPhase();
      updateRecorderBarUI();
      sendResponse({ phase: recordingPhase, count: getRecordingClickCount() });
    } else if (message.action === "finalizeRecording") {
      finalizeRecordingSession();
      sendResponse({ status: "ok" });
    } else if (message.action === "resetHighlight") {
      overlay.style.display = "none";
      currentTarget = null;
      closePanel();
      sendResponse({ status: "ok" });
    } else if (message.action === "loadSavedParser") {
      injectPanel();
      const panel = document.getElementById("antigravity-depth-panel");
      if (panel) {
        panel.classList.add("active");
      }
      generatedCode = message.code;
      inferredSelectors = message.selectors;

      // Load saved detail steps if present
      detailStepsEnabled = message.detail_steps_enabled || false;
      expandSteps = message.expand_steps || [];
      closeSteps = message.close_steps || [];
      modalSelector = message.modal_selector || "";

      document.getElementById("ag-code-view").textContent = generatedCode;
      document.getElementById("ag-execute-btn").disabled = false;

      addPanelLog("Loaded saved parser from history!", "success");
      updateCodegenButtonState();
      renderDetailSteps();
      sendResponse({ status: "ok" });
    }
    return true; // Keep message channel open for async response
  });
})();
