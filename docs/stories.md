# MyKukBuk Chrome Extension User Stories

## V 1.0 Code Organization

### US-0: Extension Backbone
- [x] **As a developer**, I want a working extension backbone that establishes core structure.

**Technical Stories:**
- [x] Create basic manifest.json file with required permissions
- [x] Set up folder structure (popup, background, content scripts)
- [x] Implement modular architecture with clear separation of concerns
- [x] Add basic UI components that render without functionality
- [x] Create placeholder files for all major components
- [x] Establish communication channels between components
- [x] Implement comprehensive error handling and logging
- [x] Follow Chrome extension best practices for performance and security
- [x] Add build scripts

### US-1: Google Authentication
- [x] **As a user**, I want to log in with my Google account so that I can save recipes to my Drive.

**Technical Stories:**
- [x] Implement OAuth 2.0 flow via Chrome Identity API
- [x] Store auth tokens in Chrome's local storage
- [x] Create login/logout UI components
- [x] Handle token refresh for expired tokens

### US-3: Save Current Recipe
- [x] **As a user**, I want to click the extension button on a recipe page to save it.

**Technical Stories:**
- [x] Extract current page HTML via content script
- [x] Cleanup the page: Remove all non-content related information from extracted page (scripts, css, etc.)
- [x] Compress the extracted content
- [x] Set up messaging between popup and content script
- [x] Create visual feedback for save operations
- [x] Implement secure backend communication

### US-4: Extension Settings
- [x] **As a user**, I want to access settings to log out.

**Technical Stories:**
- [x] Create options page with folder management
- [x] Add context menu for quick settings access

### US-5: Visual Feedback
- [x] **As a user**, I want clear feedback on success or failure of save operations.

**Technical Stories:**
- [x] Create status message system in popup
- [ ] Add toast notifications for background operations
- [ ] Implement user-friendly error messages
- [ ] Add loading indicators for async operations

## V 1.1
### US-2: First-time Setup
- [ ] **As a first-time user**, I want to select or create a Google Drive folder for recipe storage.

**Technical Stories:**
- [ ] Build folder selection UI showing available Drive folders
- [ ] Implement Drive API calls to list folders
- [ ] Add functionality to create new folders
- [ ] Store selected folder ID in extension storage

### US-8: Extension Settings
-[ ] **As a user**, I want to access settings to change my storage folder.

**Technical Stories:**
- [ ] Implement folder change functionality
- [ ] Build account management with logout option

## V 1.2 - Performance & Smart Processing

### US-9: Recipe Caching
- **As a user**, I want the system to remember previously processed recipes so I don't waste time re-processing the same content.
- **As a system**, I want to reduce AI processing costs by caching converted recipes.

**Technical Stories:**
- [ ] Create recipe cache table/storage with URL as key and YAML as value
- [ ] Add cache lookup before AI transformation in CookbookController
- [ ] Implement cache hit/miss logging for monitoring
- [ ] Add cache invalidation strategy (TTL, manual refresh)
- [ ] Add cache statistics endpoint for monitoring
- [ ] Consider cache size limits and eviction policies

**Acceptance Criteria:**
- Given a recipe URL that was previously processed
- When the same URL is submitted again
- Then the cached YAML should be returned without AI processing
- And the response time should be significantly faster
- And the response should include a cache indicator

### US-10: Non-Recipe Detection
- **As a user**, I want clear feedback when I try to save a page that isn't a recipe.
- **As a system**, I want to avoid storing non-recipe content to maintain data quality.

**Technical Stories:**
- [ ] Enhance Gemini prompt to detect non-recipe pages
- [ ] Update response DTO to include recipe detection result
- [ ] Modify Drive storage logic to skip non-recipes
- [ ] Add specific error response for non-recipe pages
- [ ] Update frontend to handle non-recipe responses gracefully
- [ ] Add logging for non-recipe detection analytics

**Acceptance Criteria:**
- Given a non-recipe webpage (news article, blog post, etc.)
- When the page is submitted for processing
- Then the system should detect it's not a recipe
- And return `is_recipe: false` without storing to Drive
- And provide helpful feedback to the user

#### API Changes
**Enhanced Recipe Response**
```json
{
  "title": "Recipe Title",
  "url": "https://example.com/recipe",
  "driveFileId": "file123",
  "driveFileUrl": "https://drive.google.com/...",
  "isRecipe": true,
  "fromCache": false,
  "cacheHit": false,
  "processingTime": 1250
}
```

