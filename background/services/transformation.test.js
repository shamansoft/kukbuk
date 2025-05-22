/**
 * @jest-environment jsdom
 */

import { mockConsole } from '../../test/testHelpers';
import { setupTransformation, transformContent } from './transformation';

// Mock dependencies
jest.mock('../../common/error-handler.js', () => ({
  logError: jest.fn(),
}));

describe('Transformation Service', () => {
  let consoleLogSpy;
  let originalBlob;
  let originalTextEncoder;
  let originalResponse;
  let originalCompressionStream;
  let originalFileReader;

  beforeEach(() => {
    // Mock console
    consoleLogSpy = mockConsole();

    // Store originals
    originalBlob = global.Blob;
    originalTextEncoder = global.TextEncoder;
    originalResponse = global.Response;
    originalCompressionStream = global.CompressionStream;
    originalFileReader = global.FileReader;

    // Mock TextEncoder
    global.TextEncoder = function() {
      return {
        encode: jest.fn(() => new Uint8Array([1, 2, 3]))
      };
    };

    // Mock Blob with stream method
    global.Blob = function(content) {
      return {
        stream: jest.fn(() => ({
          pipeThrough: jest.fn(() => 'compressed-stream')
        })),
        size: content[0].length
      };
    };

    // Mock Response
    global.Response = function(stream) {
      return {
        blob: jest.fn(() => Promise.resolve('compressed-blob'))
      };
    };

    // Mock CompressionStream
    global.CompressionStream = function(format) {
      return {
        format: format
      };
    };

    // Mock FileReader
    global.FileReader = function() {
      const reader = {};
      
      reader.readAsDataURL = jest.fn(blob => {
        setTimeout(() => {
          reader.result = 'data:application/octet-stream;base64,bW9jay1jb21wcmVzc2VkLWNvbnRlbnQ=';
          if (reader.onloadend) reader.onloadend();
        }, 10);
      });
      
      return reader;
    };
  });

  afterEach(() => {
    // Restore originals
    global.Blob = originalBlob;
    global.TextEncoder = originalTextEncoder;
    global.Response = originalResponse;
    global.CompressionStream = originalCompressionStream;
    global.FileReader = originalFileReader;
    
    jest.restoreAllMocks();
  });

  describe('setupTransformation', () => {
    it('should log setup message', () => {
      setupTransformation();
      expect(consoleLogSpy).toHaveBeenCalledWith('Setting up transformation service');
    });
  });

  describe('transformContent', () => {
    it('should return the original content if input is empty', async () => {
      const result = await transformContent('');
      expect(result).toBe('');
    });

    it('should transform content and return compression result', async () => {
      const html = '<div>Test content</div>';
      
      const result = await transformContent(html);
      
      expect(result).toEqual({
        original: html,
        transformed: 'bW9jay1jb21wcmVzc2VkLWNvbnRlbnQ=',
        success: true,
        isCompressed: true
      });
      
      // Verify that console logs have been called
      expect(consoleLogSpy).toHaveBeenCalledWith('transformContent html size', html.length);
    });

    it('should handle errors during transformation', async () => {
      // Force an error
      global.TextEncoder = function() {
        throw new Error('TextEncoder failed');
      };
      
      const html = '<div>Test content</div>';
      
      const result = await transformContent(html);
      
      // Should return original content with error flags
      expect(result).toEqual({
        original: html,
        transformed: html,
        success: false,
        isCompressed: false
      });
    });

    it('should handle null content gracefully', async () => {
      const result = await transformContent(null);
      expect(result).toBe(null);
    });
  });
});