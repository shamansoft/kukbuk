# MyKukBuk Extension — Visual Redesign

## Overview

Implement the full redesign specified in `docs/revised-design.md`: a quiet,
professional, minimalist visual system plus a simplified feedback model. The
work removes the current over-designed, noisy UI (excess motion, gradients,
pill buttons, serif display font) and the redundant five-channel notification
system, replacing them with:

- A **shared minimal design system** (flat warm-neutral palette, one accent,
  hairline borders, 8px radius, restrained motion, single sans font).
- A **single in-page bubble** as the only save-feedback surface (loading →
  saved/error), driven from the background.
- A **windowless save**: clicking the toolbar icon while logged in saves
  directly (no popup window); the popup exists only for the logged-out login
  screen.
- **Removal of OS notifications** entirely.
- Restyled **login popup**, **settings page**, and **recipe-creator window**.

Key benefits: a calmer, more professional appearance; one coherent feedback
moment instead of overlapping "blobs"; no heavyweight popup window under the
toolbar for a one-click action.

## Context (from discovery)

**Files/components involved:**
- `common/theme.css` — **new** shared token/font stylesheet
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js` — login-only after redesign
- `content/content.js` — `showLightBubble` becomes the single feedback surface
- `background/background.js` — new `action.onClicked` save orchestration + `setPopup` logic + context menu
- `background/services/api.js` — `saveRecipe` flow; remove `notify.recipeSaved` calls
- `background/services/notifications.js` — OS notifications removed
- `options/options.html`, `options/options.css`, `options/options.js` — restyle, drop Notifications card
- `recipe-creator/recipe-creator.html`, `recipe-creator.css`, `recipe-creator.js` — restyle
- `manifest.json` — remove `notifications` permission
- `common/constants.js` — `MESSAGE_TYPES.SHOW_BUBBLE` already exists
- Tests: `background/background.test.js`, `background/services/api.test.js`,
  `background/services/notifications.test.js`, `popup/popup.test.js`,
  `test/manifest.test.js`; **new** `content/content.test.js`

**Related patterns found:**
- `SAVE_RECIPE` is handled in `background/services/api.js:24`; `saveRecipe()` does
  a synchronous `fetch` that **returns the final result** (`title`, `driveFileUrl`,
  `isRecipe`) — confirmed model, so the bubble can report a real Saved/error.
- `content.js` already has a working single-bubble mechanism (`showLightBubble`,
  `currentBubble`) with correct `pointer-events`/`position: fixed`, but it is
  **never invoked** (no sender) — it just needs restyle + wiring + a link/dismiss.
- CSS is static (webpack bundles JS only), so shared tokens are delivered via a
  `<link>` to `common/theme.css` in each HTML page.
- Jest + jsdom; coverage collected from `background/`, `popup/`, `content/`,
  `common/`. `npm run test`, `npm run lint`.

**Decisions locked in (from planning):**
- Scope: **full design overhaul**.
- Logged-in popup: **dropped** (icon click saves; Settings/Log out stay in the
  toolbar context menu).
- Typography: **Hanken Grotesk everywhere**, retire Crimson Pro serif.
- Testing: **regular** (code first, then tests).
- Backend response: **synchronous** (current behavior) — bubble reports real result.

## Development Approach
- **Testing approach**: Regular (implement, then add/update tests per task).
- Complete each task fully before moving to the next.
- Make small, focused changes; maintain a working extension after every task.
- **CRITICAL: every task with JS changes MUST include new/updated Jest tests**
  (success + error scenarios) as separate checklist items.
- **CRITICAL: all tests + lint must pass before starting the next task.**
- CSS-only tasks cannot be meaningfully unit-tested; for those the required
  gate is `npm run lint` + the HTML/manifest assertion tests + manual visual
  verification (tracked in Post-Completion). Where a CSS change has an
  assertable structural side effect (e.g. a removed `<link>`/permission), add a
  string/DOM assertion test.
- Keep the extension loadable at each step; aliasing old token names (Task 1)
  prevents mid-migration breakage; aliases are removed in Task 10.

## Testing Strategy
- **Unit tests**: required for every JS task (background orchestration, bubble
  state machine, popup login logic, notification removal).
- **E2E tests**: project has no browser e2e harness; manual verification matrix
  in Post-Completion covers the behavioral cases (a/b/c from the design doc).
- Mock `chrome.*` APIs (`action`, `tabs`, `scripting`, `runtime`, `notifications`)
  in jsdom as existing tests already do.

## Progress Tracking
- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with ➕ prefix.
- Document issues/blockers with ⚠️ prefix.
- Update this plan if implementation deviates from scope.

## What Goes Where
- **Implementation Steps** (`[ ]`): all code/CSS/test/doc changes in this repo.
- **Post-Completion** (no checkboxes): manual visual/UX verification, Chrome Web
  Store listing/screenshot updates, anything outside this repo.

## Implementation Steps

### Task 1: Shared design tokens & font foundation
- [x] create `common/theme.css` with the §2 token set: warm-neutral palette
  (`--paper`, `--surface`, `--ink`, `--ink-soft`, `--ink-faint`, `--line`,
  `--line-strong`), single accent (`--accent`, `--accent-hover`, `--accent-wash`),
  semantic states (`--ok`, `--ok-wash`, `--err`, `--err-wash`), one elevation
  (`--shadow-pop`), motion tokens (`--ease`, `--dur`), radius `--radius: 8px`,
  and the type scale (`--t-title/body/label/meta`)
- [x] add Hanken Grotesk: prefer **self-hosting** woff2 in `fonts/` via
  `@font-face` (recommended, avoids remote fetch/FOUT); fallback acceptable is an
  `@import`/`<link>` from Google Fonts. Set `--font` with system fallback stack
- [x] add a global `@media (prefers-reduced-motion: reduce)` guard that disables
  animations/transitions
- [x] alias legacy variable names (`--color-terracotta`, `--color-cream`,
  `--font-display`, `--radius-full`, etc.) to the new tokens so existing
  `popup.css`/`options.css` keep rendering during migration
- [x] link `common/theme.css` in `popup.html`, `options.html`,
  `recipe-creator.html` **before** the page-specific stylesheet
- [x] update/extend `test/manifest.test.js` (or add a small DOM/string test) to
  assert each HTML page references `common/theme.css`
- [x] run `npm run lint` + `npm run test` — must pass before next task

### Task 2: Apply tokens, kill motion, de-gradient/de-pill (global)
- [x] in `popup.css` + `options.css` + `recipe-creator.css`: remove all gradient
  fills (body, buttons, toggles, icons) in favor of flat `--accent`/`--surface`
- [x] replace pill radius (`--radius-full`) on buttons/inputs/cards with
  `--radius` (8px); keep round only for avatar/status dot
- [x] remove decorative motion: `float` blobs, `subtlePulse`, `successBounce`,
  `errorShake`, per-child entrance stagger, header underline `slideIn`/`::after`,
  hover-lift `translateY`, button ripple `::before`
- [x] replace colored shadows with `1px var(--line)` borders; reserve
  `--shadow-pop` for the bubble only
- [x] reduce entrances to a single quiet fade (≤120ms, ≤4px rise)
- [x] run `npm run lint`; manual visual check of popup/options/creator (note in
  Post-Completion) — lint must pass before next task

### Task 3: Redesign the in-page bubble (single feedback surface)
- [x] restyle `showLightBubble` in `content/content.js`: light card
  (`--surface` + `1px --line` + `--radius` + `--shadow-pop`), colored **dot**
  (not full saturated background) for loading(spinner)/ok/error, calm palette
  (drop `#2196f3/#4caf50/#f44336`)
