# Save-A-Recipe Extension — Project Status
*Last updated: 2026-06-06*

This document is the single source of truth for feature status, known issues, and development planning. Update it when features ship or change.

---

## Table of Contents

1. [What the Extension Does](#what-the-extension-does)
2. [Implemented Features](#implemented-features)
3. [Planned Features (Backlog)](#planned-features-backlog)
4. [Known Bugs & Issues](#known-bugs--issues)
5. [Documentation Status](#documentation-status)
6. [Test Coverage Gaps](#test-coverage-gaps)

---

## What the Extension Does

Save-A-Recipe is a Chrome Extension (MV3) that saves recipes from any web page to a user's Google Drive as structured YAML files. The backend uses Gemini AI to parse recipe content.

**Core flow:**
1. User signs in via popup (email/password or Google)
2. On any recipe page, user clicks the toolbar icon
3. Content script extracts and compresses the page HTML
4. Background service POSTs to the backend API
5. Backend parses with Gemini, saves YAML to Google Drive
6. In-page bubble shows: loading → success (Drive link) or error

---

## Implemented Features

### Authentication

| Feature | Status | Notes |
|---|---|---|
| Email/password login | ✅ Done | Firebase Auth via offscreen document |
| Google Sign-In | ✅ Done | `chrome.identity.getAuthToken()` → Firebase credential exchange |
| Token storage | ✅ Done | Chrome storage as source of truth |
| Lazy token refresh | ✅ Done | Refreshes if token age > 50 min, on demand |
| Auto sign-out on failure | ✅ Done | Clears storage and re-throws on refresh failure |
| Popup appears only when logged out | ✅ Done | `chrome.action.setPopup('')` when authenticated |

### Save Flow

| Feature | Status | Notes |
|---|---|---|
| Windowless save (toolbar icon click) | ✅ Done | `action.onClicked` handler; no popup for authenticated users |
| Page HTML extraction | ✅ Done | Content script injected on demand |
| Basic HTML cleanup (extension) | ✅ Done | Removes script, style, noscript, iframe, svg, canvas, template tags |
| Intelligent HTML cleanup | ✅ Done (BE) | Backend strips nav/ads/sidebars, detects recipe content via schema.org / JSON-LD |
| Recipe caching | ✅ Done (BE) | Backend caches by URL; re-saves return cached result without re-processing |
| GZIP compression | ✅ Done | `transformation.js`, Base64 output |
| Backend API call | ✅ Done | `POST /v1/recipes?compression=gzip` |
| Double-click guard | ✅ Done | Prevents duplicate saves from rapid clicks |
| 90-second timeout safeguard | ✅ Done | Prevents stuck loading state |

### Feedback

| Feature | Status | Notes |
|---|---|---|
| In-page feedback bubble | ✅ Done | Single surface: loading → saved (4s auto-dismiss, Drive link) or error (persists) |
| Non-recipe detection | ✅ Done | Backend returns `isRecipe: false`; bubble shows "Not a recipe page" |
| Error categorization | ✅ Done | Maps HTTP codes to auth/quota/network/validation/server errors |
| User-friendly error messages | ✅ Done | `error-utils.js` + `error-handler.js` |
| Quota exceeded message | ✅ Done | Specific message for HTTP 429 from backend |

### UI / Pages

| Feature | Status | Notes |
|---|---|---|
| Popup (login-only) | ✅ Done | Email/password + Google button; closes on success |
| Options page | ✅ Done | Account section (email, sign out) + About section (version) |
| Recipe Creator | ✅ Done | 440×340px popup; textarea → `POST /v1/recipes/custom?compression=gzip` |
| Context menu | ✅ Done | Settings, Log Out, Create Recipe from Description |
| Shared design system | ✅ Done | `common/theme.css`: warm-neutral palette, single terracotta accent, Hanken Grotesk, 8px radius, hairline borders |
| Reduced-motion support | ✅ Done | `@media (prefers-reduced-motion)` guard in theme.css |

---

## Planned Features (Backlog)

Backend work is tagged **[BE]**, extension-only **[EXT]**.

### To Do

| Feature | Ref | Notes |
|---|---|---|
| Recipe conflict resolution | US-12 | When URL is cached but content changed: show choice UI (use cached / re-process). Backend caching is done; this is extension UI work. **[EXT]** |
| "Save Recipe" via right-click context menu | US-15 | Add a "Save Recipe" item to the icon context menu (separate from existing Settings/Logout/Creator items). **[EXT]** |
| Non-recipe analytics logging | US-10 | Backend: log non-recipe detections for quality monitoring. **[BE]** |
| Chrome Web Store listing | US-17 | Screenshots, description, privacy policy, ToS. **[EXT]** |
| CI/CD packaging | US-17 | Automated zip/version bump on release. **[EXT]** |
| Firefox support | US-17 | MV3 is mostly compatible; `chrome.identity` needs a polyfill or alternative auth path. **[EXT]** |

### Won't Do

| Feature | Ref | Reason |
|---|---|---|
| Drive folder selection / management | US-2, US-8, US-16 | Out of scope; backend controls folder assignment |
| Keyboard shortcuts | US-15 | Not worth the manifest complexity |

---

## Known Bugs & Issues

### Active

| Bug | Severity | Notes |
|---|---|---|
| Google Fonts dependency in theme.css | Low | `@import url(...)` in `common/theme.css` causes FOUT and requires network access. Fix: self-host the Hanken Grotesk woff2 files under `common/fonts/` and switch to `@font-face`. |

### Fixed (reference)

| Bug | Fixed | Notes |
|---|---|---|
| False logout on offscreen recreation | 2026-05-22 | Race condition: offscreen document recreates before Firebase restores state. Fix: Chrome storage is source of truth; lazy token validation on use. See `docs/auth-logout-fix.md`. |


---

## Documentation Status

| File | Status | Action |
|---|---|---|
| `README.MD` | Current | Minor update needed: reflect "Save-A-Recipe" name and current visual design |
| `CLAUDE.md` | Current | Keep updated as architecture changes |
| `docs/stories.md` | Outdated | Replace with this document; stories.md has wrong project name ("MyKukBuk"), completed plans still listed as open, Java backend code examples that don't apply |
| `docs/design-system.md` | Superseded | Documents the *old* culinary-editorial design (terracotta/sage dual palette, Crimson Pro serif, gradient blobs). Archive or delete — current design is in `docs/revised-design.md` and `common/theme.css` |
| `docs/revised-design.md` | Current | Completed design spec; keep as historical reference |
| `docs/firebase-setup.md` | Current (minor) | Path `/Users/alexey/dev/save-a-recipe/sar-ext` is stale (should be `/sar/sar-ext`); otherwise accurate |
| `docs/auth-logout-fix.md` | Current | Bug post-mortem; keep for reference |
| `docs/quota-exceeded-ticket.md` | Current | Brief task note; can be folded into this document and deleted |
| `docs/name.md` | Stale | Domain brainstorming with no conclusion. Extension is now "Save-A-Recipe". Archive or delete |
| `docs/firebase-config.html` | Unknown | Appears to be a Firebase config snippet; verify if still used or delete |
| `background/services/auth/README.md` | Current | Auth architecture doc; keep updated |
| `docs/plans/completed/` | Archive | Completed plans; no action needed |

---

## Test Coverage Gaps

Overall: 65.8% statements, 53.1% branches.

| Area | Coverage | Priority | Notes |
|---|---|---|---|
| `background/` | 88.8% | Low | Good coverage |
| `background/services/api.js` | 91.6% | Low | Good coverage |
| `content/content.js` | 90.2% | Low | Good coverage |
| `background/services/auth/google-provider.js` | 85.4% | Low | Reasonable |
| `background/services/auth/base-provider.js` | 33.3% | Medium | Needs tests for error paths |
| `background/services/auth/email-provider.js` | 0% | High | No tests at all |
| `common/error-utils.js` | 0% | High | No tests at all |
| Branch coverage overall | 53.1% | Medium | Many error/edge paths uncovered |
