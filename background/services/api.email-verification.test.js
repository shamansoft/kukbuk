/**
 * @jest-environment jsdom
 *
 * Retry-once handling of `403 {"error": "email_not_verified"}` in api.js.
 * Uses the real error-utils.js so the tests check the message the user actually sees.
 */

jest.mock("../../common/error-handler.js", () => ({
  logError: jest.fn(),
}));

jest.mock("./transformation.js", () => ({
  transformContent: jest.fn().mockResolvedValue({ transformed: "compressed" }),
}));

jest.mock("./auth/auth-manager.js", () => ({
  authManager: {
    getIdToken: jest.fn(),
  },
}));

jest.mock("../../common/env-config.js", () => ({
  ENV: {
    API_BASE_URL: "https://api.example.com",
    EXTENSION_ID: "mock-extension-id",
  },
}));

import { setupApi } from "./api";
import { authManager } from "./auth/auth-manager.js";
import { transformContent } from "./transformation.js";

const VERIFY_MESSAGE = "Please verify your email in the Save-A-Recipe app, then try again.";
const PERMISSION_MESSAGE = "You don't have permission to perform this action.";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

const notVerified = () => jsonResponse(403, { error: "email_not_verified" });
const saved = () =>
  jsonResponse(200, { title: "Pasta", driveFileUrl: "https://drive.google.com/file/1" });

const endpoints = [
  {
    name: "save from page",
    url: "https://api.example.com/v1/recipes?compression=gzip",
    message: {
      type: "SAVE_RECIPE",
      pageContent: "<div>recipe</div>",
      pageUrl: "https://example.com/recipe",
      title: "Pasta",
    },
  },
  {
    name: "create from description",
    url: "https://api.example.com/v1/recipes/custom?compression=gzip",
    message: { type: "CREATE_RECIPE_FROM_DESCRIPTION", description: "Pasta\nServes 2" },
  },
];

describe.each(endpoints)("email_not_verified handling: $name", ({ url, message }) => {
  let listener;

  /** Sends a message through the background listener and resolves with its response. */
  const dispatch = () =>
    new Promise((resolve) => {
      listener(message, {}, resolve);
    });

  const authHeaders = () => global.fetch.mock.calls.map(([, req]) => req.headers.Authorization);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});

    authManager.getIdToken.mockImplementation(async (forceRefresh) =>
      forceRefresh ? "fresh-token" : "cached-token",
    );
    global.fetch = jest.fn();
    global.chrome = { runtime: { onMessage: { addListener: jest.fn() } } };

    setupApi();
    listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
    delete global.chrome;
  });

  it("retries once with a force-refreshed token and returns the saved recipe", async () => {
    global.fetch.mockResolvedValueOnce(notVerified()).mockResolvedValueOnce(saved());

    const response = await dispatch();

    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        recipeName: "Pasta",
        driveUrl: "https://drive.google.com/file/1",
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls.every(([calledUrl]) => calledUrl === url)).toBe(true);
    expect(authManager.getIdToken.mock.calls).toEqual([[], [true]]);
    expect(authHeaders()).toEqual(["Bearer cached-token", "Bearer fresh-token"]);
    // Same payload on both attempts
    expect(global.fetch.mock.calls[1][1].body).toBe(global.fetch.mock.calls[0][1].body);
  });

  it("retries only once and shows the verify message when the second attempt is also 403", async () => {
    global.fetch.mockResolvedValueOnce(notVerified()).mockResolvedValueOnce(notVerified());

    const response = await dispatch();

    expect(response).toEqual({
      success: false,
      error: VERIFY_MESSAGE,
      errorCode: "email_not_verified",
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(authManager.getIdToken.mock.calls).toEqual([[], [true]]);
  });

  it("keeps the verify message when the retry fails with a network error", async () => {
    global.fetch
      .mockResolvedValueOnce(notVerified())
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const response = await dispatch();

    expect(response).toEqual({
      success: false,
      error: VERIFY_MESSAGE,
      errorCode: "email_not_verified",
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the verify message when the forced refresh fails for a non-session reason", async () => {
    global.fetch.mockResolvedValueOnce(notVerified());
    jest.spyOn(console, "warn").mockImplementation(() => {});
    authManager.getIdToken.mockImplementation(async (forceRefresh) => {
      if (forceRefresh) throw new Error("Offscreen document unavailable");
      return "cached-token";
    });

    const response = await dispatch();

    expect(response).toEqual(expect.objectContaining({ success: false, error: VERIFY_MESSAGE }));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("fails before compressing the content when the user is signed out", async () => {
    authManager.getIdToken.mockRejectedValue(new Error("Not authenticated"));

    const response = await dispatch();

    expect(response).toEqual(
      expect.objectContaining({ success: false, errorCode: "auth_required" }),
    );
    expect(transformContent).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("serializes the request body once for both attempts", async () => {
    global.fetch.mockResolvedValueOnce(notVerified()).mockResolvedValueOnce(saved());
    const stringify = jest.spyOn(JSON, "stringify");

    await dispatch();

    expect(stringify).toHaveBeenCalledTimes(1);
    expect(transformContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry other 403 errors", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(403, { error: "forbidden" }));

    const response = await dispatch();

    expect(response).toEqual(
      expect.objectContaining({ success: false, error: PERMISSION_MESSAGE }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(authManager.getIdToken).not.toHaveBeenCalledWith(true);
  });

  it("does not retry a 403 without a JSON body", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
      text: jest.fn().mockResolvedValue("<html>Forbidden</html>"),
    });

    const response = await dispatch();

    expect(response).toEqual(
      expect.objectContaining({ success: false, error: PERMISSION_MESSAGE }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry email_not_verified on a non-403 status", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(400, { error: "email_not_verified" }));

    await dispatch();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(authManager.getIdToken).not.toHaveBeenCalledWith(true);
  });

  it("asks the user to sign in when the forced refresh fails", async () => {
    global.fetch.mockResolvedValueOnce(notVerified());
    authManager.getIdToken.mockImplementation(async (forceRefresh) => {
      if (forceRefresh) throw new Error("Authentication expired - please sign in again");
      return "cached-token";
    });

    const response = await dispatch();

    expect(response).toEqual({
      success: false,
      error: "Authentication required, please sign in",
      errorCode: "auth_required",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
