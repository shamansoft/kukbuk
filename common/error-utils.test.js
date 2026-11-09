import {
  ERROR_CATEGORIES,
  EMAIL_NOT_VERIFIED,
  extractErrorMessage,
  categorizeHttpError,
  getUserFriendlyMessage,
  mapCategoryToErrorCode,
  formatErrorForLogging,
} from "./error-utils.js";
import { ERROR_CODES } from "./constants.js";

describe("getUserFriendlyMessage", () => {
  it("asks the user to verify their email for 403 email_not_verified", () => {
    expect(getUserFriendlyMessage(403, "email_not_verified", { error: EMAIL_NOT_VERIFIED })).toBe(
      "Please verify your email in the SAR app, then try again.",
    );
  });

  it.each([
    ["another error code", { error: "forbidden" }],
    ["a message only", { message: "email_not_verified" }],
    ["no body", null],
    ["a raw body", { _rawBody: "<html>Forbidden</html>" }],
  ])("keeps the permission message for other 403s (%s)", (_label, errorData) => {
    expect(getUserFriendlyMessage(403, "Forbidden", errorData)).toBe(
      "You don't have permission to perform this action.",
    );
  });

  it("does not use the verify message for non-403 statuses", () => {
    const data = { error: EMAIL_NOT_VERIFIED };
    expect(getUserFriendlyMessage(401, "x", data)).toBe(
      "Your session has expired. Please sign in again.",
    );
    expect(getUserFriendlyMessage(500, "x", data)).toBe(
      "The server encountered an error. Please try again later.",
    );
  });

  it.each([
    [404, "The requested resource was not found."],
    [429, "You've reached your daily recipe limit. Try again tomorrow."],
    [409, "There was a problem with your request. Please try again."],
    [503, "The server encountered an error. Please try again later."],
    [undefined, "Unable to connect. Please check your internet connection."],
    [302, "An unexpected error occurred. Please try again."],
  ])("maps status %s to its message", (status, expected) => {
    expect(getUserFriendlyMessage(status, "raw", {})).toBe(expected);
  });

  it("passes short validation messages through for 400 and 422", () => {
    expect(getUserFriendlyMessage(400, "Title is required", {})).toBe("Title is required");
    expect(getUserFriendlyMessage(422, "Bad URL", {})).toBe("Bad URL");
  });

  it("hides long or technical validation messages", () => {
    const generic = "The request was invalid. Please check your input and try again.";
    expect(getUserFriendlyMessage(400, "x".repeat(100), {})).toBe(generic);
    expect(getUserFriendlyMessage(400, "Error at stack frame 3", {})).toBe(generic);
    expect(getUserFriendlyMessage(400, "", {})).toBe(generic);
  });
});

describe("categorizeHttpError", () => {
  it.each([
    [undefined, ERROR_CATEGORIES.NETWORK_ERROR],
    [0, ERROR_CATEGORIES.NETWORK_ERROR],
    [401, ERROR_CATEGORIES.AUTH_ERROR],
    [403, ERROR_CATEGORIES.AUTH_ERROR],
    [404, ERROR_CATEGORIES.NOT_FOUND],
    [429, ERROR_CATEGORIES.RATE_LIMITED],
    [400, ERROR_CATEGORIES.CLIENT_ERROR],
    [499, ERROR_CATEGORIES.CLIENT_ERROR],
    [500, ERROR_CATEGORIES.SERVER_ERROR],
    [599, ERROR_CATEGORIES.SERVER_ERROR],
    [302, ERROR_CATEGORIES.UNKNOWN_ERROR],
  ])("categorizes %s as %s", (status, category) => {
    expect(categorizeHttpError(status)).toBe(category);
  });
});

describe("extractErrorMessage", () => {
  const response = { status: 500, statusText: "Internal Server Error" };

  it("prefers error, then message, details, description, msg", () => {
    expect(extractErrorMessage(response, { error: " e ", message: "m" })).toBe("e");
    expect(extractErrorMessage(response, { message: "m", details: "d" })).toBe("m");
    expect(extractErrorMessage(response, { details: "d", description: "x" })).toBe("d");
    expect(extractErrorMessage(response, { description: "x", msg: "y" })).toBe("x");
    expect(extractErrorMessage(response, { msg: "y" })).toBe("y");
  });

  it("skips blank strings and reads nested error objects", () => {
    expect(extractErrorMessage(response, { error: "  ", message: "m" })).toBe("m");
    expect(extractErrorMessage(response, { error: { message: "nested" } })).toBe("nested");
  });

  it("falls back to the status text, then the status code", () => {
    expect(extractErrorMessage(response, {})).toBe("Internal Server Error (500)");
    expect(extractErrorMessage({ status: 502 }, null)).toBe("Server error: 502");
    expect(extractErrorMessage(undefined, undefined)).toBe("Server error: Unknown");
  });
});

describe("mapCategoryToErrorCode", () => {
  it("uses an explicit errorCode from the backend", () => {
    expect(mapCategoryToErrorCode(ERROR_CATEGORIES.SERVER_ERROR, { errorCode: "custom" })).toBe(
      "custom",
    );
  });

  it.each([
    [ERROR_CATEGORIES.AUTH_ERROR, ERROR_CODES.AUTH_REQUIRED],
    [ERROR_CATEGORIES.RATE_LIMITED, ERROR_CODES.QUOTA_EXCEEDED],
    [ERROR_CATEGORIES.SERVER_ERROR, ERROR_CODES.SERVER_ERROR],
    [ERROR_CATEGORIES.CLIENT_ERROR, ERROR_CODES.CLIENT_ERROR],
    [ERROR_CATEGORIES.NOT_FOUND, ERROR_CODES.NOT_FOUND],
    [ERROR_CATEGORIES.NETWORK_ERROR, ERROR_CODES.NETWORK_ERROR],
    [ERROR_CATEGORIES.UNKNOWN_ERROR, ERROR_CODES.UNKNOWN_ERROR],
  ])("maps %s to %s", (category, code) => {
    expect(mapCategoryToErrorCode(category, {})).toBe(code);
  });
});

describe("formatErrorForLogging", () => {
  it("redacts sensitive headers and keeps the rest", () => {
    const error = new Error("boom");
    error.code = "c";
    error.statusCode = 500;

    const logged = formatErrorForLogging({
      request: {
        method: "POST",
        url: "https://api.example.com",
        headers: { Authorization: "Bearer secret", authorization: "x", "X-Extension-ID": "id" },
      },
      response: { status: 500, statusText: "ISE", body: { error: "e" } },
      error,
      parseError: new SyntaxError("bad json"),
      category: ERROR_CATEGORIES.SERVER_ERROR,
    });

    expect(logged.request.headers.authorization).toBe("[REDACTED]");
    expect(logged.request.headers["X-Extension-ID"]).toBe("id");
    expect(logged.response).toEqual({ status: 500, statusText: "ISE", body: { error: "e" } });
    expect(logged.error).toEqual(
      expect.objectContaining({ message: "boom", code: "c", statusCode: 500 }),
    );
    expect(logged.parseError).toEqual({ message: "bad json", type: "SyntaxError" });
    expect(logged.category).toBe(ERROR_CATEGORIES.SERVER_ERROR);
    expect(typeof logged.timestamp).toBe("string");
  });

  it("handles a context without headers, error or parse error", () => {
    const logged = formatErrorForLogging({ request: {}, response: {} });
    expect(logged.request.headers).toBeNull();
    expect(logged.error).toBeNull();
    expect(logged.parseError).toBeNull();
  });
});
