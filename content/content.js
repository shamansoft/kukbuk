// Content script for MyKukbuk
import { MESSAGE_TYPES } from '../common/constants.js';

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
    pageContent: document.documentElement.outerHTML,
    pageUrl: window.location.href,
    title: document.title
  };

  // Try to find structured recipe data (Schema.org)
  const structuredData = findStructuredRecipeData();
  if (structuredData) {
    pageData.structuredData = structuredData;
  }

  return pageData;
}

/**
 * Attempts to find structured recipe data in the page (Schema.org)
 * @returns {Object|null} Structured recipe data or null if not found
 */
function findStructuredRecipeData() {
  try {
    // Look for JSON-LD script tags
    const scriptElements = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scriptElements) {
      try {
        const jsonData = JSON.parse(script.textContent);

        // Check if this is a Recipe object or part of a Graph
        if (jsonData['@type'] === 'Recipe') {
          return jsonData;
        }

        // Check for recipes in a graph
        if (jsonData['@graph'] && Array.isArray(jsonData['@graph'])) {
          const recipe = jsonData['@graph'].find(item => item['@type'] === 'Recipe');
          if (recipe) {
            return recipe;
          }
        }
      } catch (parseError) {
        console.warn('Error parsing JSON-LD script:', parseError);
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding structured recipe data:', error);
    return null;
  }
}

// Initialize content script
function init() {
  console.log('MyKukbuk content script initialized');
}

// Run initialization
init();
