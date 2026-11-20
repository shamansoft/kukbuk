// Content script for Save-A-Recipe.
// Injected on demand into the active tab (activeTab + scripting) when the user clicks the
// toolbar button; there are no static content scripts.

// Message type constants (duplicated from constants.js since content scripts can't import modules)
const MESSAGE_TYPES = {
  EXTRACT_RECIPE: "EXTRACT_RECIPE",
  PING: "PING",
  SHOW_BUBBLE: "SHOW_BUBBLE",
};

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // log suppressed

  switch (message.type) {
    case MESSAGE_TYPES.PING:
      // Respond to ping to indicate content script is loaded
      sendResponse({ success: true });
      return false; // No async response needed

    case MESSAGE_TYPES.EXTRACT_RECIPE:
      extractRecipeData()
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => {
          // error suppressed
          sendResponse({
            success: false,
            error: error.message || "Failed to extract recipe data",
          });
        });

      // Return true to indicate we will send a response asynchronously
      return true;

    case MESSAGE_TYPES.SHOW_BUBBLE: {
      const {
        text = "Saving...",
        variant = "info",
        duration = 0,
        link,
        dismissible,
        closePrevious = true,
      } = message.data || {};
      showLightBubble({ text, variant, duration, link, dismissible, closePrevious });
      sendResponse({ success: true });
      return false;
    }

    default:
      sendResponse({
        success: false,
        error: "Unknown message type",
      });
  }

  // Return true for all message types to allow asynchronous responses
  return true;
});

/** Prepares the selected page for backend recipe detection and extraction. */
async function extractRecipeData() {
  return globalThis.SarPageContent.preparePage(document, window.location);
}

