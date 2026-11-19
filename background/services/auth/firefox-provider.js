import {
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth/web-extension";
import { auth } from "../../../common/firebase-config.js";
import { ENV } from "../../../common/env-config.js";
import { STORAGE_KEYS } from "../../../common/constants.js";
import { emailSignInError } from "../../../common/email-sign-in-error.js";
import { BaseAuthProvider } from "./base-provider.js";

async function getGoogleCredential() {
  const { identity } = globalThis.browser;
  const redirectHost = new URL(identity.getRedirectURL()).hostname.split(".")[0];
  const redirect = new URL(`http://127.0.0.1/mozoauth2/${redirectHost}`);
  const state = crypto.randomUUID();
  const rawNonce = crypto.randomUUID();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawNonce));
  const nonce = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: ENV.FIREFOX_GOOGLE_CLIENT_ID,
    redirect_uri: redirect.href,
    response_type: "id_token",
    scope: "openid email profile",
    prompt: "select_account",
    state,
    nonce,
  });

  let response;
  try {
    response = await identity.launchWebAuthFlow({ url: authorizationUrl.href, interactive: true });
  } catch {
    throw new Error("Google sign-in did not complete. Please try again.");
  }
  if (!response) {
    throw new Error("Google sign-in did not complete. Please try again.");
  }

  const callback = new URL(response);
  const result = new URLSearchParams(callback.hash.slice(1));
  if (
    callback.origin !== redirect.origin ||
    callback.pathname !== redirect.pathname ||
    callback.search ||
    result.get("state") !== state ||
    result.has("error")
  ) {
    throw new Error("Google returned an invalid sign-in response.");
  }

  const idToken = result.get("id_token");
  try {
    const payload = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(payload));
    if (claims.nonce !== nonce || claims.aud !== ENV.FIREFOX_GOOGLE_CLIENT_ID) {
      throw new Error("Invalid token claims");
    }
  } catch {
    throw new Error("Google returned an invalid sign-in token.");
  }

  // Firebase verifies the signed ID token and creates the Firebase session.
  return new OAuthProvider("google.com").credential({ idToken, rawNonce });
}

// Both Firefox sign-in methods use the same Firebase session in the event page.
class FirefoxProvider extends BaseAuthProvider {
  async signIn(credentials) {
    const result =
      this.name === "google"
        ? await signInWithCredential(auth, await getGoogleCredential())
        : await signInWithEmailAndPassword(auth, credentials?.email, credentials?.password).catch(
            (error) => {
              throw new Error(emailSignInError(error));
            },
          );
    const { uid: userId, email, displayName, photoURL } = result.user;
    const firebaseToken = await result.user.getIdToken();
    await browser.storage.local.set({
      [STORAGE_KEYS.FIREBASE_TOKEN]: firebaseToken,
      [STORAGE_KEYS.USER_ID]: userId,
      [STORAGE_KEYS.USER_EMAIL]: email,
      [STORAGE_KEYS.USER_DISPLAY_NAME]: displayName || "",
      [STORAGE_KEYS.USER_PHOTO_URL]: photoURL || "",
    });
    return { success: true, userId, email, displayName, photoURL };
  }

  async signOut() {
    await auth.authStateReady();
    await signOut(auth);
    await browser.storage.local.remove(Object.values(STORAGE_KEYS));
  }

  async getCurrentUser() {
    await auth.authStateReady();
    return auth.currentUser;
  }

  async getIdToken(forceRefresh = false) {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error("Not authenticated");
    }
    return user.getIdToken(forceRefresh);
  }

  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  }
}

export function createFirefoxProviders() {
  const providers = [new FirefoxProvider("email", "Email/Password")];
  if (ENV.FIREFOX_GOOGLE_CLIENT_ID) {
    providers.push(new FirefoxProvider("google", "Google"));
  }
  return providers;
}
