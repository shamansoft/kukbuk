/**
 * @jest-environment jsdom
 */

import { setupMockStorage } from "../../test/testHelpers";

jest.mock("../../common/error-handler.js", () => ({
  logError: jest.fn(),
}));

jest.mock("../../common/constants.js", () => ({
  MESSAGE_TYPES: {
    GET_NOTIFICATION_PREFERENCES: "GET_NOTIFICATION_PREFERENCES",
    UPDATE_NOTIFICATION_PREFERENCES: "UPDATE_NOTIFICATION_PREFERENCES",
  },
}));

describe("Notifications Service (preferences only — OS notifications removed)", () => {
  let mockChrome;
  let mockStorage;
  let getNotificationPreferences;
  let updateNotificationPreferences;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockStorage = setupMockStorage();
    mockChrome = {
      storage: { local: mockStorage },
      runtime: { onMessage: { addListener: jest.fn() } },
    };
    global.chrome = mockChrome;

    const module = require("./notifications.js");
    getNotificationPreferences = module.getNotificationPreferences;
    updateNotificationPreferences = module.updateNotificationPreferences;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
  });

  it("does not export createNotification (OS notifications removed)", () => {
    const module = require("./notifications.js");
    expect(module.createNotification).toBeUndefined();
  });

  it("does not export setupNotifications (OS notifications removed)", () => {
    const module = require("./notifications.js");
    expect(module.setupNotifications).toBeUndefined();
  });

  it("does not export notify object (OS notifications removed)", () => {
    const module = require("./notifications.js");
    expect(module.notify).toBeUndefined();
  });

  describe("getNotificationPreferences", () => {
    it("returns stored preferences", async () => {
      await mockStorage.set({
        notificationPreferences: {
          enabled: true,
          saveRecipe: false,
          authentication: true,
          folderOperations: true,
        },
      });

      const prefs = await getNotificationPreferences();

      expect(prefs.enabled).toBe(true);
      expect(prefs.saveRecipe).toBe(false);
    });

    it("returns default preferences when none stored", async () => {
      const prefs = await getNotificationPreferences();

      expect(prefs).toEqual({
        enabled: true,
        saveRecipe: true,
        authentication: true,
        folderOperations: true,
      });
    });

    it("handles storage errors and returns defaults", async () => {
      const { logError } = require("../../common/error-handler.js");
      mockStorage.get.mockImplementationOnce(() => {
        throw new Error("Storage error");
      });

      const prefs = await getNotificationPreferences();

      expect(prefs).toEqual({
        enabled: true,
        saveRecipe: true,
        authentication: true,
        folderOperations: true,
      });
      expect(logError).toHaveBeenCalled();
    });
  });

  describe("updateNotificationPreferences", () => {
    it("updates preferences", async () => {
      const result = await updateNotificationPreferences({ enabled: false, saveRecipe: false });

      expect(result).toBe(true);
      expect(mockStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationPreferences: expect.objectContaining({ enabled: false, saveRecipe: false }),
        }),
      );
    });

    it("merges with existing preferences", async () => {
      await mockStorage.set({
        notificationPreferences: {
          enabled: true,
          saveRecipe: true,
          authentication: true,
          folderOperations: true,
        },
      });

      await updateNotificationPreferences({ saveRecipe: false });

      expect(mockStorage.set).toHaveBeenCalledWith({
        notificationPreferences: {
          enabled: true,
          saveRecipe: false,
          authentication: true,
          folderOperations: true,
        },
      });
    });

    it("handles storage errors", async () => {
      const { logError } = require("../../common/error-handler.js");
      mockStorage.set.mockImplementationOnce(() => {
        throw new Error("Storage error");
      });

      const result = await updateNotificationPreferences({ enabled: false });

      expect(result).toBe(false);
      expect(logError).toHaveBeenCalled();
    });
  });
});
