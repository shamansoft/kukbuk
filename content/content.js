// Content script for MyKukbuk

// Message type constants (duplicated from constants.js since content scripts can't import modules)
const MESSAGE_TYPES = {
  EXTRACT_RECIPE: 'EXTRACT_RECIPE'
};

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message.type);

  switch (message.type) {
    case MESSAGE_TYPES.EXTRACT_RECIPE:
      extractRecipeData()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => {
          console.error('Error extracting recipe:', error);
          sendResponse({
            success: false,
            error: error.message || 'Failed to extract recipe data'
          });
        });

      // Return true to indicate we will send a response asynchronously
      return true;

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
  const pageData = {
    pageUrl: window.location.href,
    title: document.title
  };

  // Get cleaned up content (basic cleanup only)
  pageData.pageContent = performBasicCleanup();

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
    console.log("doc size", initialDocSize);

    // Create a clone of the document to avoid modifying the actual page
    const docClone = document.cloneNode(true);

    // ONLY remove these definitely non-content elements
    const elementsToRemove = [
      'script',         // JavaScript
      'style',          // CSS
      'noscript',       // No-JS fallback
      'iframe',         // Embedded frames
      'svg',            // Vector graphics
      'canvas',         // Drawing canvas
      'template'        // Template elements
    ];

    // Remove elements
    elementsToRemove.forEach(tag => {
      const elements = docClone.querySelectorAll(tag);
      elements.forEach(el => {
        try {
          el.parentNode?.removeChild(el);
        } catch (e) {
          // Ignore errors
        }
      });
    });
    console.log("doc size after cleanup", docClone.documentElement.outerHTML.length);
    console.log("doc size diff", initialDocSize - docClone.documentElement.outerHTML.length);
    return docClone.documentElement.outerHTML;
  } catch (error) {
    console.error('Error performing basic cleanup:', error);
    // On any error, return the original HTML
    return document.documentElement.outerHTML;
  }
}

// Initialize content script
function init() {
  console.log('MyKukbuk content script initialized');
}

// Run initialization
init();

// Send a ready message to let the extension know content script is available
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });