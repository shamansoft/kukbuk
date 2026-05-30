// Content script for MyKukbuk

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

/**
 * Extracts recipe data from the current page
 * @returns {Promise<Object>} Recipe data
 */
async function extractRecipeData() {
  // Basic data about the page
  const pageContent = performBasicCleanup();
  const pageData = {
    pageContent,
    pageUrl: window.location.href,
    title: document.title,
  };

  return pageData;
}

/**
 * Performs basic cleanup of the page content to remove definitely non-content elements
 * Only removes scripts, styles, and other clearly non-content tags
 * @returns {string} Cleaned HTML content
 */
function performBasicCleanup() {
  try {
    const initialDocSize = document.documentElement.outerHTML.length;
    // log suppressed

    // Create a clone of the document to avoid modifying the actual page
    const docClone = document.cloneNode(true);

    // ONLY remove these definitely non-content elements
    const elementsToRemove = [
      "script", // JavaScript
      "style", // CSS
      "noscript", // No-JS fallback
      "iframe", // Embedded frames
      "svg", // Vector graphics
      "canvas", // Drawing canvas
      "template", // Template elements
    ];

    // Remove elements
    elementsToRemove.forEach((tag) => {
      const elements = docClone.querySelectorAll(tag);
      elements.forEach((el) => {
        try {
          el.parentNode?.removeChild(el);
        } catch (e) {
          // Ignore errors
        }
      });
    });
    // log suppressed
    // log suppressed
    return docClone.documentElement.outerHTML;
  } catch (error) {
    // error suppressed
    // On any error, return the original HTML
    return document.documentElement.outerHTML;
  }
}

// Light bubble UI - small status card near the top-right (under extensions bar)
function ensureLightBubbleStyles() {
  if (document.getElementById("kukbuk-light-bubble-styles")) return;
  const style = document.createElement("style");
  style.id = "kukbuk-light-bubble-styles";
  style.textContent = `
    #kukbuk-light-bubble-container {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 2147483647;
      pointer-events: none;
    }
    .kukbuk-light-bubble {
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
      .kukbuk-light-bubble {
        transition: none;
      }
    }
    .kukbuk-light-bubble.show {
      opacity: 1;
      transform: translateY(0);
    }
    .kukbuk-light-bubble.hide {
      opacity: 0;
      transform: translateY(-4px);
    }
    .kukbuk-bubble-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .kukbuk-bubble-dot.loading {
      background: #3b82f6;
      animation: kukbuk-pulse 1s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .kukbuk-bubble-dot.loading {
        animation: none;
      }
    }
    @keyframes kukbuk-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .kukbuk-bubble-dot.success {
      background: #16a34a;
    }
    .kukbuk-bubble-dot.error {
      background: #dc2626;
    }
    .kukbuk-bubble-dot.info {
      background: #3b82f6;
    }
    .kukbuk-bubble-body {
      flex: 1;
      min-width: 0;
    }
    .kukbuk-bubble-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .kukbuk-bubble-link {
      display: block;
      color: #2563eb;
      text-decoration: none;
      font-size: 12px;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kukbuk-bubble-link:hover {
      text-decoration: underline;
    }
    .kukbuk-bubble-dismiss {
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
    .kukbuk-bubble-dismiss:hover {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

function ensureLightBubbleContainer() {
  let container = document.getElementById("kukbuk-light-bubble-container");
  if (container) return container;
  container = document.createElement("div");
  container.id = "kukbuk-light-bubble-container";
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

    // Auto-dismiss for success (duration > 0)
    if (duration && duration > 0) {
      currentBubbleTimeout = window.setTimeout(() => {
        dismissBubble();
      }, duration);
    }

    return currentBubble;
  } catch (_e) {
    return null;
  }
}

function _createBubble({ text, variant, link, showDismiss }) {
  const bubble = document.createElement("div");
  bubble.className = "kukbuk-light-bubble";

  const dot = document.createElement("span");
  dot.className = `kukbuk-bubble-dot ${variant}`;
  bubble.appendChild(dot);

  const body = document.createElement("span");
  body.className = "kukbuk-bubble-body";

  const textEl = document.createElement("span");
  textEl.className = "kukbuk-bubble-text";
  textEl.textContent = text || "";
  body.appendChild(textEl);

  if (link && link.url && link.label) {
    const linkEl = document.createElement("a");
    linkEl.className = "kukbuk-bubble-link";
    linkEl.href = link.url;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.textContent = link.label;
    body.appendChild(linkEl);
  }

  bubble.appendChild(body);

  if (showDismiss) {
    const btn = document.createElement("button");
    btn.className = "kukbuk-bubble-dismiss";
    btn.setAttribute("aria-label", "Dismiss");
    btn.textContent = "×";
    btn.addEventListener("click", () => dismissBubble());
    bubble.appendChild(btn);
  }

  return bubble;
}

function _updateBubbleContent(bubble, { text, variant, link, showDismiss }) {
  // Swap dot class
  const dot = bubble.querySelector(".kukbuk-bubble-dot");
  if (dot) dot.className = `kukbuk-bubble-dot ${variant}`;

  // Swap text
  const textEl = bubble.querySelector(".kukbuk-bubble-text");
  if (textEl) textEl.textContent = text || "";

  // Swap link
  const existingLink = bubble.querySelector(".kukbuk-bubble-link");
  if (existingLink) existingLink.remove();
  if (link && link.url && link.label) {
    const body = bubble.querySelector(".kukbuk-bubble-body");
    if (body) {
      const linkEl = document.createElement("a");
      linkEl.className = "kukbuk-bubble-link";
      linkEl.href = link.url;
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      linkEl.textContent = link.label;
      body.appendChild(linkEl);
    }
  }

  // Swap dismiss button
  const existingDismiss = bubble.querySelector(".kukbuk-bubble-dismiss");
  if (showDismiss && !existingDismiss) {
    const btn = document.createElement("button");
    btn.className = "kukbuk-bubble-dismiss";
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
    const container = document.getElementById("kukbuk-light-bubble-container");
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

// Initialize content script
function init() {
  // log suppressed
}

// Run initialization
init();

// Send a ready message to let the extension know content script is available
chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });
