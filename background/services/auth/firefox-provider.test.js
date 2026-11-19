import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import {
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth/web-extension";
import { auth } from "../../../common/firebase-config.js";
import { ENV } from "../../../common/env-config.js";
import { createFirefoxProviders } from "./firefox-provider.js";

jest.mock("firebase/auth/web-extension", () => ({
  OAuthProvider: jest.fn().mockImplementation((provider) => ({
    credential: (options) => ({ provider, ...options }),
  })),
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock("../../../common/firebase-config.js", () => ({
  auth: { currentUser: null, authStateReady: jest.fn() },
}));
jest.mock("../../../common/env-config.js", () => ({
  ENV: { FIREFOX_GOOGLE_CLIENT_ID: "" },
}));

const user = {
  uid: "firebase-user",
  email: "cook@example.com",
  getIdToken: jest.fn().mockResolvedValue("firebase-token"),
};

function mockGoogleResponse(changeCallback = () => {}, changeClaims = () => {}) {
  browser.identity.launchWebAuthFlow.mockImplementation(async ({ url, interactive }) => {
    const request = new URL(url);
    const params = request.searchParams;
    expect(interactive).toBe(true);
    expect(request.origin).toBe("https://accounts.google.com");
    expect(params.get("response_type")).toBe("id_token");
    const callback = new URL(params.get("redirect_uri"));
    expect(callback.href).toBe("http://127.0.0.1/mozoauth2/addon");
    const claims = { nonce: params.get("nonce"), aud: params.get("client_id") };
    changeClaims(claims);
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    callback.hash = new URLSearchParams({
      state: params.get("state"),
      id_token: `header.${payload}.signature`,
    });
    changeCallback(callback);
    return callback.href;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  ENV.FIREFOX_GOOGLE_CLIENT_ID = "";
  auth.currentUser = null;
  auth.authStateReady.mockResolvedValue();
  global.browser = {
    storage: { local: { set: jest.fn(), remove: jest.fn() } },
    identity: {
      getRedirectURL: () => "https://addon.extensions.allizom.org/",
      launchWebAuthFlow: jest.fn(),
    },
  };
  signInWithEmailAndPassword.mockResolvedValue({ user });
  signInWithCredential.mockResolvedValue({ user });
});

beforeAll(() => {
  Object.defineProperty(global, "crypto", { value: webcrypto, configurable: true });
  global.TextEncoder = TextEncoder;
});

test("email works without Google OAuth configuration", async () => {
  const providers = createFirefoxProviders();
  expect(providers.map((provider) => provider.name)).toEqual(["email"]);
  const [email] = providers;
  await email.signIn({ email: user.email, password: "password" });
  expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, user.email, "password");
  expect(browser.storage.local.set).toHaveBeenCalledWith(
    expect.objectContaining({ firebaseToken: "firebase-token", userId: user.uid }),
  );
});

test("maps rejected email credentials to the shared sign-in error", async () => {
  signInWithEmailAndPassword.mockRejectedValueOnce({ code: "auth/invalid-credential" });
  const [email] = createFirefoxProviders();
  await expect(email.signIn({ email: user.email, password: "wrong" })).rejects.toThrow(
    "Invalid email or password. Please try again.",
  );
  expect(browser.storage.local.set).not.toHaveBeenCalled();
});

test("waits for Firebase to restore an event page's session before refreshing", async () => {
  auth.authStateReady.mockImplementationOnce(async () => {
    auth.currentUser = user;
  });
  const [email] = createFirefoxProviders();
  await expect(email.getIdToken(true)).resolves.toBe("firebase-token");
  expect(user.getIdToken).toHaveBeenCalledWith(true);
  await email.signOut();
  expect(signOut).toHaveBeenCalledWith(auth);
  expect(browser.storage.local.remove).toHaveBeenCalledWith(
    expect.arrayContaining(["firebaseToken"]),
  );
});

test("establishes a Firebase session from a validated Firefox Google redirect", async () => {
  ENV.FIREFOX_GOOGLE_CLIENT_ID = "firefox-client.apps.googleusercontent.com";
  mockGoogleResponse();
  const [, google] = createFirefoxProviders();
  await expect(google.signIn()).resolves.toMatchObject({ success: true, userId: user.uid });
  expect(signInWithCredential).toHaveBeenCalledWith(
    auth,
    expect.objectContaining({ provider: "google.com", rawNonce: expect.any(String) }),
  );
});

test.each([
  [
    "redirect",
    (url) => {
      url.pathname += "-wrong";
    },
    undefined,
  ],
  [
    "state",
    (url) => {
      url.hash = "state=wrong";
    },
    undefined,
  ],
  [
    "nonce",
    undefined,
    (claims) => {
      claims.nonce = "wrong";
    },
  ],
  [
    "audience",
    undefined,
    (claims) => {
      claims.aud = "wrong";
    },
  ],
])(
  "rejects an invalid Google %s before exchanging the token",
  async (_, changeUrl, changeClaims) => {
    ENV.FIREFOX_GOOGLE_CLIENT_ID = "firefox-client.apps.googleusercontent.com";
    mockGoogleResponse(changeUrl, changeClaims);
    const [, google] = createFirefoxProviders();
    await expect(google.signIn()).rejects.toThrow(/invalid sign-in/);
    expect(signInWithCredential).not.toHaveBeenCalled();
    expect(browser.storage.local.set).not.toHaveBeenCalled();
  },
);
