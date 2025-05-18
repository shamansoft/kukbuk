// Transformation service for MyKukbuk

import { logError } from "../../common/error-handler.js";

/**
 * Sets up the transformation service
 */
export function setupTransformation() {
  console.log("Setting up transformation service");
}

/**
 * Transforms page content by applying various transformations
 * @param {string} html - Raw HTML content
 * @returns {Promise<Object>} Transformed HTML content or compressed content object
 */
export async function transformContent(html) {
  try {
    if (!html) {
      return html;
    }
    console.log("transformContent html size", html.length);
    // Apply the basic cleanup transformation
    const compressed = await compressHtml(html);

    // Additional transformations can be added here by chaining
    // transformedHtml = someOtherTransformation(transformedHtml);
    console.log("transformContent transformedHtml size", compressed.length);
    console.log("transformContent diff", html.length - compressed.length);
    return {
      original: html,
      transformed: compressed,
      success: true,
      isCompressed: true,
    };
  } catch (error) {
    logError("Content transformation error", error);
    // Return original content on error
    return {
      original: html,
      transformed: html,
      success: false,
      isCompressed: false,
    };
  }
}

/**
 * Compresses HTML content using GZIP and converts to Base64
 * @param {string} htmlContent - HTML content to compress
 * @returns {Promise<string>} Base64 encoded compressed content
 */
async function compressHtml(htmlContent) {
  // Convert to UTF-8 string
  const encoder = new TextEncoder();
  const data = encoder.encode(htmlContent);

  // Compress using CompressionStream (GZIP)
  const compressedStream = new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"));

  // Convert compressed stream to Blob
  const compressedBlob = await new Response(compressedStream).blob();

  // Convert Blob to Base64
  const base64 = await blobToBase64(compressedBlob);

  console.log(`Original size: ${htmlContent.length} bytes`);
  console.log(`Compressed size: ${base64.length} bytes`);
  console.log(`Data size saving: ${((1 - base64.length / htmlContent.length) * 100).toFixed(2)}%`);

  return base64;
}

/**
 * Helper function to convert Blob to Base64
 * @param {Blob} blob - Blob to convert
 * @returns {Promise<string>} Base64 string
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove the "data:application/octet-stream;base64," part
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
