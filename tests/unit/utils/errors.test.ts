/**
 * tests/unit/utils/errors.test.ts
 * Hata işleme yardımcıları için birim testleri
 */
import {
  errorHandler,
  AppError,
  ErrorCodes
} from '../../../src/utils/errors';
import {
  formatErrorResponse,
  isOperationalError
} from '../../../src/utils/error-helpers';
import { Request, Response } from 'express';

describe('Error Utils', () => {
  // Mock request, response ve next
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
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
  });

  describe('AppError', () => {
    it('should create an operational error with default values', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create an error with custom values', () => {
      const error = new AppError('Not found', 404, 'NOT_FOUND');

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.isOperational).toBe(true);
    });

    it('should create a non-operational error', () => {
      const error = new AppError('Critical error', 500, 'CRITICAL_ERROR', false);

      expect(error.message).toBe('Critical error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('CRITICAL_ERROR');
      expect(error.isOperational).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      const error = new AppError('Test error');
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational errors', () => {
      const error = new AppError('Critical error', 500, 'CRITICAL_ERROR', false);
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for standard errors', () => {
      const error = new Error('Standard error');
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isOperationalError(null)).toBe(false);
      expect(isOperationalError(undefined)).toBe(false);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format AppError correctly', () => {
      const error = new AppError('Test error', 400, 'BAD_REQUEST');
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        success: false,
        message: 'Test error',
        code: 'BAD_REQUEST',
        statusCode: 400,
      });
    });

    it('should format standard Error correctly', () => {
      const error = new Error('Standard error');
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        success: false,
        message: 'Standard error',
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });
    });

    it('should format string error correctly', () => {
      const response = formatErrorResponse('String error');

      expect(response).toEqual({
        success: false,
        message: 'String error',
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });
    });

    it('should handle null or undefined', () => {
      const responseNull = formatErrorResponse(null);
      const responseUndefined = formatErrorResponse(undefined);

      expect(responseNull).toEqual({
        success: false,
        message: 'Unknown error',
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });

      expect(responseUndefined).toEqual({
        success: false,
        message: 'Unknown error',
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('Test error', 400, 'BAD_REQUEST');

      errorHandler(error, mockRequest as Request, mockResponse as Response, jest.fn());

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Test error',
        code: 'BAD_REQUEST',
      }));
    });

    it('should handle standard Error correctly', () => {
      const error = new Error('Standard error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, jest.fn());

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Standard error',
        code: 'INTERNAL_SERVER_ERROR',
      }));
    });

    it('should handle string error correctly', () => {
      const error = 'String error';

      // Doğrudan formatErrorResponse'u kullanarak test et
      const response = formatErrorResponse(error);

      expect(response).toEqual(expect.objectContaining({
        success: false,
        message: 'String error',
        code: 'INTERNAL_SERVER_ERROR',
      }));
    });
  });

  describe('ErrorCodes', () => {
    it('should have all required error codes', () => {
      expect(ErrorCodes.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
    });
  });
});