- [x] extend the bubble API to support an inline **link** (`{url, label}`, e.g.
  "Open ↗") rendered as `<a target="_blank">`, and an explicit **dismiss**
  (close button + click-to-dismiss)
- [x] enforce single-instance with in-place **state swap** (cross-fade
  icon+text) instead of remove+add; loading has no auto-dismiss; success
  auto-dismisses (~4s); error persists until dismissed
- [x] keep `pointer-events: none` on container / `auto` on bubble, `position: fixed`
- [x] add `content/content.test.js`: bubble renders, single-instance (second call
  replaces first), state transition loading→ok / loading→error, link rendered on
  success, dismiss removes it (success + error cases)
- [x] run `npm run lint` + `npm run test` — must pass before next task

### Task 4: Windowless save orchestration (background)
- [x] add `chrome.action.onClicked` listener in `background/background.js`:
  immediately send `SHOW_BUBBLE` "Saving recipe…" (loading) to the active tab,
  then run extract→save reusing the existing flow, then send `SHOW_BUBBLE`
  success (with `driveUrl` link) or error/"not a recipe"
- [x] add `setPopup` logic: `setPopup("")` when authenticated (click →
  `onClicked`), `setPopup("popup/popup.html")` when logged out; apply on
  `initBackground` (after auth check), after sign-in success, and after logout
