import { transformContent } from '../background/services/transformation.js';

describe('Transformation Service', () => {
  describe('transformContent', () => {
    it('should return original content when no HTML is provided', async () => {
      const result = await transformContent();
      expect(result).toEqual({
        original: undefined,
        transformed: undefined,
        success: true,
        isCompressed: false,
      });
    });

    it('should compress HTML content', async () => {
      const html = '<html><body><h1>Hello World</h1></body></html>';
      const result = await transformContent(html);
      
      expect(result.original).toBe(html);
      expect(result.transformed).toBeDefined();
      expect(result.transformed.length).toBeLessThan(html.length);
      expect(result.success).toBe(true);
      expect(result.isCompressed).toBe(true);
    });

    it('should handle compression errors', async () => {
      // Make a spy on compressHtml and make it throw an error
      jest.spyOn(TransformationService, 'compressHtml').mockImplementationOnce(() => {
        throw new Error('Compression failed');
      });

      const html = '<html><body><h1>Hello World</h1></body></html>';
      const result = await transformContent(html);
      
      expect(result).toEqual({
        original: html,
        transformed: html,
        success: false,
        isCompressed: false,
      });
    });
  });
});
