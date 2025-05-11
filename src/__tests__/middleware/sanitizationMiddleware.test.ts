/**
 * src/__tests__/middleware/sanitizationMiddleware.test.ts
 * Sanitizasyon middleware'lerinin testleri
 */
import { Request, Response } from 'express';
import {
  sanitizeRequestBody,
  sanitizeRequestQuery,
  sanitizeRequestParams,
  sanitizeRequest,
} from '../../middleware/sanitizationMiddleware';
import * as sanitizer from '../../utils/sanitizer';

// Sanitizer modülünü mock'la
jest.mock('../../utils/sanitizer', () => ({
  sanitizeAll: jest.fn((input) => (input ? input.replace(/<script>.*?<\/script>/g, '') : '')),
  sanitizeXss: jest.fn((input) => (input ? input.replace(/<script>.*?<\/script>/g, '') : '')),
  sanitizeUrl: jest.fn((input) => {
    if (!input) return '';
    if (input.startsWith('javascript:')) return '';
    return input;
  }),
}));

describe('Sanitization Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
    };
    res = {};
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('sanitizeRequestBody', () => {
    it('should sanitize request body', () => {
      req.body = {
        name: 'Test <script>alert("XSS");</script>',
        email: 'test@example.com',
        url: 'https://example.com',
        nested: {
          content: '<script>alert("Nested XSS");</script>',
        },
      };

      // Mock fonksiyonlarını özelleştir
      (sanitizer.sanitizeAll as jest.Mock).mockImplementation((input) => {
        if (input === 'Test <script>alert("XSS");</script>') return 'Test alert("XSS");';
        return input;
      });

      (sanitizer.sanitizeXss as jest.Mock).mockImplementation((input) => {
        if (input === '<script>alert("Nested XSS");</script>') return 'alert("Nested XSS");';
        return input;
      });

      sanitizeRequestBody(req as Request, res as Response, next);

      expect(req.body.name).toBe('Test alert("XSS");');
      expect(req.body.email).toBe('test@example.com');
      expect(req.body.url).toBe('https://example.com');
      expect(req.body.nested.content).toBe('alert("Nested XSS");');
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty body', () => {
      req.body = undefined;

      sanitizeRequestBody(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeRequestQuery', () => {
    it('should sanitize request query', () => {
      req.query = {
        search: 'Test <script>alert("XSS");</script>',
        page: '1',
        url: 'javascript:alert("XSS")',
      };

      // Mock fonksiyonlarını özelleştir
      (sanitizer.sanitizeAll as jest.Mock).mockImplementation((input) => {
        if (input === 'Test <script>alert("XSS");</script>') return 'Test alert("XSS");';
        return input;
      });

      (sanitizer.sanitizeUrl as jest.Mock).mockImplementation((input) => {
        if (input === 'javascript:alert("XSS")') return '';
        return input;
      });

      sanitizeRequestQuery(req as Request, res as Response, next);

      expect(req.query.search).toBe('Test alert("XSS");');
      expect(req.query.page).toBe('1');
      expect(req.query.url).toBe('');
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty query', () => {
      req.query = undefined;

      sanitizeRequestQuery(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeRequestParams', () => {
    it('should sanitize request params', () => {
      req.params = {
        id: 'Test <script>alert("XSS");</script>',
        slug: 'test-slug',
      };

      // Mock fonksiyonlarını özelleştir
      (sanitizer.sanitizeAll as jest.Mock).mockImplementation((input) => {
        if (input === 'Test <script>alert("XSS");</script>') return 'Test alert("XSS");';
        return input;
      });

      sanitizeRequestParams(req as Request, res as Response, next);

      expect(req.params.id).toBe('Test alert("XSS");');
      expect(req.params.slug).toBe('test-slug');
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty params', () => {
      req.params = undefined;

      sanitizeRequestParams(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeRequest', () => {
    it('should sanitize request body, query and params', () => {
      req.body = {
        name: 'Test <script>alert("XSS");</script>',
      };
      req.query = {
        search: 'Test <script>alert("XSS");</script>',
      };
      req.params = {
        id: 'Test <script>alert("XSS");</script>',
      };

      // Mock fonksiyonlarını özelleştir
      (sanitizer.sanitizeAll as jest.Mock).mockImplementation((input) => {
        if (input === 'Test <script>alert("XSS");</script>') return 'Test alert("XSS");';
        return input;
      });

      sanitizeRequest(req as Request, res as Response, next);

      expect(req.body.name).toBe('Test alert("XSS");');
      expect(req.query.search).toBe('Test alert("XSS");');
      expect(req.params.id).toBe('Test alert("XSS");');
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty request', () => {
      req.body = undefined;
      req.query = undefined;
      req.params = undefined;

      sanitizeRequest(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
