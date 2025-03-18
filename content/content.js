// Content script for MyKukbuk

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message.type);

  switch (message.type) {
    case "EXTRACT_RECIPE":
      // This will be implemented in US-3: Save Current Recipe
      const pageContent = document.documentElement.outerHTML;
      const pageUrl = window.location.href;

      sendResponse({
        success: true,
        data: {
          pageContent,
          pageUrl,
          title: document.title,
        },
      });
      break;

    default:
      sendResponse({
        success: false,
        error: "Unknown message type",
      });
  }

  // Return true to indicate we will send a response asynchronously
  return true;
});

// Initialize content script
function init() {
  console.log("MyKukbuk content script initialized");

  // This is a placeholder for any initialization needed in the content script
}

// Run initialization
init();
