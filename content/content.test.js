/**
 * @jest-environment jsdom
 */

// Helper: resolve the onMessage listener registered by content.js
function getOnMessageListener() {
  const calls = chrome.runtime.onMessage.addListener.mock.calls;
  return calls[calls.length - 1][0];
}

// Helper: send a SHOW_BUBBLE message to the listener
function sendBubble(data = {}) {
  const listener = getOnMessageListener();
  const sendResponse = jest.fn();
  listener({ type: "SHOW_BUBBLE", data }, {}, sendResponse);
  return sendResponse;
}

// Helper: tick only the animation frame (rAF = setTimeout(fn, 0) in jsdom)
// Using advanceTimersByTime(1) ensures only zero-delay timers fire, not
// longer auto-dismiss or remove timeouts.
function flushAnimationFrame() {
  jest.advanceTimersByTime(1);
}

describe("content script bubble", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    jest.resetAllMocks();
    // Clean DOM
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    // Load content script fresh each test
    jest.isolateModules(() => {
      require("./content.js");
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("renders a bubble on SHOW_BUBBLE message", () => {
    sendBubble({ text: "Saving recipe…", variant: "loading" });
    flushAnimationFrame();
    const bubble = document.querySelector(".kukbuk-light-bubble");
    expect(bubble).not.toBeNull();
    expect(bubble.querySelector(".kukbuk-bubble-text").textContent).toBe("Saving recipe…");
    expect(bubble.querySelector(".kukbuk-bubble-dot").classList.contains("loading")).toBe(true);
  });

  test("sendResponse is called with success:true on SHOW_BUBBLE", () => {
    const sendResponse = sendBubble({ text: "hi", variant: "info" });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test("single-instance: second call replaces first (state swap, one bubble in DOM)", () => {
    sendBubble({ text: "First", variant: "loading" });
    flushAnimationFrame();
    sendBubble({ text: "Saved", variant: "success" });
    flushAnimationFrame();
    const bubbles = document.querySelectorAll(".kukbuk-light-bubble");
    expect(bubbles.length).toBe(1);
    const textEl = bubbles[0].querySelector(".kukbuk-bubble-text");
    expect(textEl.textContent).toBe("Saved");
    expect(bubbles[0].querySelector(".kukbuk-bubble-dot").classList.contains("success")).toBe(true);
  });

  test("loading→success state transition updates dot and text", () => {
    sendBubble({ text: "Saving recipe…", variant: "loading", duration: 0 });
    flushAnimationFrame();
    sendBubble({ text: "Saved!", variant: "success", duration: 4000 });
    flushAnimationFrame();
    const bubble = document.querySelector(".kukbuk-light-bubble");
    expect(bubble.querySelector(".kukbuk-bubble-dot").classList.contains("success")).toBe(true);
    expect(bubble.querySelector(".kukbuk-bubble-text").textContent).toBe("Saved!");
  });

  test("loading→error state transition updates dot and text", () => {
    sendBubble({ text: "Saving…", variant: "loading", duration: 0 });
    flushAnimationFrame();
    sendBubble({ text: "Couldn't save", variant: "error", duration: 0 });
    flushAnimationFrame();
    const bubble = document.querySelector(".kukbuk-light-bubble");
    expect(bubble.querySelector(".kukbuk-bubble-dot").classList.contains("error")).toBe(true);
    expect(bubble.querySelector(".kukbuk-bubble-text").textContent).toBe("Couldn't save");
  });

  test("link is rendered on success", () => {
    sendBubble({
      text: "Saved",
      variant: "success",
      link: { url: "https://drive.google.com/file/123", label: "Open ↗" },
    });
    flushAnimationFrame();
    const link = document.querySelector(".kukbuk-bubble-link");
    expect(link).not.toBeNull();
    expect(link.href).toBe("https://drive.google.com/file/123");
    expect(link.textContent).toBe("Open ↗");
    expect(link.target).toBe("_blank");
  });

  test("no link rendered when link is absent", () => {
    sendBubble({ text: "Saving…", variant: "loading" });
    flushAnimationFrame();
    expect(document.querySelector(".kukbuk-bubble-link")).toBeNull();
  });

  test("link updates when transitioning from loading to success", () => {
    sendBubble({ text: "Saving…", variant: "loading" });
    flushAnimationFrame();
    expect(document.querySelector(".kukbuk-bubble-link")).toBeNull();
    sendBubble({
      text: "Saved",
      variant: "success",
      link: { url: "https://drive.google.com/file/abc", label: "Open ↗" },
    });
    flushAnimationFrame();
    const link = document.querySelector(".kukbuk-bubble-link");
    expect(link).not.toBeNull();
    expect(link.textContent).toBe("Open ↗");
  });

  test("dismiss button removes bubble on success when clicked", () => {
    sendBubble({ text: "Saved", variant: "success", dismissible: true });
    flushAnimationFrame();
    const btn = document.querySelector(".kukbuk-bubble-dismiss");
    expect(btn).not.toBeNull();
    btn.click();
    // advance past the hide-animation timeout (150ms)
    jest.advanceTimersByTime(200);
    expect(document.querySelector(".kukbuk-light-bubble")).toBeNull();
  });

  test("error variant shows dismiss button automatically", () => {
    sendBubble({ text: "Couldn't save", variant: "error" });
    flushAnimationFrame();
    const btn = document.querySelector(".kukbuk-bubble-dismiss");
    expect(btn).not.toBeNull();
  });

  test("dismiss button removes bubble on error when clicked", () => {
    sendBubble({ text: "Couldn't save", variant: "error", duration: 0 });
    flushAnimationFrame();
    const btn = document.querySelector(".kukbuk-bubble-dismiss");
    btn.click();
    jest.advanceTimersByTime(200);
    expect(document.querySelector(".kukbuk-light-bubble")).toBeNull();
  });

  test("loading variant has no dismiss button by default", () => {
    sendBubble({ text: "Saving…", variant: "loading", duration: 0 });
    flushAnimationFrame();
    expect(document.querySelector(".kukbuk-bubble-dismiss")).toBeNull();
  });

  test("success auto-dismisses after duration", () => {
    sendBubble({ text: "Saved", variant: "success", duration: 4000 });
    flushAnimationFrame();
    expect(document.querySelector(".kukbuk-light-bubble")).not.toBeNull();
    // Advance past the auto-dismiss delay, then past the hide-animation timeout (150ms)
    jest.advanceTimersByTime(4001);
    jest.advanceTimersByTime(200);
    expect(document.querySelector(".kukbuk-light-bubble")).toBeNull();
  });

  test("loading persists (no auto-dismiss) when duration is 0", () => {
    sendBubble({ text: "Saving…", variant: "loading", duration: 0 });
    flushAnimationFrame();
    jest.advanceTimersByTime(60000);
    expect(document.querySelector(".kukbuk-light-bubble")).not.toBeNull();
  });

  test("responds to PING message", () => {
    const listener = getOnMessageListener();
    const sendResponse = jest.fn();
    listener({ type: "PING" }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test("EXTRACT_RECIPE responds with page content, url and title", async () => {
    document.title = "Test Recipe Page";
    document.body.innerHTML = "<h1>Pasta</h1>";
    const listener = getOnMessageListener();
    const sendResponse = jest.fn();
    const returned = listener({ type: "EXTRACT_RECIPE" }, {}, sendResponse);
    // Async response: handler must return true to keep the channel open
    expect(returned).toBe(true);
    // Flush the extractRecipeData promise
    await Promise.resolve();
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledTimes(1);
    const response = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.title).toBe("Test Recipe Page");
    expect(response.data.pageUrl).toBe(window.location.href);
    expect(typeof response.data.pageContent).toBe("string");
    expect(response.data.pageContent).toContain("Pasta");
  });

  test("unknown message type responds with success:false", () => {
    const listener = getOnMessageListener();
    const sendResponse = jest.fn();
    listener({ type: "NOPE" }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: "Unknown message type",
    });
  });
});
