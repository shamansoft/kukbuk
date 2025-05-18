// Import common utilities and constants
import { logError, showMessage } from "../common/error-handler.js";
import { STORAGE_KEYS, MESSAGE_TYPES, ERROR_CODES } from "../common/constants.js";

// DOM elements
const userEmail = document.getElementById("user-email");
const loggedInView = document.getElementById("logged-in-view");
const loggedOutView = document.getElementById("logged-out-view");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const folderName = document.getElementById("folder-name");
const changeFolderButton = document.getElementById("change-folder-button");
const versionElement = document.getElementById("version");
const statusMessage = document.getElementById("status-message");

// Initialize options page
document.addEventListener("DOMContentLoaded", initOptions);

// Main initialization function
async function initOptions() {
  try {
    // Set extension version
    const manifest = chrome.runtime.getManifest();
    versionElement.textContent = manifest.version;

    // Show loading state
    showMessage(statusMessage, "Loading...", "info");

    // Check authentication status
    const authStatus = await sendMessageToBackground(MESSAGE_TYPES.AUTH_CHECK);

    if (authStatus.success && authStatus.authenticated) {
      // Get drive folder info
      const folderData = await chrome.storage.local.get([
        STORAGE_KEYS.DRIVE_FOLDER,
        STORAGE_KEYS.DRIVE_FOLDER_NAME,
      ]);

      // User is authenticated
      showLoggedInView(authStatus.email);
      folderName.textContent = folderData[STORAGE_KEYS.DRIVE_FOLDER_NAME] || "Not set";
      changeFolderButton.disabled = !folderData[STORAGE_KEYS.DRIVE_FOLDER];
      statusMessage.textContent = "";
    } else {
      // User is not authenticated
      showLoggedOutView();
      folderName.textContent = "Login required";
      changeFolderButton.disabled = true;
      if (authStatus.error) {
        showMessage(statusMessage, authStatus.error, "info");
      } else {
        statusMessage.textContent = "";
      }
    }

    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    logError("Error initializing options page", error);
    showLoggedOutView();
    showMessage(statusMessage, "Error initializing settings", "error");
  }
}

// Setup UI event listeners
function setupEventListeners() {
  // Login button
  loginButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Authenticating...", "info");

      // Request authentication
      const authResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_REQUEST);

      if (authResponse.success) {
        // Reload page to update UI
        window.location.reload();
      } else {
        showMessage(statusMessage, authResponse.error || "Authentication failed", "error");
      }
    } catch (error) {
      logError("Login error", error);
      showMessage(statusMessage, "Authentication failed", "error");
    }
  });

  // Logout button
  logoutButton.addEventListener("click", async () => {
    try {
      showMessage(statusMessage, "Logging out...", "info");

      // Request logout
      const logoutResponse = await sendMessageToBackground(MESSAGE_TYPES.AUTH_LOGOUT);

      if (logoutResponse.success) {
        // Reload page to update UI
        window.location.reload();
      } else {
        showMessage(statusMessage, logoutResponse.error || "Logout failed", "error");
      }
    } catch (error) {
      logError("Logout error", error);
      showMessage(statusMessage, "Logout failed", "error");
    }
  });

  // Change folder button
  changeFolderButton.addEventListener("click", async () => {
    try {
      // Show folder selection UI
      await showFolderSelectionModal();
    } catch (error) {
      logError("Folder selection error", error);
      showMessage(statusMessage, "Error selecting folder", "error");
    }
  });
}

// UI state management
function showLoggedInView(email) {
  loggedInView.style.display = "block";
  loggedOutView.style.display = "none";
  userEmail.textContent = email || "Unknown user";
  changeFolderButton.disabled = false;
}

function showLoggedOutView() {
  loggedInView.style.display = "none";
  loggedOutView.style.display = "block";
  changeFolderButton.disabled = true;
}

/**
 * Shows the folder selection modal dialog
 */
async function showFolderSelectionModal() {
  try {
    // Create modal elements
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Select Google Drive Folder</h2>
          <span class="close">&times;</span>
        </div>
        <div class="modal-body">
          <div class="folder-list-container">
            <h3>Your Drive Folders</h3>
            <div id="folder-list" class="folder-list">
              <div class="loading">Loading folders...</div>
            </div>
          </div>
          <div class="folder-create-container">
            <h3>Create New Folder</h3>
            <div class="input-group">
              <input type="text" id="new-folder-name" placeholder="Folder Name" value="MyKukBuk Recipes">
              <button id="create-folder-button" class="btn primary">Create</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div id="modal-status" class="status"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Get modal elements
    const closeButton = modal.querySelector(".close");
    const folderList = modal.querySelector("#folder-list");
    const newFolderName = modal.querySelector("#new-folder-name");
    const createFolderButton = modal.querySelector("#create-folder-button");
    const modalStatus = modal.querySelector("#modal-status");

    // Close modal when clicking X
    closeButton.addEventListener("click", () => {
      document.body.removeChild(modal);
    });

    // Create folder button click handler
    createFolderButton.addEventListener("click", async () => {
      try {
        modalStatus.textContent = "Creating folder...";
        modalStatus.className = "status info";

        const name = newFolderName.value.trim();
        if (!name) {
          throw new Error("Folder name is required");
        }

        const response = await sendMessageToBackground(MESSAGE_TYPES.FOLDER_CREATE, { name });

        if (response.success) {
          modalStatus.textContent = `Folder "${response.folder.name}" created successfully`;
          modalStatus.className = "status success";

          // Update the main UI
          folderName.textContent = response.folder.name;

          // Close modal after a delay
          setTimeout(() => {
            document.body.removeChild(modal);
          }, 1500);
        } else {
          throw new Error(response.error || "Failed to create folder");
        }
      } catch (error) {
        logError("Create folder error", error);
        modalStatus.textContent = error.message;
        modalStatus.className = "status error";
      }
    });

    // Load folder list
    try {
      const foldersResponse = await sendMessageToBackground(MESSAGE_TYPES.FOLDER_LIST);

      if (foldersResponse.success) {
        // Clear loading message
        folderList.innerHTML = "";

        if (foldersResponse.folders.length === 0) {
          folderList.innerHTML =
            "<div class=\"no-folders\">No folders found. Create a new one.</div>";
        } else {
          // Create folder items
          foldersResponse.folders.forEach((folder) => {
            const folderItem = document.createElement("div");
            folderItem.className = "folder-item";
            folderItem.innerHTML = `
              <div class="folder-icon">📁</div>
              <div class="folder-name">${folder.name}</div>
            `;

            // Click handler for folder selection
            folderItem.addEventListener("click", async () => {
              try {
                modalStatus.textContent = "Selecting folder...";
                modalStatus.className = "status info";

                const response = await sendMessageToBackground(MESSAGE_TYPES.FOLDER_SELECT, {
                  folderId: folder.id,
                  folderName: folder.name,
                });

                if (response.success) {
                  modalStatus.textContent = `Folder "${response.folder.name}" selected`;
                  modalStatus.className = "status success";

                  // Update the main UI
                  folderName.textContent = response.folder.name;

                  // Close modal after a delay
                  setTimeout(() => {
                    document.body.removeChild(modal);
                  }, 1500);
                } else {
                  throw new Error(response.error || "Failed to select folder");
                }
              } catch (error) {
                logError("Folder selection error", error);
                modalStatus.textContent = error.message;
                modalStatus.className = "status error";
              }
            });

            folderList.appendChild(folderItem);
          });
        }
      } else {
        throw new Error(foldersResponse.error || "Failed to load folders");
      }
    } catch (error) {
      logError("List folders error", error);
      folderList.innerHTML = `<div class="error">Error loading folders: ${error.message}</div>`;
    }
  } catch (error) {
    logError("Modal creation error", error);
    showMessage(statusMessage, "Error showing folder selection", "error");
  }
}

// Communication with background script
function sendMessageToBackground(type, data) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
