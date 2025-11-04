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
      const { text = "Saving...", variant = "info", duration = 5000 } = message.data || {};
      showLightBubble({ text, variant, duration });
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

/**
 * Show a lightweight bubble near the extensions area
 * @param {Object} opts
 * @param {string} opts.text - Bubble text
 * @param {"info"|"success"} [opts.variant="info"] - Bubble style
 * @param {number} [opts.duration=5000] - How long to show (ms)
 */
function showLightBubble({ text, variant = "info", duration = 5000 }) {
  try {
    ensureLightBubbleStyles();
    const container = ensureLightBubbleContainer();
    const bubble = document.createElement("div");
    bubble.className = `kukbuk-light-bubble ${variant}`;
    bubble.textContent = text || "";
    container.appendChild(bubble);

    // show with animation
    window.requestAnimationFrame(() => bubble.classList.add("show"));

    // auto hide
    const delay = Math.max(0, duration || 0);
    window.setTimeout(() => {
      bubble.classList.add("hide");
    }, delay);
    window.setTimeout(() => {
      bubble.remove();
      if (container.childElementCount === 0) {
        container.remove();
      }
    }, delay + 250);

    return bubble;
  } catch (_e) {
    // error suppressed
    return null;
  }
}

// Initialize content script
function init() {
  // log suppressed
}

// Run initialization
init();

// Send a ready message to let the extension know content script is available
chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });
