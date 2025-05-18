import { logError } from '../../common/error-handler.js';
import { MESSAGE_TYPES, STORAGE_KEYS, ERROR_CODES } from '../../common/constants.js';
import { getAuthToken } from './auth.js';

// Google Drive API endpoint
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';

// Folder MIME type
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

// Default folder name
const DEFAULT_FOLDER_NAME = 'MyKukBuk Recipes';

/**
 * Sets up the storage service
 */
export function setupStorage() {
  console.log("Setting up storage service");

  // Listen for folder management messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.FOLDER_SELECT) {
      selectDriveFolder(message.data)
        .then(response => sendResponse(response))
        .catch(error => {
          logError('Folder selection error', error);
          sendResponse({
            success: false,
            error: error.message,
            errorCode: error.code || ERROR_CODES.UNKNOWN_ERROR
          });
        });

      // Return true to indicate we'll respond asynchronously
      return true;
    }

    if (message.type === MESSAGE_TYPES.FOLDER_CREATE) {
      createDriveFolder(message.data)
        .then(response => sendResponse(response))
        .catch(error => {
          logError('Folder creation error', error);
          sendResponse({
            success: false,
            error: error.message,
            errorCode: error.code || ERROR_CODES.UNKNOWN_ERROR
          });
        });

      // Return true to indicate we'll respond asynchronously
      return true;
    }
    
    if (message.type === MESSAGE_TYPES.FOLDER_LIST) {
      listDriveFolders()
        .then(response => sendResponse(response))
        .catch(error => {
          logError('Folder listing error', error);
          sendResponse({
            success: false,
            error: error.message,
            errorCode: error.code || ERROR_CODES.UNKNOWN_ERROR
          });
        });

      // Return true to indicate we'll respond asynchronously
      return true;
    }
  });
}

/**
 * Lists folders in Google Drive
 * @returns {Promise<Array>} List of folders
 */
export async function listDriveFolders() {
  try {
    const token = await getAuthToken(false);
    
    // Query for folders owned by the user
    const query = "mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false";
    
    const response = await fetch(
      `${DRIVE_API_URL}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, 
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list Drive folders: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      folders: data.files || []
    };
  } catch (error) {
    logError('Error listing Drive folders', error);
    throw error;
  }
}

/**
 * Creates a new folder in Google Drive
 * @param {Object} options - Folder creation options
 * @param {string} [options.name] - Folder name (default: 'MyKukBuk Recipes')
 * @returns {Promise<Object>} Created folder info
 */
export async function createDriveFolder({ name = DEFAULT_FOLDER_NAME } = {}) {
  try {
    const token = await getAuthToken(false);
    
    // Create folder in Drive
    const response = await fetch(`${DRIVE_API_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME_TYPE,
        parents: ['root'] // Create in root folder
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create Drive folder: ${response.status} ${response.statusText}`);
    }

    const folder = await response.json();
    
    // Store folder ID and name
    await chrome.storage.local.set({
      [STORAGE_KEYS.DRIVE_FOLDER]: folder.id,
      [STORAGE_KEYS.DRIVE_FOLDER_NAME]: folder.name
    });

    return {
      success: true,
      folder: {
        id: folder.id,
        name: folder.name
      }
    };
  } catch (error) {
    logError('Error creating Drive folder', error);
    throw error;
  }
}

/**
 * Selects an existing folder for recipe storage
 * @param {Object} options - Folder selection options
 * @param {string} options.folderId - ID of folder to use
 * @param {string} options.folderName - Name of folder to use
 * @returns {Promise<Object>} Result object
 */
export async function selectDriveFolder({ folderId, folderName }) {
  try {
    if (!folderId) {
      throw new Error('Folder ID is required');
    }

    if (!folderName) {
      // If folder name not provided, fetch it
      const token = await getAuthToken(false);
      const response = await fetch(
        `${DRIVE_API_URL}/files/${folderId}?fields=name`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get folder name: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      folderName = data.name;
    }

    // Store folder ID and name
    await chrome.storage.local.set({
      [STORAGE_KEYS.DRIVE_FOLDER]: folderId,
      [STORAGE_KEYS.DRIVE_FOLDER_NAME]: folderName
    });

    return {
      success: true,
      folder: {
        id: folderId,
        name: folderName
      }
    };
  } catch (error) {
    logError('Error selecting Drive folder', error);
    throw error;
  }
}

/**
 * Gets the currently selected folder
 * @returns {Promise<Object|null>} Folder info or null if not set
 */
export async function getCurrentFolder() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.DRIVE_FOLDER,
      STORAGE_KEYS.DRIVE_FOLDER_NAME
    ]);

    const folderId = data[STORAGE_KEYS.DRIVE_FOLDER];
    const folderName = data[STORAGE_KEYS.DRIVE_FOLDER_NAME];

    if (!folderId) {
      return null;
    }

    return {
      id: folderId,
      name: folderName || 'Unknown'
    };
  } catch (error) {
    logError('Error getting current folder', error);
    return null;
  }
}
