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
        duration = 5000,
        closePrevious = true,
      } = message.data || {};
      showLightBubble({ text, variant, duration, closePrevious });
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

// Light bubble UI - small status pills near the top-right (under extensions bar)
function ensureLightBubbleStyles() {
  if (document.getElementById("kukbuk-light-bubble-styles")) return;
  const style = document.createElement("style");
  style.id = "kukbuk-light-bubble-styles";
  style.textContent = `
    #kukbuk-light-bubble-container {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .kukbuk-light-bubble {
      pointer-events: auto;
      color: #fff;
      background: #2196f3;
      border-radius: 9999px;
      padding: 6px 12px;
      font-size: 13px;
      line-height: 1;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      white-space: nowrap;
      max-width: 60vw;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kukbuk-light-bubble.show {
      opacity: 1;
      transform: translateY(0);
    }
    .kukbuk-light-bubble.hide {
      opacity: 0;
      transform: translateY(-10px);
    }
    .kukbuk-light-bubble.info {
      background: #2196f3;
    }
    .kukbuk-light-bubble.success {
      background: #4caf50;
    }
    .kukbuk-light-bubble.error {
      background: #f44336;
    }
    .kukbuk-light-bubble.timeout {
      background: #ff9800;
    }
    .kukbuk-light-bubble.loading {
      background: #2196f3;
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

// Store reference to current bubble for cleanup
let currentBubble = null;
let currentBubbleTimeout = null;

/**
 * Show a lightweight bubble near the extensions area
 * @param {Object} opts
 * @param {string} opts.text - Bubble text
 * @param {"info"|"success"|"error"|"timeout"|"loading"} [opts.variant="info"] - Bubble style
 * @param {number} [opts.duration] - How long to show (ms). 0 or null means don't auto-close
 * @param {boolean} [opts.closePrevious=true] - Whether to close previous bubble
 */
function showLightBubble({ text, variant = "info", duration = 5000, closePrevious = true }) {
  try {
    // Close previous bubble if requested
    if (closePrevious && currentBubble) {
      closeBubble(currentBubble);
      if (currentBubbleTimeout) {
        clearTimeout(currentBubbleTimeout);
        currentBubbleTimeout = null;
      }
    }

    ensureLightBubbleStyles();
    const container = ensureLightBubbleContainer();
    const bubble = document.createElement("div");
    bubble.className = `kukbuk-light-bubble ${variant}`;
    bubble.textContent = text || "";
    container.appendChild(bubble);

    // Store reference to current bubble
    currentBubble = bubble;

    // show with animation
    window.requestAnimationFrame(() => bubble.classList.add("show"));

    // auto hide only if duration is specified and > 0
    if (duration && duration > 0) {
      const delay = Math.max(0, duration);
      currentBubbleTimeout = window.setTimeout(() => {
        closeBubble(bubble);
      }, delay);
    }

    return bubble;
  } catch (_e) {
    // error suppressed
    return null;
  }
}

/**
 * Close a specific bubble
 * @param {HTMLElement} bubble - The bubble element to close
 */
function closeBubble(bubble) {
  if (!bubble || !bubble.parentNode) return;

  bubble.classList.add("hide");
  window.setTimeout(() => {
    bubble.remove();
    if (currentBubble === bubble) {
      currentBubble = null;
    }
    const container = document.getElementById("kukbuk-light-bubble-container");
    if (container && container.childElementCount === 0) {
      container.remove();
    }
  }, 250);
}

// Initialize content script
function init() {
  // log suppressed
}

// Run initialization
init();

// Send a ready message to let the extension know content script is available
chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });
