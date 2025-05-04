/**
 * src/__tests__/middleware/auth.test.ts
 * Kimlik doğrulama middleware'i için testler
 */
import { Request, Response, NextFunction } from 'express';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth';
import * as jwt from '../../config/jwt';

// JWT modülünü mockla
jest.mock('../../config/jwt', () => ({
  verifyToken: jest.fn()
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  
  beforeEach(() => {
    // Her test öncesi mock nesneleri sıfırla
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('authenticateJWT', () => {
    it('should pass if valid token is provided', () => {
      // Geçerli bir token için mock ayarla
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      
      // verifyToken fonksiyonunu mockla
      (jwt.verifyToken as jest.Mock).mockReturnValue({
        sub: 'user-id',
        username: 'testuser',
        role: 'user'
      });
      
      // Middleware'i çağır
      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);
      
      // Beklenen davranışı kontrol et
      expect(jwt.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual({
        sub: 'user-id',
        username: 'testuser',
        role: 'user'
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should return 401 if no token is provided', () => {
      // Token olmadan çağır
      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);
      
      // Beklenen davranışı kontrol et
      expect(jwt.verifyToken).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Kimlik doğrulama başarısız: Token bulunamadı',
        code: 'UNAUTHORIZED'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
    
    it('should return 401 if token is invalid', () => {
      // Geçersiz bir token için mock ayarla
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };
      
      // verifyToken fonksiyonunu null döndürecek şekilde mockla
      (jwt.verifyToken as jest.Mock).mockReturnValue(null);
      
      // Middleware'i çağır
      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);
      
      // Beklenen davranışı kontrol et
      expect(jwt.verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Kimlik doğrulama başarısız: Geçersiz token',
        code: 'UNAUTHORIZED'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
  
  describe('authorizeRoles', () => {
    it('should pass if user has required role', () => {
      // Kullanıcı bilgisini ayarla
      mockRequest.user = {
        sub: 'user-id',
        username: 'testuser',
        role: 'admin'
      };
      
      // Middleware'i çağır
      const middleware = authorizeRoles(['admin', 'moderator']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      
      // Beklenen davranışı kontrol et
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
    
    it('should return 403 if user does not have required role', () => {
      // Kullanıcı bilgisini ayarla
      mockRequest.user = {
        sub: 'user-id',
        username: 'testuser',
        role: 'user'
      };
      
      // Middleware'i çağır
      const middleware = authorizeRoles(['admin', 'moderator']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      
      // Beklenen davranışı kontrol et
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bu işlemi gerçekleştirmek için yetkiniz yok',
        code: 'FORBIDDEN'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
    
    it('should return 401 if user is not authenticated', () => {
      // Kullanıcı bilgisi yok
      mockRequest.user = undefined;
      
      // Middleware'i çağır
      const middleware = authorizeRoles(['admin']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      
      // Beklenen davranışı kontrol et
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Kimlik doğrulama başarısız: Kullanıcı bilgisi bulunamadı',
        code: 'UNAUTHORIZED'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
