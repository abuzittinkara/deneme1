/**
 * src/__tests__/middleware/authMiddleware.test.ts
 * Kimlik doğrulama middleware'i için birim testleri
 */
import { Request, Response, NextFunction } from 'express';
import { 
  requireAuth, 
  requireAdmin, 
  requireModerator, 
  requireRole, 
  requireActiveStatus,
  validateUserFromDatabase,
  UserRole,
  UserStatus,
  verifyToken,
  AuthError
} from '../../middleware/authMiddleware';
import { User } from '../../models/User';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Mock env değişkenleri
jest.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret'
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock User model
jest.mock('../../models/User', () => ({
  User: {
    findById: jest.fn()
  }
}));

// Mock mongoose
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  Types: {
    ObjectId: {
      isValid: jest.fn()
    }
  }
}));

describe('Auth Middleware', () => {
  // Mock request, response ve next
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock<NextFunction>;
  
  beforeEach(() => {
    req = {
      headers: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Mock process.env
    process.env.NODE_ENV = 'production';
    process.env.SKIP_AUTH = 'false';
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      // Geçerli token oluştur
      const payload = {
        id: '123456789',
        username: 'testuser',
        role: 'user',
        sub: '123456789'
      };
      
      const token = jwt.sign(payload, 'test-jwt-secret');
      
      // Token'ı doğrula
      const result = await verifyToken(token);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(payload.id);
      expect(result.username).toBe(payload.username);
      expect(result.role).toBe(payload.role);
    });
    
    it('should throw AuthError for invalid token', async () => {
      await expect(verifyToken('invalid-token')).rejects.toThrow(AuthError);
    });
    
    it('should throw AuthError for expired token', async () => {
      // Süresi dolmuş token oluştur
      const payload = {
        id: '123456789',
        username: 'testuser',
        role: 'user',
        sub: '123456789',
        exp: Math.floor(Date.now() / 1000) - 10 // 10 saniye önce süresi dolmuş
      };
      
      const token = jwt.sign(payload, 'test-jwt-secret', { expiresIn: -10 });
      
      await expect(verifyToken(token)).rejects.toThrow(AuthError);
    });
    
    it('should throw AuthError for token with missing fields', async () => {
      // Eksik alanlara sahip token oluştur
      const payload = {
        id: '123456789',
        // username eksik
        role: 'user',
        sub: '123456789'
      };
      
      const token = jwt.sign(payload, 'test-jwt-secret');
      
      await expect(verifyToken(token)).rejects.toThrow(AuthError);
    });
  });
  
  describe('requireAuth', () => {
    it('should call next() for valid token', async () => {
      // Geçerli token oluştur
      const payload = {
        id: '123456789',
        username: 'testuser',
        role: 'user',
        sub: '123456789'
      };
      
      const token = jwt.sign(payload, 'test-jwt-secret');
      
      // Authorization header'ı ayarla
      req.headers = {
        authorization: `Bearer ${token}`
      };
      
      // Middleware'i çağır
      await requireAuth(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrıldığını kontrol et
      expect(next).toHaveBeenCalled();
      
      // req.user'ın ayarlandığını kontrol et
      expect((req as any).user).toBeDefined();
      expect((req as any).user.id).toBe(payload.id);
      expect((req as any).user.username).toBe(payload.username);
      expect((req as any).user.role).toBe(payload.role);
    });
    
    it('should return 401 for missing token', async () => {
      // Authorization header'ı yok
      req.headers = {};
      
      // Middleware'i çağır
      await requireAuth(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 401 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
          code: 'UNAUTHORIZED'
        })
      }));
    });
    
    it('should return 401 for invalid token', async () => {
      // Geçersiz token
      req.headers = {
        authorization: 'Bearer invalid-token'
      };
      
      // Middleware'i çağır
      await requireAuth(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 401 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
          code: expect.any(String)
        })
      }));
    });
    
    it('should skip auth in test environment', async () => {
      // Test ortamını ayarla
      process.env.NODE_ENV = 'test';
      
      // Geçerli test token'ı
      req.headers = {
        authorization: 'Bearer test-token'
      };
      
      // Middleware'i çağır
      await requireAuth(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrıldığını kontrol et
      expect(next).toHaveBeenCalled();
      
      // req.user'ın ayarlandığını kontrol et
      expect((req as any).user).toBeDefined();
      expect((req as any).user.role).toBe(UserRole.USER);
      expect((req as any).user.status).toBe(UserStatus.ACTIVE);
    });
    
    it('should skip auth in development environment with SKIP_AUTH=true', async () => {
      // Geliştirme ortamını ayarla
      process.env.NODE_ENV = 'development';
      process.env.SKIP_AUTH = 'true';
      
      // Middleware'i çağır
      await requireAuth(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrıldığını kontrol et
      expect(next).toHaveBeenCalled();
      
      // req.user'ın ayarlandığını kontrol et
      expect((req as any).user).toBeDefined();
      expect((req as any).user.role).toBe(UserRole.ADMIN); // Geliştirme için admin rolü
    });
  });
  
  describe('requireRole', () => {
    beforeEach(() => {
      // req.user'ı ayarla
      (req as any).user = {
        id: '123456789',
        username: 'testuser',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sub: '123456789'
      };
    });
    
    it('should call next() for user with required role', async () => {
      // USER rolü gerektiren middleware
      const middleware = requireRole(UserRole.USER);
      
      // Middleware'i çağır
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrıldığını kontrol et
      expect(next).toHaveBeenCalled();
    });
    
    it('should call next() for user with one of required roles', async () => {
      // USER veya MODERATOR rolü gerektiren middleware
      const middleware = requireRole([UserRole.USER, UserRole.MODERATOR]);
      
      // Middleware'i çağır
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrıldığını kontrol et
      expect(next).toHaveBeenCalled();
    });
    
    it('should return 403 for user without required role', async () => {
      // ADMIN rolü gerektiren middleware
      const middleware = requireRole(UserRole.ADMIN);
      
      // Middleware'i çağır
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 403 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
          code: 'FORBIDDEN'
        })
      }));
    });
    
    it('should return 401 for missing user', async () => {
      // req.user'ı kaldır
      delete (req as any).user;
      
      // USER rolü gerektiren middleware
      const middleware = requireRole(UserRole.USER);
      
      // Middleware'i çağır
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 401 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
  
  describe('requireAdmin', () => {
    it('should call requireRole with ADMIN role', async () => {
      // requireRole'ü mock'la
      const mockRequireRole = jest.fn().mockReturnValue(() => {});
      jest.spyOn(require('../../middleware/authMiddleware'), 'requireRole').mockImplementation(mockRequireRole);
      
      // requireAdmin'i çağır
      requireAdmin();
      
      // requireRole'ün ADMIN rolü ile çağrıldığını kontrol et
      expect(mockRequireRole).toHaveBeenCalledWith(UserRole.ADMIN);
    });
  });
  
  describe('requireModerator', () => {
    it('should call requireRole with ADMIN and MODERATOR roles', async () => {
      // requireRole'ü mock'la
      const mockRequireRole = jest.fn().mockReturnValue(() => {});
      jest.spyOn(require('../../middleware/authMiddleware'), 'requireRole').mockImplementation(mockRequireRole);
      
      // requireModerator'ı çağır
      requireModerator();
      
      // requireRole'ün ADMIN ve MODERATOR rolleri ile çağrıldığını kontrol et
      expect(mockRequireRole).toHaveBeenCalledWith([UserRole.ADMIN, UserRole.MODERATOR]);
    });
  });
  
  describe('requireActiveStatus', () => {
    beforeEach(() => {
      // req.user'ı ayarla
      (req as any).user = {
        id: '123456789',
        username: 'testuser',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sub: '123456789'
      };
    });
    
    it('should call next() for user with active status', async () => {
      // Middleware'i çağır
      const middleware = requireActiveStatus();
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrıldığını kontrol et
      expect(next).toHaveBeenCalled();
    });
    
    it('should return 403 for user with inactive status', async () => {
      // Kullanıcı durumunu inactive olarak ayarla
      (req as any).user.status = UserStatus.INACTIVE;
      
      // Middleware'i çağır
      const middleware = requireActiveStatus();
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 403 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
          code: 'ACCOUNT_INACTIVE'
        })
      }));
    });
    
    it('should return 401 for missing user', async () => {
      // req.user'ı kaldır
      delete (req as any).user;
      
      // Middleware'i çağır
      const middleware = requireActiveStatus();
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 401 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
  
  describe('validateUserFromDatabase', () => {
    beforeEach(() => {
      // req.user'ı ayarla
      (req as any).user = {
        id: '507f1f77bcf86cd799439011', // Geçerli ObjectId formatı
        username: 'testuser',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sub: '507f1f77bcf86cd799439011'
      };
      
      // mongoose.Types.ObjectId.isValid mock'ını ayarla
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);
      
      // User.findById mock'ını ayarla
      (User.findById as jest.Mock).mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        select: jest.fn().mockReturnThis()
      });
    });
    
    it('should call next() for valid user in database', async () => {
      // Middleware'i çağır
      const middleware = validateUserFromDatabase();
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrıldığını kontrol et
      expect(next).toHaveBeenCalled();
      
      // User.findById'nin çağrıldığını kontrol et
      expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
    
    it('should return 401 for user not found in database', async () => {
      // User.findById mock'ını null döndürecek şekilde ayarla
      (User.findById as jest.Mock).mockResolvedValue(null);
      
      // Middleware'i çağır
      const middleware = validateUserFromDatabase();
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 401 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
          code: 'USER_NOT_FOUND'
        })
      }));
    });
    
    it('should return 401 for invalid user ID format', async () => {
      // mongoose.Types.ObjectId.isValid mock'ını false döndürecek şekilde ayarla
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(false);
      
      // Middleware'i çağır
      const middleware = validateUserFromDatabase();
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 401 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(401);
    });
    
    it('should return 403 for inactive user in database', async () => {
      // User.findById mock'ını inactive kullanıcı döndürecek şekilde ayarla
      (User.findById as jest.Mock).mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        role: UserRole.USER,
        status: UserStatus.INACTIVE,
        select: jest.fn().mockReturnThis()
      });
      
      // Middleware'i çağır
      const middleware = validateUserFromDatabase();
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrılmadığını kontrol et
      expect(next).not.toHaveBeenCalled();
      
      // 403 yanıtının döndüğünü kontrol et
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
          code: 'ACCOUNT_INACTIVE'
        })
      }));
    });
    
    it('should update req.user with database values', async () => {
      // User.findById mock'ını farklı rol döndürecek şekilde ayarla
      (User.findById as jest.Mock).mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        role: UserRole.ADMIN, // Farklı rol
        status: UserStatus.ACTIVE,
        select: jest.fn().mockReturnThis()
      });
      
      // Middleware'i çağır
      const middleware = validateUserFromDatabase();
      await middleware(req as Request, res as Response, next);
      
      // next() fonksiyonunun çağrıldığını kontrol et
      expect(next).toHaveBeenCalled();
      
      // req.user'ın güncellendiğini kontrol et
      expect((req as any).user.role).toBe(UserRole.ADMIN);
    });
  });
});
