// Storage service unit tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupStorage, listDriveFolders, createDriveFolder, selectDriveFolder, getCurrentFolder } from '../background/services/storage.js';
import { STORAGE_KEYS, MESSAGE_TYPES, ERROR_CODES } from '../common/constants.js';
import { getAuthToken } from '../background/services/auth.js';
import { logError } from '../common/error-handler.js';

// Mock dependencies
vi.mock('../background/services/auth.js', () => ({
  getAuthToken: vi.fn(),
}));

vi.mock('../common/error-handler.js', () => ({
  logError: vi.fn(),
}));

// Mock chrome API
global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

// Mock fetch
global.fetch = vi.fn();

describe('Storage Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Setup default mock responses
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
    getAuthToken.mockResolvedValue('mock-token');
    
    // Setup mock fetch response
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ files: [] }),
    });
  });

  describe('listDriveFolders', () => {
    it('should fetch folders from Google Drive', async () => {
      // Mock a successful folder listing
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            { id: 'folder1', name: 'Test Folder 1' },
            { id: 'folder2', name: 'Test Folder 2' },
          ],
        }),
      });

      const result = await listDriveFolders();

      // Verify auth token was requested
      expect(getAuthToken).toHaveBeenCalledWith(false);

      // Verify fetch was called with correct parameters
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('files?q='),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token',
          },
        })
      );

      // Verify result format
      expect(result).toEqual({
        success: true,
        folders: [
          { id: 'folder1', name: 'Test Folder 1' },
          { id: 'folder2', name: 'Test Folder 2' },
        ],
      });
    });

    it('should handle fetch errors', async () => {
      // Mock a failed fetch
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      // Expect function to throw
      await expect(listDriveFolders()).rejects.toThrow('Failed to list Drive folders');
      
      // Verify error was logged
      expect(logError).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      // Mock a network error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Expect function to throw
      await expect(listDriveFolders()).rejects.toThrow('Network error');
      
      // Verify error was logged
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('createDriveFolder', () => {
    it('should create a new folder with the specified name', async () => {
      // Mock a successful folder creation
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'new-folder',
          name: 'Custom Folder Name',
        }),
      });

      const result = await createDriveFolder({ name: 'Custom Folder Name' });

      // Verify auth token was requested
      expect(getAuthToken).toHaveBeenCalledWith(false);

      // Verify fetch was called with correct parameters
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('files'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
          body: expect.stringContaining('Custom Folder Name'),
        })
      );

      // Verify folder ID and name were stored
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.DRIVE_FOLDER]: 'new-folder',
        [STORAGE_KEYS.DRIVE_FOLDER_NAME]: 'Custom Folder Name',
      });

      // Verify result format
      expect(result).toEqual({
        success: true,
        folder: {
          id: 'new-folder',
          name: 'Custom Folder Name',
        },
      });
    });

    it('should use the default folder name if none is provided', async () => {
      // Mock a successful folder creation
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'default-folder',
          name: 'MyKukBuk Recipes',
        }),
      });

      const result = await createDriveFolder();

      // Verify default folder name was used
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('MyKukBuk Recipes'),
        })
      );

      // Verify result has the default name
      expect(result.folder.name).toBe('MyKukBuk Recipes');
    });

    it('should handle creation errors', async () => {
      // Mock a failed creation
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      // Expect function to throw
      await expect(createDriveFolder()).rejects.toThrow('Failed to create Drive folder');
      
      // Verify storage was not updated
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('selectDriveFolder', () => {
    it('should store the selected folder information', async () => {
      const result = await selectDriveFolder({
        folderId: 'selected-folder',
        folderName: 'Selected Folder',
      });

      // Verify folder ID and name were stored
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.DRIVE_FOLDER]: 'selected-folder',
        [STORAGE_KEYS.DRIVE_FOLDER_NAME]: 'Selected Folder',
      });

      // Verify result format
      expect(result).toEqual({
        success: true,
        folder: {
          id: 'selected-folder',
          name: 'Selected Folder',
        },
      });
    });

    it('should fetch the folder name if not provided', async () => {
      // Mock a successful folder info fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Fetched Folder Name',
        }),
      });

      const result = await selectDriveFolder({
        folderId: 'folder-without-name',
      });

      // Verify fetch was called to get folder name
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('folder-without-name'),
        expect.any(Object)
      );

      // Verify the fetched name was used
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEYS.DRIVE_FOLDER_NAME]: 'Fetched Folder Name',
        })
      );

      // Verify result format
      expect(result.folder.name).toBe('Fetched Folder Name');
    });

    it('should throw an error if folder ID is not provided', async () => {
      await expect(selectDriveFolder({})).rejects.toThrow('Folder ID is required');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentFolder', () => {
    it('should return the currently selected folder', async () => {
      // Mock storage with folder data
      chrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEYS.DRIVE_FOLDER]: 'current-folder',
        [STORAGE_KEYS.DRIVE_FOLDER_NAME]: 'Current Folder',
      });

      const folder = await getCurrentFolder();

      // Verify correct storage keys were queried
      expect(chrome.storage.local.get).toHaveBeenCalledWith([
        STORAGE_KEYS.DRIVE_FOLDER,
        STORAGE_KEYS.DRIVE_FOLDER_NAME,
      ]);

      // Verify result format
      expect(folder).toEqual({
        id: 'current-folder',
        name: 'Current Folder',
      });
    });

    it('should return null if no folder is selected', async () => {
      // Mock empty storage
      chrome.storage.local.get.mockResolvedValueOnce({});

      const folder = await getCurrentFolder();

      // Verify result is null
      expect(folder).toBeNull();
    });

    it('should use "Unknown" as the folder name if missing', async () => {
      // Mock storage with folder ID but no name
      chrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEYS.DRIVE_FOLDER]: 'folder-without-name',
      });

      const folder = await getCurrentFolder();

      // Verify result has default name
      expect(folder).toEqual({
        id: 'folder-without-name',
        name: 'Unknown',
      });
    });

    it('should handle storage errors', async () => {
      // Mock storage error
      chrome.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));

      const folder = await getCurrentFolder();

      // Verify error was logged
      expect(logError).toHaveBeenCalled();
      
      // Verify result is null
      expect(folder).toBeNull();
    });
  });

  describe('setupStorage', () => {
    it('should set up message listeners for folder management', () => {
      setupStorage();

      // Verify message listener was added
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });
});