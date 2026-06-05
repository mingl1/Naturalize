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
    boxShadow: "0 0 12px rgba(139, 92, 246, 0.4), inset 0 0 4px rgba(139, 92, 246, 0.2)",
    transition: "top 0.1s ease-out, left 0.1s ease-out, width 0.1s ease-out, height 0.1s ease-out",
    display: "none",
    boxSizing: "border-box"
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
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)"
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
    boxShadow: "0 0 16px rgba(52, 211, 153, 0.3), inset 0 0 6px rgba(52, 211, 153, 0.15)",
    transition: "top 0.15s ease-out, left 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out",
    display: "none",
    boxSizing: "border-box"
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
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)"
  });
  parentOverlay.appendChild(parentBadge);
  document.body.appendChild(parentOverlay);



  // Track hover movements
  document.addEventListener("mouseover", (e) => {
    if (!hoverEnabled) return;
    
    const target = e.target;

    // Do not highlight the overlays, badge, or panel itself
    if (
      target === overlay || overlay.contains(target) || 
      target === parentOverlay || parentOverlay.contains(target) ||
      target === document.body || target === document.documentElement ||
      document.getElementById("antigravity-depth-panel")?.contains(target)
    ) {
      return;
    }

    currentTarget = target;
    updateOverlay(target);
  }, true);

  document.addEventListener("mouseout", (e) => {
    if (e.target === currentTarget) {
      overlay.style.display = "none";
      currentTarget = null;
    }
  }, true);

  // Keep overlays in sync with scrolling/resizing
  window.addEventListener("scroll", () => {
    if (hoverEnabled && currentTarget) updateOverlay(currentTarget);
    if (selectedParent) updateParentOverlay(selectedParent);
  }, true);

  window.addEventListener("resize", () => {
    if (hoverEnabled && currentTarget) updateOverlay(currentTarget);
    if (selectedParent) updateParentOverlay(selectedParent);
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

    Object.assign(overlay.style, {
      display: "block",
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`
    });

    let label = target.tagName.toLowerCase();
    if (target.id) {
      label += `#${target.id}`;
    }
    if (target.className && typeof target.className === "string") {
      const classes = target.className.split(/\s+/).filter(c => c && !c.startsWith("antigravity")).slice(0, 2);
      if (classes.length > 0) {
        label += `.${classes.join(".")}`;
      }
    }
    
    label += ` [${Math.round(width)}x${Math.round(height)}]`;
    badge.textContent = label;

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
      height: `${height}px`
    });

    let label = `[Selected Bounding Box] ${target.tagName.toLowerCase()}`;
    if (target.id) {
      label += `#${target.id}`;
    }
    if (target.className && typeof target.className === "string") {
      const classes = target.className.split(/\s+/).filter(c => c && !c.startsWith("antigravity")).slice(0, 2);
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
  document.addEventListener("click", (e) => {
    if (!hoverEnabled) return;
    
    // Do not intercept clicks within our own panel or overlays
    if (
      e.target === overlay || overlay.contains(e.target) || 
      e.target === parentOverlay || parentOverlay.contains(e.target) ||
      document.getElementById("antigravity-depth-panel")?.contains(e.target)
    ) {
      return;
    }
    
    // Prevent normal link navigation/button clicks
    e.preventDefault();
    e.stopPropagation();

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
    
    addPanelLog(`Visual scope initiated for element: <${clickedElement.tagName.toLowerCase()}>`, "success");
  }, true);

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

    addPanelLog(`Traversed hierarchy: level ${depth} tag selected (${selectedParent.tagName.toLowerCase()})`);
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
      span.className = "ag-tree-item" + (i === selectedDepth ? " selected" : "");
      
      let text = el.tagName.toLowerCase();
      if (el.id) text += `#${el.id}`;
      else if (el.className && typeof el.className === "string") {
        const firstClass = el.className.split(/\s+/).filter(c => c && !c.startsWith("antigravity"))[0];
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
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      if (type === "success") {
        p.style.color = "#34d399";
        p.textContent = `[${timestamp}] [success] ${text}`;
      } else if (type === "error") {
        p.style.color = "#fb7185";
        p.textContent = `[${timestamp}] [error] ${text}`;
      } else {
        p.style.color = "#cbd5e1";
        p.textContent = `[${timestamp}] [log] ${text}`;
      }
      
      panelLogs.appendChild(p);
      panelLogs.scrollTop = panelLogs.scrollHeight;
    }

    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "logUpdate", text, type }).catch(() => {
        // Ignore failures when the extension popup is not open
      });
    }
  }

  /**
   * Cleans HTML container snippet to avoid payload bloating (removes SVG, scripts, canvas, base64 images)
   */
  function cleanHtmlSnippet(element) {
    const clone = element.cloneNode(true);
    
    const selectorsToRemove = ["script", "style", "noscript", "iframe", "svg", "canvas", "embed", "object"];
    selectorsToRemove.forEach(sel => {
      clone.querySelectorAll(sel).forEach(node => node.remove());
    });
    
    clone.querySelectorAll("img").forEach(img => {
      const src = img.getAttribute("src");
      if (src && src.startsWith("data:")) {
        img.setAttribute("src", "");
      }
    });

    clone.querySelectorAll("[id^='antigravity']").forEach(node => node.remove());

    return clone.innerHTML;
  }

  /**
   * Submits HTML snippet to FastAPI generate-parser endpoint
   */
  function runCodeGen() {
    if (!selectedParent) return;

    addPanelLog("Starting parsing pipeline...", "info");
    addPanelLog("Cleaning and sanitizing HTML snippet (removing scripts/media/base64)...");
    const htmlSnippet = cleanHtmlSnippet(selectedParent);
    
    document.getElementById("ag-codegen-btn").disabled = true;
    document.getElementById("ag-execute-btn").disabled = true;
    document.getElementById("ag-code-view").textContent = "# Code generation in progress...";
    
    addPanelLog("Transmitting snippet to FastAPI control plane (http://127.0.0.1:8000)...");
    
    fetch("http://127.0.0.1:8000/api/generate-parser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        html_snippet: htmlSnippet,
        context_url: window.location.href
      })
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      document.getElementById("ag-codegen-btn").disabled = false;
      
      if (data.success) {
        generatedCode = data.generated_code;
        inferredSelectors = data.selectors;
        
        document.getElementById("ag-code-view").textContent = generatedCode;
        document.getElementById("ag-execute-btn").disabled = false;
        
        addPanelLog("BeautifulSoup parser generated successfully!", "success");
        addPanelLog(`Inferred Selectors: ${JSON.stringify(inferredSelectors)}`, "success");
      } else {
        addPanelLog(`Backend failed to generate code: ${data.message}`, "error");
        document.getElementById("ag-code-view").textContent = `# Generation Failed:\n# ${data.message}`;
      }
    })
    .catch(err => {
      document.getElementById("ag-codegen-btn").disabled = false;
      addPanelLog(`Failed to connect to FastAPI: ${err.message}`, "error");
      addPanelLog("Please check if the backend is running at http://127.0.0.1:8000", "error");
      document.getElementById("ag-code-view").textContent = `# Connection Error:\n# Could not reach FastAPI server at http://127.0.0.1:8000\n# Error: ${err.message}`;
    });
  }

  /**
   * Runs the dry run parser execution against the full document HTML in the sandbox
   */
  function runParserExecution() {
    if (!generatedCode) return;
    
    addPanelLog("Capturing full document HTML for dry run...", "info");
    const fullHtml = document.documentElement.outerHTML;
    
    document.getElementById("ag-execute-btn").disabled = true;
    addPanelLog("Executing parser against page DOM inside backend sandbox...");

    fetch("http://127.0.0.1:8000/api/execute-parser", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        generated_code: generatedCode,
        full_html: fullHtml,
        collection_name: "visual_extract_items",
        unique_key: "title"
      })
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      document.getElementById("ag-execute-btn").disabled = false;
      
      if (data.success) {
        addPanelLog(`Parsed ${data.items_count} items successfully! Check results below.`, "success");
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
              <div style="color: #64748b; word-break: break-all;">Link: <a href="${item.source_url || '#'}" target="_blank" style="color: #a78bfa; text-decoration: none;">${item.source_url || "N/A"}</a></div>
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
    .catch(err => {
      document.getElementById("ag-execute-btn").disabled = false;
      addPanelLog(`Execution request failed: ${err.message}`, "error");
    });
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
        position: fixed;
        top: 0;
        right: -420px;
        width: 400px;
        height: 100vh;
        background: rgba(8, 7, 17, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-left: 1px solid rgba(139, 92, 246, 0.3);
        box-shadow: -10px 0 30px rgba(0, 0, 0, 0.8);
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        color: #f8fafc;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
      }
      #antigravity-depth-panel.active {
        right: 0;
      }
      #antigravity-depth-panel * {
        box-sizing: border-box;
      }
      .ag-panel-header {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(167, 139, 250, 0.15);
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
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.05em;
        background: linear-gradient(to right, #c084fc, #f472b6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
      }
      .ag-panel-close {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 20px;
        cursor: pointer;
        transition: color 0.2s;
        padding: 0 4px;
      }
      .ag-panel-close:hover {
        color: #fb7185;
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
        background: rgba(167, 139, 250, 0.25);
        border-radius: 2px;
      }
      .ag-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(167, 139, 250, 0.5);
      }
      .ag-panel-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ag-section-label {
        font-size: 10px;
        color: #a78bfa;
        font-family: monospace;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .ag-slider-container {
        background: rgba(15, 14, 30, 0.6);
        border: 1px solid rgba(167, 139, 250, 0.15);
        border-radius: 8px;
        padding: 12px 16px;
      }
      .ag-slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .ag-slider-title {
        font-size: 12px;
        font-weight: 600;
        color: #cbd5e1;
      }
      .ag-depth-value {
        font-size: 13px;
        font-weight: 700;
        color: #34d399;
        font-family: monospace;
      }
      .ag-slider {
        -webkit-appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #0f172a;
        outline: none;
        margin: 8px 0;
      }
      .ag-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8b5cf6, #d946ef);
        cursor: pointer;
        box-shadow: 0 0 8px rgba(139, 92, 246, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .ag-tree-path {
        font-family: monospace;
        font-size: 10px;
        background: #040309;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        overflow-x: auto;
        white-space: nowrap;
      }
      .ag-tree-item {
        color: #64748b;
      }
      .ag-tree-arrow {
        color: #475569;
        margin: 0 4px;
      }
      .ag-tree-item.selected {
        color: #34d399;
        font-weight: 700;
      }
      .ag-terminal {
        background: #020617;
        border: 1px solid rgba(139, 92, 246, 0.25);
        border-radius: 8px;
        padding: 10px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        height: 140px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ag-code-container {
        position: relative;
        background: #020617;
        border: 1px solid rgba(139, 92, 246, 0.25);
        border-radius: 8px;
        padding: 10px;
        height: 180px;
        overflow-y: auto;
      }
      .ag-code-block {
        font-family: 'JetBrains Mono', monospace;
        font-size: 9.5px;
        color: #e2e8f0;
        white-space: pre;
        margin: 0;
      }
      .ag-copy-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: #cbd5e1;
        font-size: 9px;
        padding: 3px 6px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .ag-copy-btn:hover {
        background: rgba(139, 92, 246, 0.25);
        border-color: rgba(139, 92, 246, 0.4);
      }
      .ag-records-container {
        background: #020617;
        border: 1px solid rgba(52, 211, 153, 0.25);
        border-radius: 8px;
        padding: 10px;
        height: 140px;
        overflow-y: auto;
      }
      .ag-record-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        padding: 6px 8px;
        margin-bottom: 6px;
        font-family: monospace;
        font-size: 9.5px;
      }
      .ag-record-card:last-child {
        margin-bottom: 0;
      }
      .ag-btn-group {
        display: flex;
        gap: 8px;
      }
      .ag-btn {
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
      }
      .ag-btn-primary {
        color: white;
        background: linear-gradient(to right, #7c3aed, #db2777);
        border: none;
        box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);
      }
      .ag-btn-primary:hover {
        background: linear-gradient(to right, #8b5cf6, #ec4899);
        box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
      }
      .ag-btn-secondary {
        color: #cbd5e1;
        background: rgba(30, 27, 75, 0.4);
        border: 1px solid rgba(139, 92, 246, 0.25);
      }
      .ag-btn-secondary:hover {
        background: rgba(139, 92, 246, 0.15);
        border-color: rgba(139, 92, 246, 0.45);
      }
      .ag-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
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

        <!-- Actions -->
        <div class="ag-panel-section">
          <span class="ag-section-label">3. Scrape Actions</span>
          <div class="ag-btn-group">
            <button id="ag-codegen-btn" class="ag-btn ag-btn-primary">Generate Parser</button>
            <button id="ag-execute-btn" class="ag-btn ag-btn-secondary" disabled>Dry Run Execution</button>
          </div>
        </div>

        <!-- Terminal Logs -->
        <div class="ag-panel-section">
          <span class="ag-section-label">4. System Execution Logs</span>
          <div id="ag-terminal-logs" class="ag-terminal ag-scrollbar">
            <p style="color: #a78bfa;">[system] Visual capture ready. Awaiting bounding box selection.</p>
          </div>
        </div>

        <!-- Generated Code Viewport -->
        <div class="ag-panel-section">
          <span class="ag-section-label">5. Generated Parser Code</span>
          <div class="ag-code-container ag-scrollbar">
            <button id="ag-copy-code-btn" class="ag-copy-btn">Copy</button>
            <pre id="ag-code-view" class="ag-code-block"># Standby. Awaiting code generation...</pre>
          </div>
        </div>

        <!-- Extracted Records -->
        <div class="ag-panel-section">
          <span class="ag-section-label">6. Extracted Catalog Items</span>
          <div id="ag-records-view" class="ag-records-container ag-scrollbar">
            <p style="color: #64748b; font-size: 10px; margin: 0; font-style: italic;">No records extracted yet.</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners
    document.getElementById("ag-close-panel-btn").addEventListener("click", () => {
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

    document.getElementById("ag-copy-code-btn").addEventListener("click", () => {
      if (generatedCode) {
        navigator.clipboard.writeText(generatedCode).then(() => {
          const btn = document.getElementById("ag-copy-code-btn");
          btn.textContent = "Copied!";
          setTimeout(() => { btn.textContent = "Copy"; }, 2000);
          addPanelLog("Parser script copied to clipboard.", "success");
        });
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getStatus") {
      sendResponse({ enabled: hoverEnabled });
    } else if (message.action === "toggleHover") {
      hoverEnabled = message.enabled;
      if (!hoverEnabled) {
        overlay.style.display = "none";
        currentTarget = null;
        closePanel();
      }
      sendResponse({ status: "ok" });
    } else if (message.action === "resetHighlight") {
      overlay.style.display = "none";
      currentTarget = null;
      closePanel();
      sendResponse({ status: "ok" });
    }
    return true; // Keep message channel open for async response
  });
})();
