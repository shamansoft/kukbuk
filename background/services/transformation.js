// Transformation service for MyKukbuk

import { logError } from '../../common/error-handler.js';

/**
 * Sets up the transformation service
 */
export function setupTransformation() {
  console.log('Setting up transformation service');
}

/**
 * Transforms page content by applying various transformations
 * @param {string} html - Raw HTML content
 * @returns {string} Transformed HTML content
 */
export function transformContent(html) {
  try {
    if (!html) {
      return html;
    }
    console.log("transformContent html size", html.length);
    // Apply the basic cleanup transformation
//    let transformedHtml = removeNonContentElements(html);

    // Additional transformations can be added here by chaining
    // transformedHtml = someOtherTransformation(transformedHtml);
    console.log("transformContent transformedHtml size", transformedHtml.length);
    console.log("transformContent diff", html.length - transformedHtml.length);
    return transformedHtml;
  } catch (error) {
    logError('Content transformation error', error);
    // Return original content on error
    return html;
  }
}

/**
 * Removes non-content elements from HTML (scripts, styles, etc.)
 * @param {string} html - HTML content
 * @returns {string} Cleaned HTML content
 */
function removeNonContentElements(html) {
  try {
    console.log("removeNonContentElements html size", html.length);
    // Use DOMParser to parse HTML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // ONLY remove these definitely non-content elements
    const elementsToRemove = [
      'script',         // JavaScript
      'style',          // CSS
      'noscript',       // No-JS fallback
      'iframe',         // Embedded frames
      'svg',            // Vector graphics
      'canvas',         // Drawing canvas
      'template'        // Template elements
    ];

    // Remove elements
    elementsToRemove.forEach(tag => {
      const elements = doc.querySelectorAll(tag);
      elements.forEach(el => {
        try {
          el.parentNode?.removeChild(el);
        } catch (e) {
          // Ignore errors
        }
      });
    });

    // Serialize back to HTML string
    const result = new XMLSerializer().serializeToString(doc);
    console.log("doc size after cleanup", result.length);
    console.log("doc size diff", html.length - result.length);
    return result;
  } catch (error) {
    logError('HTML cleanup error', error);
    // On any error, return the original HTML
    return html;
  }
}

/**
 * Additional transformation placeholder
 * @param {string} html - HTML content
 * @returns {string} Transformed HTML content
 */
function additionalTransformation(html) {
  // Implement additional transformation here
  return html;
}