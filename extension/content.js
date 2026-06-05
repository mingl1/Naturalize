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

  let hoverEnabled = true;
  let currentTarget = null;

  // Create highlight overlay container
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

  // Initialize state from storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["hoverEnabled"], (result) => {
      if (result.hasOwnProperty("hoverEnabled")) {
        hoverEnabled = result.hoverEnabled;
      }
    });
  }

  // Track hover movements
  document.addEventListener("mouseover", (e) => {
    if (!hoverEnabled) return;
    
    const target = e.target;

    // Do not highlight the overlay or badge itself
    if (target === overlay || overlay.contains(target) || target === document.body || target === document.documentElement) {
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

  // Keep overlay in sync with scrolling/resizing
  window.addEventListener("scroll", () => {
    if (hoverEnabled && currentTarget) updateOverlay(currentTarget);
  }, true);

  window.addEventListener("resize", () => {
    if (hoverEnabled && currentTarget) updateOverlay(currentTarget);
  });

  /**
   * Updates overlay position and badge details based on target element
   */
  function updateOverlay(target) {
    const rect = target.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    // Calculate dimensions
    const width = rect.width;
    const height = rect.height;
    const top = rect.top + scrollTop;
    const left = rect.left + scrollLeft;

    // Position overlay
    Object.assign(overlay.style, {
      display: "block",
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`
    });

    // Format target description for badge
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
    
    // Add dimensions
    label += ` [${Math.round(width)}x${Math.round(height)}]`;
    badge.textContent = label;

    // Handle boundary check: if element is at the very top of screen, push badge inside
    if (rect.top < 28) {
      badge.style.top = "2px";
      badge.style.left = "2px";
    } else {
      badge.style.top = "-24px";
      badge.style.left = "0";
    }
  }

  // Intercept element click to prepare for Phase 2 Depth Selection
  document.addEventListener("click", (e) => {
    if (!hoverEnabled) return;
    
    // Only capture if extension click mode is activated (scaffold mode logs and blocks)
    if (e.target === overlay || overlay.contains(e.target)) {
      return;
    }
    
    console.log("🎯 Selected element for scoping:", e.target);
  }, true);

  // Message listener from popup controls
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggleHover") {
      hoverEnabled = message.enabled;
      if (!hoverEnabled) {
        overlay.style.display = "none";
        currentTarget = null;
      }
      sendResponse({ status: "ok" });
    } else if (message.action === "resetHighlight") {
      overlay.style.display = "none";
      currentTarget = null;
      sendResponse({ status: "ok" });
    }
    return true; // Keep message channel open for async response
  });
})();