**Non-Recipe Response**
```json
{
  "title": "Page Title",
  "url": "https://example.com/article",
  "isRecipe": false,
  "message": "This page doesn't appear to contain a recipe",
  "suggestions": [
    "Try a different page with recipe content",
    "Check if the page has a dedicated recipe section"
  ]
}
```

### US-11: Smart Extension Click Behavior
- **As a user**, I want the extension to intelligently handle my click based on my current state.
- **As a user**, I want seamless token refresh without manual intervention.

**Technical Stories:**
- [ ] Modify extension icon click handler to check auth state first
- [ ] Implement automatic token refresh before recipe extraction
- [ ] Add token expiry validation with buffer time
- [ ] Create unified authentication flow for icon clicks
- [ ] Add loading states for authentication processes
- [ ] Implement retry logic for failed token refresh

**Acceptance Criteria:**
- Given I click the extension icon while logged out
- When the popup opens
- Then I should see the login flow immediately

- Given I click the extension icon while logged in with valid tokens
- When the popup opens
- Then recipe extraction should start immediately

- Given I click the extension icon while logged in with expired tokens
- When the popup opens
- Then tokens should refresh automatically
- And recipe extraction should proceed seamlessly
- And I should see appropriate loading feedback

### US-15: Right-Click Extension Access
- **As a user**, I want quick access to the extension through right-click for better workflow integration.
- **As a power user**, I want multiple ways to access extension functionality.

**Technical Stories:**
- [ ] Add context menu registration in background script
- [ ] Implement right-click handler to open popup
- [ ] Add context menu items for quick actions (Save Recipe, Settings)
- [ ] Handle popup positioning for context menu triggers
- [ ] Add keyboard shortcuts for accessibility
- [ ] Ensure consistent behavior across different page types

**Acceptance Criteria:**
- Given I'm on any webpage
- When I right-click the extension icon
- Then I should see the same popup interface as left-click
- And context menu should include quick action shortcuts
- And the experience should be consistent across browsers

### US-12: Recipe Conflict Resolution
- **As a user**, I want to know when a recipe URL has been processed before but may have changed.
- **As a user**, I want to choose between using cached version or re-processing.

**Technical Stories:**
- [ ] Add cache metadata (timestamp, version hash)
- [ ] Implement content change detection
- [ ] Create user choice UI for cache conflicts
- [ ] Add "force refresh" option for cache override

### US-14: Intelligent HTML Cleanup
- **As a system**, I want to send only relevant content to the AI to reduce processing costs and improve accuracy.
- **As a user**, I want faster recipe processing through optimized content extraction.

**Technical Stories:**
- [ ] Enhance content cleanup service to remove navigation, ads, headers, footers
- [ ] Implement recipe content detection heuristics (JSON-LD, microdata, common selectors)
- [ ] Add configurable cleanup rules for popular recipe sites
- [ ] Create before/after content size logging for optimization tracking
- [ ] Add fallback to full content if cleanup removes too much
- [ ] Implement whitelist/blacklist for HTML elements and CSS classes

**Acceptance Criteria:**
- Given a recipe page with navigation, ads, and sidebar content
- When the page is processed for AI transformation
- Then only recipe-relevant content should be sent to Gemini
- And the content size should be significantly reduced
- And recipe extraction accuracy should be maintained or improved

## V 1.3 - Enhanced Processing & User Experience

### US-16: Google Drive Management Interface
- **As a user**, I want to see and manage my recipe storage configuration easily.
- **As a user**, I want to know how many recipes I've saved and access them quickly.

**Technical Stories:**
- [ ] Create Drive folder selection UI in extension options
- [ ] Implement Drive API calls to list user's folders
- [ ] Add recipe count API endpoint for specific folders
- [ ] Create folder browser component with search/filter
- [ ] Add "Open in Drive" quick action buttons
- [ ] Implement folder creation from within extension
- [ ] Add storage usage statistics and limits display
- [ ] Create folder change confirmation with migration options

**Acceptance Criteria:**
- Given I'm in extension settings
- When I view Drive configuration
- Then I should see my current folder and recipe count
- And I should be able to change folders with a visual browser
- And clicking the folder/count should open Google Drive in new tab
- And I should see storage statistics and usage

### US-17: Extension Distribution & Packaging
- **As a developer**, I want to package the extension for easy public distribution.
- **As a user**, I want to install the extension easily from official stores.

