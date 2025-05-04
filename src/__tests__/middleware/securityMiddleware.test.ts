/**
 * src/__tests__/middleware/securityMiddleware.test.ts
 * Güvenlik middleware'lerinin testleri
 */
import { Request, Response } from 'express';
import {
  validateContentType,
  nonceMiddleware,
  setupSecurityMiddleware
} from '../../middleware/securityMiddleware';
import { logger } from '../../utils/logger';

// Logger'ı mock'la
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Security Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  
  beforeEach(() => {
    req = {
      method: 'GET',
      headers: {},
      path: '/test',
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      locals: {}
    };
    next = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('validateContentType', () => {
    it('should call next() for GET requests', () => {
      req.method = 'GET';
      
      validateContentType(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should call next() for POST requests with application/json content type', () => {
      req.method = 'POST';
      req.headers['content-type'] = 'application/json';
      
      validateContentType(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should return 415 for POST requests without application/json content type', () => {
      req.method = 'POST';
      req.headers['content-type'] = 'text/plain';
      
      validateContentType(req as Request, res as Response, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Content-Type application/json olmalıdır',
          statusCode: 415
        }
      });
      expect(logger.warn).toHaveBeenCalled();
    });
    
    it('should return 415 for POST requests without content type', () => {
      req.method = 'POST';
      
      validateContentType(req as Request, res as Response, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Content-Type application/json olmalıdır',
          statusCode: 415
        }
      });
      expect(logger.warn).toHaveBeenCalled();
    });
  });
  
  describe('nonceMiddleware', () => {
    it('should generate nonce and add to res.locals', () => {
      nonceMiddleware(req as Request, res as Response, next);
      
      expect(res.locals.nonce).toBeDefined();
      expect(typeof res.locals.nonce).toBe('string');
      expect(next).toHaveBeenCalled();
    });
    
    it('should update CSP header if cspNonce is set', () => {
      res.locals.cspNonce = true;
      res.getHeader = jest.fn().mockReturnValue("script-src 'self' 'nonce-old-nonce'");
      
      nonceMiddleware(req as Request, res as Response, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining(`'nonce-${res.locals.nonce}'`)
      );
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('setupSecurityMiddleware', () => {
    it('should set up security middleware', () => {
      const app = {
        use: jest.fn()
      };
      
      setupSecurityMiddleware(app);
      
      // Helmet ve diğer middleware'ler için app.use çağrıldı mı?
      expect(app.use).toHaveBeenCalledTimes(11);
      expect(logger.info).toHaveBeenCalledWith('Güvenlik middleware\'leri yapılandırıldı');
    });
  });
});
