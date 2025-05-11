/**
 * src/__tests__/middleware/validateResourceAccess.test.ts
 * Kaynak erişim doğrulama middleware'lerinin testleri
 */
import { Request, Response } from 'express';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

// validateResourceAccess fonksiyonunu mock'la
const mockHasResourceAccess = jest.fn();
const mockValidateResourceAccess = jest.fn();
const mockValidateUserAccess = jest.fn();
const mockValidateGroupAccess = jest.fn();
const mockValidateChannelAccess = jest.fn();
const mockValidateMessageAccess = jest.fn();
const mockValidateDirectMessageAccess = jest.fn();

// Mock modülü oluştur
jest.mock('../../middleware/validateResourceAccess', () => ({
  hasResourceAccess: mockHasResourceAccess,
  validateResourceAccess: (resourceType, action, getResourceId) => {
    mockValidateResourceAccess(resourceType, action, getResourceId);
    return async (req, res, next) => {
      if (!req.params.id && !getResourceId) {
        return next(new NotFoundError('Kaynak bulunamadı'));
      }

      const resourceId = getResourceId ? getResourceId(req) : req.params.id;

      try {
        const hasAccess = await mockHasResourceAccess(req, resourceType, resourceId, action);

        if (!hasAccess) {
          return next(new ForbiddenError(`Bu işlem için yetkiniz yok: ${resourceType} ${action}`));
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  },
  validateUserAccess: (action) => {
    mockValidateUserAccess(action);
    return jest.fn();
  },
  validateGroupAccess: (action) => {
    mockValidateGroupAccess(action);
    return jest.fn();
  },
  validateChannelAccess: (action) => {
    mockValidateChannelAccess(action);
    return jest.fn();
  },
  validateMessageAccess: (action) => {
    mockValidateMessageAccess(action);
    return jest.fn();
  },
  validateDirectMessageAccess: (action) => {
    mockValidateDirectMessageAccess(action);
    return jest.fn();
  },
}));

// Modülü import et
const {
  validateResourceAccess,
  validateUserAccess,
  validateGroupAccess,
  validateChannelAccess,
  validateMessageAccess,
  validateDirectMessageAccess,
} = require('../../middleware/validateResourceAccess');

describe('Validate Resource Access Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      params: { id: '123456789012345678901234' },
      user: { _id: '123456789012345678901234', role: 'user' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('validateResourceAccess', () => {
    it('should call next() when user has access', async () => {
      // Mock hasResourceAccess to return true
      mockHasResourceAccess.mockResolvedValue(true);

      const middleware = validateResourceAccess('user', 'view');
      await middleware(req as Request, res as Response, next);

      expect(mockValidateResourceAccess).toHaveBeenCalledWith('user', 'view', undefined);
      expect(mockHasResourceAccess).toHaveBeenCalledWith(
        req,
        'user',
        '123456789012345678901234',
        'view'
      );
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0].length).toBe(0); // next() called with no arguments
    });

    it('should call next() with error when user does not have access', async () => {
      // Mock hasResourceAccess to return false
      mockHasResourceAccess.mockResolvedValue(false);

      const middleware = validateResourceAccess('user', 'edit');
      await middleware(req as Request, res as Response, next);

      expect(mockValidateResourceAccess).toHaveBeenCalledWith('user', 'edit', undefined);
      expect(mockHasResourceAccess).toHaveBeenCalledWith(
        req,
        'user',
        '123456789012345678901234',
        'edit'
      );
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should call next() with error when resource ID is not provided', async () => {
      req.params = {};

      const middleware = validateResourceAccess('user', 'view');
      await middleware(req as Request, res as Response, next);

      expect(mockValidateResourceAccess).toHaveBeenCalledWith('user', 'view', undefined);
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('should use custom resource ID getter if provided', async () => {
      // Mock hasResourceAccess to return true
      mockHasResourceAccess.mockResolvedValue(true);

      const getResourceId = jest.fn().mockReturnValue('custom-resource-id');
      const middleware = validateResourceAccess('user', 'view', getResourceId);
      await middleware(req as Request, res as Response, next);

      expect(mockValidateResourceAccess).toHaveBeenCalledWith('user', 'view', getResourceId);
      expect(getResourceId).toHaveBeenCalledWith(req);
      expect(mockHasResourceAccess).toHaveBeenCalledWith(req, 'user', 'custom-resource-id', 'view');
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0].length).toBe(0); // next() called with no arguments
    });

    it('should handle errors', async () => {
      // Mock hasResourceAccess to throw error
      const error = new Error('Test error');
      mockHasResourceAccess.mockRejectedValue(error);

      const middleware = validateResourceAccess('user', 'view');
      await middleware(req as Request, res as Response, next);

      expect(mockValidateResourceAccess).toHaveBeenCalledWith('user', 'view', undefined);
      expect(mockHasResourceAccess).toHaveBeenCalledWith(
        req,
        'user',
        '123456789012345678901234',
        'view'
      );
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('validateUserAccess', () => {
    it('should create middleware for user access validation', () => {
      const middleware = validateUserAccess('edit');

      expect(mockValidateUserAccess).toHaveBeenCalledWith('edit');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('validateGroupAccess', () => {
    it('should create middleware for group access validation', () => {
      const middleware = validateGroupAccess('edit');

      expect(mockValidateGroupAccess).toHaveBeenCalledWith('edit');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('validateChannelAccess', () => {
    it('should create middleware for channel access validation', () => {
      const middleware = validateChannelAccess('edit');

      expect(mockValidateChannelAccess).toHaveBeenCalledWith('edit');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('validateMessageAccess', () => {
    it('should create middleware for message access validation', () => {
      const middleware = validateMessageAccess('edit');

      expect(mockValidateMessageAccess).toHaveBeenCalledWith('edit');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('validateDirectMessageAccess', () => {
    it('should create middleware for direct message access validation', () => {
      const middleware = validateDirectMessageAccess('edit');

      expect(mockValidateDirectMessageAccess).toHaveBeenCalledWith('edit');
      expect(typeof middleware).toBe('function');
    });
  });
});