**Technical Stories:**
- [ ] Create Chrome Web Store listing with screenshots and description
- [ ] Set up automated extension packaging in CI/CD
- [ ] Implement proper version management and release notes
- [ ] Create installation instructions and user documentation
- [ ] Add privacy policy and terms of service
- [ ] Implement extension analytics and error reporting
- [ ] Create Firefox addon version for cross-browser support
- [ ] Add extension auto-update mechanism
- [ ] Create developer documentation for contribution

**Acceptance Criteria:**
- Given a user wants to install the extension
- When they visit the Chrome Web Store
- Then they should find the extension with clear description and screenshots
- And installation should be one-click
- And the extension should auto-update when new versions are available

## Technical Implementation Details

### HTML Cleanup Service Enhancement
```java
@Service
public class IntelligentCleanupService {

    // Recipe content selectors (prioritized)
    private static final String[] RECIPE_SELECTORS = {
        "[itemtype*='Recipe']", // Schema.org microdata
        ".recipe", ".recipe-content",
        "#recipe", "#recipe-content",
        ".entry-content", ".post-content"
    };

    // Elements to remove
    private static final String[] REMOVE_SELECTORS = {
        "nav", "header", "footer", "aside",
        ".navigation", ".menu", ".sidebar",
        ".advertisement", ".ads", ".social-share",
        ".comments", ".related-posts"
    };

    public String intelligentCleanup(String html, String url) {
        Document doc = Jsoup.parse(html);

        // Try to find recipe-specific content first
        Element recipeContent = findRecipeContent(doc);

        if (recipeContent != null) {
            return recipeContent.outerHtml();
        }

        // Fallback to general cleanup
        return performGeneralCleanup(doc);
    }
}
```

### Drive Management API Endpoints
```java
@RestController
@RequestMapping("/api/drive")
public class DriveManagementController {

    @GetMapping("/folders")
    public List<DriveFolder> listFolders(@RequestHeader("Authorization") String token) {
        // Return user's Drive folders with metadata
    }

    @GetMapping("/folders/{folderId}/recipes/count")
    public RecipeCountResponse getRecipeCount(@PathVariable String folderId,
                                             @RequestHeader("Authorization") String token) {
        // Count YAML files in specified folder
    }

    @PostMapping("/folders")
    public DriveFolder createFolder(@RequestBody CreateFolderRequest request,
                                   @RequestHeader("Authorization") String token) {
        // Create new folder for recipes
    }
}
```

### Context Menu Registration
```javascript
// In background.js
chrome.contextMenus.create({
  id: "save-recipe",
  title: "Save Recipe to Drive",
  contexts: ["action"],
  documentUrlPatterns: ["http://*/*", "https://*/*"]
});

chrome.contextMenus.create({
  id: "open-settings",
  title: "Extension Settings",
  contexts: ["action"]
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch(info.menuItemId) {
    case "save-recipe":
      // Trigger recipe save directly
      break;
    case "open-settings":
      chrome.runtime.openOptionsPage();
      break;
  }
});
```

### Extension Manifest Updates
```json
{
  "manifest_version": 3,
  "name": "MyKukBuk - Recipe Saver",
  "version": "1.0.0",
  "description": "Save recipes from any website to your Google Drive as organized YAML files",
  "permissions": [
    "activeTab",
    "storage",
    "identity",
    "contextMenus"
  ],
  "host_permissions": [
    "https://www.googleapis.com/*"
  ],
  "web_accessible_resources": [{
    "resources": ["icons/*"],
    "matches": ["<all_urls>"]
  }],
  "commands": {
    "save-recipe": {
      "suggested_key": {
        "default": "Ctrl+Shift+S"
      },
      "description": "Save current recipe"
    }
  }
}
```

## Configuration Updates

```yaml
cookbook:
  cache:
    enabled: true
    ttl: 7d  # Time to live for cache entries
    max-size: 10000  # Maximum number of cached recipes
    cleanup-interval: 1h  # How often to clean expired entries
  ai:
    skip-on-cache-hit: true
    non-recipe-detection: true
  cleanup:
    intelligent-mode: true
    max-content-size: 50000  # Characters
    preserve-images: true
    recipe-selectors:
      - "[itemtype*='Recipe']"
      - ".recipe"
      - "#recipe"
    remove-selectors:
      - "nav"
      - ".advertisement"
      - ".social-share"
  drive:
    default-folder-name: "MyKukBuk Recipes"
    max-recipes-per-folder: 1000
    enable-statistics: true
```
