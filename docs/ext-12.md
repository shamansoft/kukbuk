# EXT-12: Smart Extension Click Behavior

**Status:** ✅ Completed

**User Stories:**
- **As a user**, I want the extension to intelligently handle my click based on my current state.
- **As a user**, I want seamless token refresh without manual intervention.

**Technical Stories:**
- [x] Modify extension icon click handler to check auth state first
- [x] Implement automatic token refresh before recipe extraction
- [x] Add token expiry validation with buffer time
- [x] Create unified authentication flow for icon clicks
- [x] Add loading states for authentication processes
- [x] Implement retry logic for failed token refresh
- [x] Implement light bubbles visual elements that appear if the user is logged in. Instead of the full extension's form there should appear a blue bubble with message: saving... and disappear in 5 seconds. After the response was received back A green bubble should appear with message: saved! and disappear in 10 seconds. The bubble should appear under the extensions panel next to the extension's icon.

**Acceptance Criteria:**

**AC1** ✅  
Given I click the extension icon while logged out  
When the popup opens  
Then I should see the login flow immediately

**AC2** ✅  
Given I click the extension icon while logged in with valid tokens  
When the popup opens  
Then recipe extraction should start immediately

**AC3** ✅  
Given I click the extension icon while logged in with expired tokens  
When the popup opens  
Then tokens should refresh automatically  
And recipe extraction should proceed seamlessly  
And I should see appropriate loading feedback

**Commit:** `642cc5e` - "save on icon click"

---

# EXT-12-a: Bubble-First UX with Minimal Popup

**Status:** ✅ Completed

**User Stories:**
- **As a user**, I want to see quick bubble feedback when clicking the extension icon, not a full popup window.
- **As a user**, I want the popup window to only appear when I need to log in or manually save a recipe.
- **As a user**, I want clear visual feedback about what's happening through bubbles with different states.

**Current Behavior (Before EXT-12-a):**
When extension icon is clicked:
1. Extension popup window opens immediately
2. Shows "login" status briefly
3. Realizes user is logged in and changes view to show "Save Recipe" button
4. Auto-starts recipe extraction and save
5. Shows bubbles during the process

**Problems:**
- Unnecessary popup window flash/transition for logged-in users
- Popup opens even when user just wants to save (already authenticated)
- Visual clutter with both popup and bubbles showing

**Expected Behavior (Detailed User Requirements):**

### Option 1: User is Logged In (Bubble-Only Flow)
**When I click the extension icon:**
1. Show **"loading..."** bubble (checking authentication status)
2. Realize user is logged in
3. Close "loading..." bubble
4. Show **"saving..."** bubble 
   - Keep showing until we receive a response OR bigger timeout (2 minutes)
   - Do NOT close it after 5 seconds like before
5. **On success response**: 
   - Close "saving..." bubble
   - Show **"saved!"** bubble (green, success variant)
   - Auto-close after 10 seconds
6. **On error response**:
   - Close "saving..." bubble
   - Show **"error"** bubble (red, error variant)
   - Auto-close after 10 seconds
7. **On timeout (2 minutes)**:
   - Close "saving..." bubble
   - Show **"timeout"** bubble (yellow/orange, timeout variant)
   - Auto-close after 10 seconds
8. **Popup window NEVER opens** - everything happens via bubbles

**Critical Requirements:**
- Bubbles must close previous bubble before showing next one
- "loading..." closes before "saving..." appears
- "saving..." closes before final bubble (saved/error/timeout) appears
- No popup window flash or visibility for authenticated users

### Option 2: User is NOT Logged In (Login Flow)
**When I click the extension icon:**
1. Show **"loading..."** bubble briefly
2. Realize user is NOT logged in
3. Show regular extension window with login flow
4. After user logs in:
   - Show regular window with "Save Recipe" button
   - Do NOT auto-save (user must click button manually)
   - Keep popup visible for manual interaction

**Technical Stories:**
- [x] Modify popup initialization to check auth silently before opening UI
- [x] Implement bubble-first flow that prevents popup from opening for authenticated users
- [x] Add bubble variants: loading, saving, saved (success), error, timeout
- [x] Implement 2-minute timeout for "saving" bubble
- [x] Show popup window only for unauthenticated users
- [x] Disable auto-save after login when popup is visible (user should click button manually)
- [x] Add proper error handling for all bubble states
- [x] Ensure bubbles are visible and positioned correctly near extension icon

**Acceptance Criteria:**

**AC1: Authenticated User - Successful Save** ✓  
Given I am logged in with valid tokens  
When I click the extension icon  
Then I should see a "loading..." bubble  
And I should NOT see the popup window open  
And the bubble should change to "saving..."  
And when save succeeds, show "saved!" bubble for 10 seconds  
And the popup window should never appear

**AC2: Authenticated User - Save Error** ✓  
Given I am logged in with valid tokens  
When I click the extension icon and save fails  
Then I should see "loading..." then "saving..." bubbles  
And when error occurs, show "error" bubble for 10 seconds  
And the popup window should never appear

**AC3: Authenticated User - Save Timeout** ✓  
Given I am logged in with valid tokens  
When I click the extension icon and save takes > 2 minutes  
Then I should see "loading..." then "saving..." bubbles  
And after 2 minutes, show "timeout" bubble for 10 seconds  
And the popup window should never appear

**AC4: Unauthenticated User** ✓  
Given I am not logged in  
When I click the extension icon  
Then I should see "loading..." bubble briefly  
And the popup window should open with login flow  
And after I log in, the popup should show "Save Recipe" button  
And recipe should NOT auto-save (manual button click required)

**AC5: Token Refresh During Save** ✓  
Given I am logged in but tokens are expired  
When I click the extension icon  
Then tokens should refresh transparently during "loading..." bubble  
And flow should continue to "saving..." without showing popup  
And save should proceed normally

**Implementation Plan:**

1. **Background/Popup Communication:**
   - Add new message type: `ICON_CLICKED` to check auth silently
   - Popup script checks auth before rendering any UI
   - If authenticated → close popup immediately, trigger background save with bubbles
   - If not authenticated → show login UI

2. **Bubble States & Timing:**
   - `loading` (blue) - shown during auth check (~1-2 seconds)
   - `saving` (blue) - shown during extraction/save (until response or 2 min timeout)
   - `saved` (green) - shown for 10 seconds after success
   - `error` (red) - shown for 10 seconds after error
   - `timeout` (yellow/orange) - shown for 10 seconds after 2-minute timeout

3. **Popup Behavior:**
   - Only open for unauthenticated users
   - Disable auto-save after login (keep manual button)
   - Close popup immediately if user is already authenticated

4. **Files to Modify:**
   - `popup/popup.js` - Silent auth check, conditional UI rendering
   - `background/background.js` - Handle icon click with bubble-based flow
   - `content/content.js` - Add error and timeout bubble variants
   - `popup/popup.css` - Ensure popup can be hidden/closed programmatically

**Success Metrics:**
- Authenticated users never see the popup window
- Clear feedback through bubbles for all states
- Faster perceived performance (no popup flash)
- Better UX for the primary use case (logged-in user saving recipe)