// Light bubble UI - small status card near the top-right (under extensions bar)
function ensureLightBubbleStyles() {
  if (document.getElementById("save-a-recipe-light-bubble-styles")) return;
  const style = document.createElement("style");
  style.id = "save-a-recipe-light-bubble-styles";
  style.textContent = `
    #save-a-recipe-light-bubble-container {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 2147483647;
      pointer-events: none;
    }
    .save-a-recipe-light-bubble {
      pointer-events: auto;
      background: #fafaf9;
      border: 1px solid #d4d0ca;
      border-radius: 8px;
      padding: 10px 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: #1c1917;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 180px;
      max-width: 320px;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.12s ease, transform 0.12s ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .save-a-recipe-light-bubble {
        transition: none;
      }
    }
    .save-a-recipe-light-bubble.show {
      opacity: 1;
      transform: translateY(0);
    }
    .save-a-recipe-light-bubble.hide {
      opacity: 0;
      transform: translateY(-4px);
    }
    .save-a-recipe-bubble-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .save-a-recipe-bubble-dot.loading {
      background: #3b82f6;
      animation: save-a-recipe-pulse 1s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .save-a-recipe-bubble-dot.loading {
        animation: none;
      }
    }
    @keyframes save-a-recipe-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .save-a-recipe-bubble-dot.success {
      background: #16a34a;
    }
    .save-a-recipe-bubble-dot.error {
      background: #dc2626;
    }
    .save-a-recipe-bubble-dot.info {
      background: #3b82f6;
    }
    .save-a-recipe-bubble-body {
      flex: 1;
      min-width: 0;
    }
    .save-a-recipe-bubble-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .save-a-recipe-bubble-link {
      display: block;
      color: #2563eb;
      text-decoration: none;
      font-size: 12px;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .save-a-recipe-bubble-link:hover {
      text-decoration: underline;
    }
    .save-a-recipe-bubble-dismiss {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      color: #78716c;
      font-size: 14px;
      flex-shrink: 0;
      opacity: 0.7;
    }
    .save-a-recipe-bubble-dismiss:hover {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

function ensureLightBubbleContainer() {
  let container = document.getElementById("save-a-recipe-light-bubble-container");
  if (container) return container;
  container = document.createElement("div");
  container.id = "save-a-recipe-light-bubble-container";
  document.body.appendChild(container);
  return container;
}

// Single bubble instance — state is swapped in-place
let currentBubble = null;
let currentBubbleTimeout = null;

/**
 * Show (or update) the single in-page status bubble.
 * @param {Object} opts
 * @param {string} opts.text - Bubble text
 * @param {"loading"|"success"|"error"|"info"} [opts.variant="info"] - Visual state
 * @param {number} [opts.duration] - Auto-dismiss ms. 0/omitted = persist.
 * @param {{url: string, label: string}} [opts.link] - Optional inline link
 * @param {boolean} [opts.dismissible] - Show close button (always true for error)
 * @param {boolean} [opts.closePrevious=true] - Replace existing bubble
 */
function showLightBubble({
  text,
  variant = "info",
  duration = 0,
  link,
  dismissible,
  closePrevious = true,
}) {
  try {
    // Clear any pending auto-dismiss
    if (currentBubbleTimeout) {
      clearTimeout(currentBubbleTimeout);
      currentBubbleTimeout = null;
    }

    ensureLightBubbleStyles();
    const container = ensureLightBubbleContainer();

    const showDismiss = dismissible || variant === "error";

    if (currentBubble && closePrevious) {
      // Update existing bubble in place (state swap cross-fade)
      _updateBubbleContent(currentBubble, { text, variant, link, showDismiss });
    } else {
      // Create a new bubble element
      if (currentBubble) {
        _removeBubble(currentBubble);
      }
      const bubble = _createBubble({ text, variant, link, showDismiss });
      container.appendChild(bubble);
      currentBubble = bubble;
      window.requestAnimationFrame(() => bubble.classList.add("show"));
    }

    // Auto-dismiss when duration is set; for loading variant with no duration, add a
    // safety-net dismiss so a failed success/error message never leaves the bubble stuck.
    if (duration && duration > 0) {
      currentBubbleTimeout = window.setTimeout(() => {
        dismissBubble();
      }, duration);
    } else if (variant === "loading") {
      currentBubbleTimeout = window.setTimeout(() => {
        dismissBubble();
      }, 90000);
    }

    return currentBubble;
  } catch (_e) {
    return null;
  }
}

function _createBubble({ text, variant, link, showDismiss }) {
  const bubble = document.createElement("div");
  bubble.className = "save-a-recipe-light-bubble";

  const dot = document.createElement("span");
  dot.className = `save-a-recipe-bubble-dot ${variant}`;
  bubble.appendChild(dot);

  const body = document.createElement("span");
  body.className = "save-a-recipe-bubble-body";

  const textEl = document.createElement("span");
  textEl.className = "save-a-recipe-bubble-text";
  textEl.textContent = text || "";
  body.appendChild(textEl);

  if (link && link.url && link.label) {
    const linkEl = document.createElement("a");
    linkEl.className = "save-a-recipe-bubble-link";
    linkEl.href = link.url;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.textContent = link.label;
    body.appendChild(linkEl);
  }

  bubble.appendChild(body);

  if (showDismiss) {
    const btn = document.createElement("button");
    btn.className = "save-a-recipe-bubble-dismiss";
    btn.setAttribute("aria-label", "Dismiss");
    btn.textContent = "×";
    btn.addEventListener("click", () => dismissBubble());
    bubble.appendChild(btn);
  }

  return bubble;
}

function _updateBubbleContent(bubble, { text, variant, link, showDismiss }) {
  // Swap dot class
  const dot = bubble.querySelector(".save-a-recipe-bubble-dot");
  if (dot) dot.className = `save-a-recipe-bubble-dot ${variant}`;

  // Swap text
  const textEl = bubble.querySelector(".save-a-recipe-bubble-text");
  if (textEl) textEl.textContent = text || "";

  // Swap link
  const existingLink = bubble.querySelector(".save-a-recipe-bubble-link");
  if (existingLink) existingLink.remove();
  if (link && link.url && link.label) {
    const body = bubble.querySelector(".save-a-recipe-bubble-body");
    if (body) {
      const linkEl = document.createElement("a");
      linkEl.className = "save-a-recipe-bubble-link";
      linkEl.href = link.url;
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      linkEl.textContent = link.label;
      body.appendChild(linkEl);
    }
  }

  // Swap dismiss button
  const existingDismiss = bubble.querySelector(".save-a-recipe-bubble-dismiss");
  if (showDismiss && !existingDismiss) {
    const btn = document.createElement("button");
    btn.className = "save-a-recipe-bubble-dismiss";
    btn.setAttribute("aria-label", "Dismiss");
    btn.textContent = "×";
    btn.addEventListener("click", () => dismissBubble());
    bubble.appendChild(btn);
  } else if (!showDismiss && existingDismiss) {
    existingDismiss.remove();
  }
}

function _removeBubble(bubble) {
  if (!bubble || !bubble.parentNode) return;
  bubble.classList.add("hide");
  window.setTimeout(() => {
    bubble.remove();
    if (currentBubble === bubble) currentBubble = null;
    const container = document.getElementById("save-a-recipe-light-bubble-container");
    if (container && container.childElementCount === 0) container.remove();
  }, 150);
}

function dismissBubble() {
  if (!currentBubble) return;
  if (currentBubbleTimeout) {
    clearTimeout(currentBubbleTimeout);
    currentBubbleTimeout = null;
  }
  _removeBubble(currentBubble);
  currentBubble = null;
}