- [x] reuse content-script readiness (PING + `scripting.executeScript` fallback);
  on tabs with no content script (`chrome://`, New Tab, PDF) skip the bubble
  silently (no error surfaced)
- [x] add a **double-click guard** (ignore a click while a save for that tab is
  in flight) and a **~90s timeout** that resolves a hung request to an error
  bubble
- [x] on resolution, attempt to message the originating tab and **swallow failure
  silently** if the tab is gone (case c — no tracking, no retry)
- [x] add tests in `background/background.test.js`: `onClicked` sends loading
  then success/error bubble (mock `chrome.action`, `chrome.tabs`, `chrome.scripting`);
  `setPopup` set correctly per auth state; double-click guard prevents a second
  in-flight save; timeout produces an error bubble
- [x] run `npm run lint` + `npm run test` — must pass before next task

### Task 5: Strip popup to login-only
- [x] `popup/popup.html`: remove `#minimal-status-section`, `#success-section`,
  and `#main-section` (logged-in view); keep only `#login-section`
- [x] `popup/popup.js`: remove `handleAuthenticatedFlow`, `showMinimalStatus`,
  `hideMinimalStatus`, `showSuccessWithLink`, `ensureContentScriptReady`,
  save-recipe orchestration, and all `toast`/`#status-message` save feedback;
  keep email + Google sign-in and inline login error display
- [x] on successful login, request the background to set the windowless popup
  state (Task 4) and close the window
- [x] remove the now-unused `toast`/`#status-message` usage from the login path
  (decide: keep a minimal inline error line for login failures only)
- [x] update `popup/popup.test.js`: drop auto-save/minimal-status tests; keep/extend
  login success + failure (email + Google) tests
- [x] run `npm run lint` + `npm run test` — must pass before next task

### Task 6: Remove OS notifications
- [x] remove `notify.recipeSaved(...)` calls from `background/services/api.js`
  (the bubble now owns save feedback)
- [x] remove save/auth notification helpers from
  `background/services/notifications.js`; keep only what's genuinely tab-less if
  needed (else delete the service and its `setupNotifications()` wiring in
  `background.js`)
- [x] remove the `"notifications"` permission from `manifest.json`
- [x] remove notification preference plumbing tied to the deleted feature
  (`GET/UPDATE_NOTIFICATION_PREFERENCES`) if no longer referenced
- [x] update `background/services/notifications.test.js` and
  `background/services/api.test.js` to reflect removal (delete obsolete cases,
  assert `notify.recipeSaved` is no longer called); update `test/manifest.test.js`
  to assert `notifications` permission is absent
- [x] run `npm run lint` + `npm run test` — must pass before next task

### Task 7: Restyle login popup (§4.2)
- [x] `popup.css`/`popup.html`: left-aligned layout, small mark + sans wordmark,
  8px inputs with `1px --line`, focus = `--accent` border + `--accent-wash` ring
  and **no transform**, flat accent "Sign in", hairline "or" divider (no
  gradient), `--surface` Google button with 1px border
- [x] single entrance fade for the form; remove per-field stagger
- [x] width ~320–360px; ensure no leftover minimal-mode styles
- [x] add/extend a DOM/string assertion test (e.g. login section present,
  removed sections absent) in `popup/popup.test.js`
- [x] run `npm run lint` + `npm run test`; manual visual check — must pass before next task

### Task 8: Restyle settings page & remove Notifications card (§4.5)
- [x] `options.html`: remove the entire Notifications `<section>` (toggles); keep
  Account + About only
- [x] `options.css`: flat `--paper` background (no blobs), `--surface` + `1px --line`
  cards with no hover transform/shadow, container max-width ~620px, `--t-title`
  headings with a single hairline rule (drop animated underline + `::after`),
  delete now-unused toggle-switch CSS
