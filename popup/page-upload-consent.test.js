/** @jest-environment jsdom */

const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "page-upload-consent.html"), "utf8");

describe("page upload consent popup", () => {
  let set;
  let close;

  beforeEach(() => {
    const popup = new DOMParser().parseFromString(html, "text/html");
    document.body.replaceChildren(...popup.body.children);
    set = jest.fn().mockResolvedValue(undefined);
    global.chrome.storage = { local: { set } };
    close = jest.spyOn(window, "close").mockImplementation(() => {});
    jest.isolateModules(() => require("./page-upload-consent.js"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome.storage;
  });

  it("waits for an affirmative click before storing consent", async () => {
    expect(set).not.toHaveBeenCalled();
    document.getElementById("allow-uploads").click();
    await Promise.resolve();
    expect(set).toHaveBeenCalledWith({ pageUploadConsentV1: true });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes without granting consent when the user declines", () => {
    document.getElementById("decline-uploads").click();
    expect(close).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
  });

  it("keeps the popup open and offers retry when saving consent fails", async () => {
    set.mockRejectedValueOnce(new Error("Cannot save consent"));
    const allow = document.getElementById("allow-uploads");
    allow.click();
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
    expect(allow.disabled).toBe(false);
    expect(document.getElementById("consent-error").hidden).toBe(false);
  });
});
