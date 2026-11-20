// Import services
import { setupAuth, authManager } from "./services/auth/auth-manager.js";
import { setupTransformation } from "./services/transformation.js";
import { setupApi, saveRecipe } from "./services/api.js";
import { logError } from "../common/error-handler.js";
import { MESSAGE_TYPES, STORAGE_KEYS } from "../common/constants.js";

const extension = globalThis.browser ?? globalThis.chrome;

let isInitialized = false;

// Track in-flight saves per tab to prevent double-save
const inFlightSaves = new Map();
const SAVE_TIMEOUT_MS = 90000;

// Initialize background script
function initBackground() {
  if (isInitialized) {
    console.log("Background already initialized.");
    return;
  }
  isInitialized = true;
  try {
    console.log("Initializing Save-A-Recipe background script");

    // Register the handler synchronously when a background page wakes up.
    extension.contextMenus.onClicked.addListener(handleContextMenuClick);

    // Initialize services
    setupAuth();
    setupApi();
    setupTransformation();

    // Setup message listeners
    setupMessageListeners();

    // Set popup state based on current auth (fire-and-forget)
    applyPopupState();

    // Keep popup state in sync when auth token changes (e.g. sign-in from popup)
    extension.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && STORAGE_KEYS.FIREBASE_TOKEN in changes) {
        applyPopupState();
      }
    });

    // Windowless save: toolbar icon click when logged in
    extension.action.onClicked.addListener(handleActionClick);
  } catch (error) {
    logError("Error initializing background script", error);
  }
}

/**
 * Set extension.action popup to "" (windowless) when authenticated,
 * or "popup/popup.html" when logged out.
 */
async function applyPopupState() {
  try {
    const status = await authManager.checkAuthStatus();
    const popup = status.authenticated ? "" : "popup/popup.html";
    await extension.action.setPopup({ popup });
  } catch (_e) {
    await extension.action.setPopup({ popup: "popup/popup.html" });
  }
}

/**
 * Send a SHOW_BUBBLE message to a tab; swallow errors (tab may be gone).
 */
async function sendBubbleToTab(tabId, data) {
  try {
    await extension.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.SHOW_BUBBLE, data });
  } catch (e) {
    // Tab gone or content script unavailable — log so it's diagnosable
    console.warn("sendBubbleToTab failed (tab", tabId, "variant:", data?.variant, "):", e?.message);
  }
}

// Injected on demand. The toolbar click grants activeTab for this tab only; the extension has
// no static content scripts and no host access to ordinary websites.
const CONTENT_SCRIPT_FILES = ["content/recipe-extractor.js", "content/content.js"];

/**
 * Ensure the content scripts are loaded in the given tab.
 * Returns false for restricted pages (chrome://, PDFs, etc.).
 */
async function ensureContentScript(tabId) {
  try {
    const pong = await extension.tabs.sendMessage(tabId, { type: "PING" });
    if (pong && pong.success) return true;
  } catch (_e) {
    // Content script not loaded — try injecting
  }
  try {
    await extension.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPT_FILES });
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Handle toolbar icon click: windowless save flow.
 */
async function handleActionClick(tab) {
  const tabId = tab && tab.id;
  if (!tabId) return;

  // Double-click guard: ignore if a save is already in flight for this tab
  if (inFlightSaves.has(tabId)) return;
  inFlightSaves.set(tabId, true);

  let result;
  let timeoutId;
  try {
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ timedOut: true }), SAVE_TIMEOUT_MS);
    });

    const saveWork = async () => {
      const ready = await ensureContentScript(tabId);
      if (!ready) return { skipped: true };

      await sendBubbleToTab(tabId, {
        text: "Saving recipe…",
        variant: "loading",
        duration: 0,
        closePrevious: true,
      });

      let extractResult;
      try {
        extractResult = await extension.tabs.sendMessage(tabId, {
          type: MESSAGE_TYPES.EXTRACT_RECIPE,
        });
      } catch (_e) {
        return { error: "Couldn't read page" };
      }

      if (!extractResult || !extractResult.success) {
        return { error: extractResult?.error || "Couldn't read page" };
      }

      return await saveRecipe({
        pageContent: extractResult.data.pageContent,
        pageUrl: extractResult.data.pageUrl,
        title: extractResult.data.title,
      });
    };

    result = await Promise.race([saveWork(), timeoutPromise]);
  } catch (e) {
    result = { error: e.message || "Save failed" };
  } finally {
    clearTimeout(timeoutId);
    inFlightSaves.delete(tabId);
  }

  if (result?.skipped) return;

  if (result?.timedOut) {
    await sendBubbleToTab(tabId, {
      text: "Save timed out",
      variant: "error",
      duration: 0,
      dismissible: true,
      closePrevious: true,
    });
    return;
  }

  if (!result?.success) {
    await sendBubbleToTab(tabId, {
      text: result?.error || "Couldn't save",
      variant: "error",
      duration: 0,
      dismissible: true,
      closePrevious: true,
    });
    return;
  }

  if (result.isRecipe === false) {
    await sendBubbleToTab(tabId, {
      text: "Not a recipe page",
      variant: "error",
      duration: 0,
      dismissible: true,
      closePrevious: true,
    });
    return;
  }

  const bubbleData = {
    text: result.recipeName ? `Saved: ${result.recipeName}` : "Recipe saved",
    variant: "success",
    duration: 4000,
    closePrevious: true,
    dismissible: false,
  };
  if (result.driveUrl) {
    bubbleData.link = { url: result.driveUrl, label: "Open ↗" };
  }
  await sendBubbleToTab(tabId, bubbleData);
}

// Set up context menu for extension
async function setupContextMenu() {
  await extension.contextMenus.removeAll();
  extension.contextMenus.create({
    id: "save-a-recipe-settings",
    title: "Settings",
    contexts: ["action"],
  });

  extension.contextMenus.create({
    id: "save-a-recipe-logout",
    title: "Log Out",
    contexts: ["action"],
  });

  extension.contextMenus.create({
    id: "save-a-recipe-create-from-description",
    title: "Create Recipe from Description",
    contexts: ["action"],
  });
}

async function handleContextMenuClick(info) {
  if (info.menuItemId === "save-a-recipe-settings") {
    extension.runtime.openOptionsPage();
  } else if (info.menuItemId === "save-a-recipe-create-from-description") {
    extension.windows.create({
      url: extension.runtime.getURL("recipe-creator/recipe-creator.html"),
      type: "popup",
      width: 440,
      height: 340,
    });
  } else if (info.menuItemId === "save-a-recipe-logout") {
    try {
      await authManager.signOut();
      console.log("Logout successful");
      await applyPopupState();
    } catch (error) {
      logError("Context menu logout error", error);
    }
  }
}

// Set up message listeners
function setupMessageListeners() {
  extension.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background script received message:", message.type);

    // Handle only messages not handled by specific services
    switch (message.type) {
      default:
        // Do nothing - the message should be handled by a specific service
        break;
    }

    // Do not return true here - only return true from handlers that will call
    // sendResponse asynchronously
  });
}

// Initialize on install/update
extension.runtime.onInstalled.addListener(() => {
  return setupContextMenu().catch((error) => logError("Context menu setup failed", error));
});

// Restore the toolbar action when the browser starts a new session.
extension.runtime.onStartup.addListener(applyPopupState);

// Initialize on startup
initBackground();