- [x] `options.js`: remove notification-preference load/save handlers tied to the
  removed card
- [x] update any options test/string assertions (Notifications section absent,
  Account/About present)
- [x] run `npm run lint` + `npm run test`; manual visual check — must pass before next task

### Task 9: Restyle recipe-creator window (§4.6)
- [x] `recipe-creator.css`/`.html`: flat 8px accent "Create recipe" button, 8px
  `1px --line` textarea, calm result row reusing the redesigned success/error
  treatment (dot + text + "Open in Drive ↗"), no bounce/spin
- [x] ensure it inherits `common/theme.css`; remove dependence on removed
  `.minimal-status-icon` bounce styles
- [x] add/extend a DOM/string assertion test if a `recipe-creator` test is
  feasible (else manual-only, noted in Post-Completion)
- [x] run `npm run lint` + `npm run test`; manual visual check — must pass before next task

### Task 10: Verify acceptance criteria & remove token aliases
- [x] remove the legacy token aliases added in Task 1 (all screens migrated)
- [x] verify all Overview goals implemented: single bubble feedback, windowless
  save, OS notifications gone, login/settings/creator restyled, serif retired
- [x] verify behavioral cases from the design doc: (a) waits → sees result,
  (b) keeps using page → bubble non-blocking & dismissible, (c) leaves → no
  errors, nothing tracked
- [x] run full `npm run test` (coverage ≥ project standard) and `npm run lint`
  (zero issues)
- [x] build check: `npm run build:local` succeeds

### Task 11: Update documentation
- [ ] update `CLAUDE.md` (remove `notifications` permission mention; note the
  windowless-save/`setPopup` behavior, single-bubble feedback, theme.css location,
  Hanken Grotesk)
- [ ] update `README.MD` if it references notifications/popup behavior
- [ ] note the shared `common/theme.css` token system for future pages

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`*

## Technical Details

**Feedback message contract (`SHOW_BUBBLE`)** — extend `message.data`:
```
{
  text: string,
  variant: "loading" | "success" | "error",   // maps to dot/spinner color
  duration: number,        // 0 = persist (loading, error); ~4000 = success
  link?: { url: string, label: string },       // e.g. { url, label: "Open ↗" }
  dismissible?: boolean,
  closePrevious: true      // enforce single instance / state swap
}
```

**Windowless save flow (background `action.onClicked`):**
```
click → guard(tabId in-flight?) → SHOW_BUBBLE loading
      → ensure content script → EXTRACT_RECIPE → saveRecipe()
      → ok:   SHOW_BUBBLE success + link(driveUrl)   (auto-dismiss 4s)
      → !rec: SHOW_BUBBLE error "Not a recipe"
      → err:  SHOW_BUBBLE error + Retry
      → timeout(90s): SHOW_BUBBLE error
      → message-send failure (tab gone): swallow silently
```

**setPopup state:** authenticated → `""` (click hits `onClicked`); logged out →
`"popup/popup.html"`. Updated on init/sign-in/logout.

**Synchronous save assumption:** `saveRecipe()` returns the final
`{ title, driveUrl, isRecipe }`; if the backend later moves to `202 + async`,
real success/error reporting would need polling/push (out of scope — flagged in
`docs/revised-design.md` Open Question #5).

## Post-Completion
*Items requiring manual intervention or external systems — informational only*

**Manual verification:**
- Visual QA of popup (login), settings, recipe-creator against §4 mockups (light,
  flat, hairline, 8px, single sans, no blobs/pulse).
- Behavioral QA of the save bubble on a real recipe page:
  - (a) wait → "Saving recipe…" → "Saved · Open ↗"; link opens Drive file.
  - (b) scroll/click the page while saving → bubble never blocks interaction, is
    dismissible, survives scroll.
  - (c) close tab / switch tab / unfocus browser mid-save → no errors, no chase,
    recipe still lands in Drive (backend).
  - error path → "Couldn't save · Retry" persists and is dismissible.
  - restricted page (`chrome://`, New Tab) → click produces no crash, no bubble.
- `prefers-reduced-motion` honored (animations disabled).
- Confirm no double-save on rapid double-click.

**External system updates:**
- Update Chrome Web Store listing screenshots to the new UI before release.
- Re-bump version via the build's `increment-version.js` for the store package.
