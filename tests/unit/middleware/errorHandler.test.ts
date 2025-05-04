/**
 * tests/unit/middleware/errorHandler.test.ts
 * Hata işleyici middleware için birim testleri
 */
import { Request, Response, NextFunction } from 'express';
import { errorHandler, AppError } from '../../../src/middleware/errorHandler';
import { logger, logError } from '../../../src/utils/logger';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
  logError: jest.fn(),
  httpLogger: {
    log: jest.fn(),
  },
}));

describe('Error Handler Middleware', () => {
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
      user: {
        id: 'test-user-id',
        username: 'testuser',
        role: 'user',
        sub: 'test-user-id',
      },
      query: { q: 'test' },
      body: { data: 'test' },
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

    // Geliştirme modunu ayarla
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    // Test ortamını temizle
    process.env.NODE_ENV = 'test';
  });

  it('should handle AppError correctly', () => {
    // AppError oluştur
    const appError = new AppError('Test error', 400, 'TEST_ERROR');

    // Middleware'i çağır
    errorHandler(appError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Test error',
      code: 'TEST_ERROR',
    }));
  });

  it('should handle ValidationError correctly', () => {
    // ValidationError oluştur
    const validationError: any = new Error('Validation failed');
    validationError.name = 'ValidationError';
    validationError.errors = [
      { param: 'username', msg: 'Username is required', value: '' },
      { param: 'email', msg: 'Invalid email', value: 'invalid' },
    ];

    // Middleware'i çağır
    errorHandler(validationError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('username'),
    }));
  });

  it('should handle MongoError correctly', () => {
    // MongoError oluştur
    const mongoError: any = new Error('Duplicate key error');
    mongoError.name = 'MongoError';
    mongoError.code = 11000;
    mongoError.keyValue = { username: 'testuser' };

    // Middleware'i çağır
    errorHandler(mongoError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(409);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'DUPLICATE_ERROR',
      message: expect.stringContaining('username'),
    }));
  });

  it('should handle JsonWebTokenError correctly', () => {
    // JsonWebTokenError oluştur
    const jwtError: any = new Error('Invalid token');
    jwtError.name = 'JsonWebTokenError';

    // Middleware'i çağır
    errorHandler(jwtError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(401);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Geçersiz token',
    }));
  });

  it('should handle TokenExpiredError correctly', () => {
    // TokenExpiredError oluştur
    const tokenError: any = new Error('Token expired');
    tokenError.name = 'TokenExpiredError';

    // Middleware'i çağır
    errorHandler(tokenError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(401);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'TOKEN_EXPIRED',
      message: 'Token süresi doldu',
    }));
  });

  it('should handle CastError correctly', () => {
    // CastError oluştur
    const castError: any = new Error('Cast to ObjectId failed');
    castError.name = 'CastError';
    castError.kind = 'ObjectId';
    castError.value = 'invalid-id';

    // Middleware'i çağır
    errorHandler(castError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'INVALID_ID',
      message: expect.stringContaining('invalid-id'),
    }));
  });

  it('should handle SyntaxError correctly', () => {
    // SyntaxError oluştur
    const syntaxError: any = new Error('Unexpected token in JSON');
    syntaxError.name = 'SyntaxError';
    syntaxError.message = 'Unexpected token in JSON at position 0';

    // Middleware'i çağır
    errorHandler(syntaxError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'INVALID_JSON',
      message: 'Geçersiz JSON formatı',
    }));
  });

  it('should handle connection errors correctly', () => {
    // Connection error oluştur
    const connError: any = new Error('Connection refused');
    connError.code = 'ECONNREFUSED';

    // Middleware'i çağır
    errorHandler(connError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(503);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Servis şu anda kullanılamıyor',
    }));
  });

  it('should handle unknown errors correctly', () => {
    // Bilinmeyen hata oluştur
    const unknownError = new Error('Unknown error');

    // Middleware'i çağır
    errorHandler(unknownError, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Unknown error',
      code: 'INTERNAL_SERVER_ERROR',
    }));
  });

  it('should include stack trace in development mode', () => {
    // Hata oluştur
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at Test.test (/test.js:1:1)';

    // Middleware'i çağır
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      stack: error.stack,
    }));
  });

  it('should not include stack trace in production mode', () => {
    // Üretim modunu ayarla
    process.env.NODE_ENV = 'production';

    // Hata oluştur
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at Test.test (/test.js:1:1)';

    // Middleware'i çağır
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(jsonSpy).toHaveBeenCalledWith(expect.not.objectContaining({
      stack: error.stack,
    }));
  });

  it('should log operational errors with less detail', () => {
    // Operasyonel hata oluştur
    const error = new AppError('Test error', 400, 'TEST_ERROR');
    error.isOperational = true;

    // Middleware'i çağır
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    // Doğrulama
    expect(logger.warn).toHaveBeenCalled();
  });
});
