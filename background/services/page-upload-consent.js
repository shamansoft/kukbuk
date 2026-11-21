import { STORAGE_KEYS } from "../../common/constants.js";

/* global __FIREFOX__ */
const isFirefox = typeof __FIREFOX__ !== "undefined" && __FIREFOX__;

export async function hasPageUploadConsent() {
  // Firefox obtains consent through the manifest's required data permissions at installation.
  if (isFirefox) return true;

  try {
    const consent = await chrome.storage.local.get(STORAGE_KEYS.PAGE_UPLOAD_CONSENT);
    return consent[STORAGE_KEYS.PAGE_UPLOAD_CONSENT] === true;
  } catch {
    return false;
  }
}
