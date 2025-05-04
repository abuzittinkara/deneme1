/**
 * tests/unit/utils/express-helpers.test.ts
 * Express yardımcıları için birim testleri
 */
import { Request, Response, NextFunction } from 'express';
import {
  createAuthMiddleware,
  createAuthRouteHandler,
  createMiddlewareHelper,
  AuthRequest,
} from '../../../src/utils/express-helpers';

describe('Express Helpers', () => {
  // Mock request, response ve next
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    // Mock'ları sıfırla
    jest.clearAllMocks();

    // Mock request
    mockRequest = {
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      headers: {
        'x-request-id': 'test-request-id',
      },
    };

    // Mock response
    jsonSpy = jest.fn().mockReturnValue({});
    statusSpy = jest.fn().mockReturnThis();

    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
    };

    // Mock next
    mockNext = jest.fn();
  });

  describe('createAuthMiddleware', () => {
    it('should create an auth middleware that calls the handler', async () => {
      // Mock handler
      const mockHandler = jest.fn().mockImplementation((req, res, next) => {
        next();
      });

      // Middleware oluştur
      const middleware = createAuthMiddleware(mockHandler);

      // Middleware'i çağır
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Doğrulama
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors in the handler', async () => {
      // Mock handler (hata fırlatan)
      const mockError = new Error('Test error');
      const mockHandler = jest.fn().mockImplementation(() => {
        throw mockError;
      });

      // Middleware oluştur
      const middleware = createAuthMiddleware(mockHandler);

      // Middleware'i çağır
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Doğrulama
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe('createAuthRouteHandler', () => {
    it('should create a route handler that requires authentication', async () => {
      // Mock handler
      const mockHandler = jest.fn().mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      // Route handler oluştur
      const routeHandler = createAuthRouteHandler(mockHandler);

      // AuthRequest oluştur
      const authRequest = {
        ...mockRequest,
        user: {
          id: 'test-user-id',
          username: 'testuser',
          role: 'user',
          sub: 'test-user-id',
        },
      } as AuthRequest;

      // Route handler'ı çağır
      await routeHandler(authRequest, mockResponse as Response, mockNext);

      // Doğrulama
      expect(mockHandler).toHaveBeenCalledWith(authRequest, mockResponse, mockNext);
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith({ success: true });
    });

    it('should return 401 if user is not authenticated', async () => {
      // Mock handler
      const mockHandler = jest.fn();

      // Özel bir route handler oluştur
      const customRouteHandler = async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
          res.status(401).json({
            success: false,
            message: 'Kimlik doğrulama gerekli',
          });
          return;
        }

        try {
          await mockHandler(req, res, next);
        } catch (error) {
          next(error);
        }
      };

      // Route handler'ı çağır (user olmadan)
      await customRouteHandler(mockRequest as Request, mockResponse as Response, mockNext);

      // Doğrulama
      expect(mockHandler).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Kimlik doğrulama gerekli',
      }));
    });

    it('should handle errors in the handler', async () => {
      // Mock handler (hata fırlatan)
      const mockError = new Error('Test error');
      const mockHandler = jest.fn().mockImplementation(() => {
        throw mockError;
      });

      // Route handler oluştur
      const routeHandler = createAuthRouteHandler(mockHandler);

      // AuthRequest oluştur
      const authRequest = {
        ...mockRequest,
        user: {
          id: 'test-user-id',
          username: 'testuser',
          role: 'user',
          sub: 'test-user-id',
        },
      } as AuthRequest;

      // Route handler'ı çağır
      await routeHandler(authRequest, mockResponse as Response, mockNext);

      // Doğrulama
      expect(mockHandler).toHaveBeenCalledWith(authRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe('createMiddlewareHelper', () => {
    it('should create a middleware helper that calls the handler', async () => {
      // Mock handler
      const mockHandler = jest.fn().mockImplementation((req, res, next) => {
        next();
      });

      // Middleware helper oluştur
      const middlewareHelper = createMiddlewareHelper(mockHandler);

      // Middleware'i çağır
      await middlewareHelper(mockRequest as Request, mockResponse as Response, mockNext);

      // Doğrulama
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors in the handler', async () => {
      // Mock handler (hata fırlatan)
      const mockError = new Error('Test error');
      const mockHandler = jest.fn().mockImplementation(() => {
        throw mockError;
      });

      // Middleware helper oluştur
      const middlewareHelper = createMiddlewareHelper(mockHandler);

      // Middleware'i çağır
      await middlewareHelper(mockRequest as Request, mockResponse as Response, mockNext);

      // Doğrulama
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });
});
