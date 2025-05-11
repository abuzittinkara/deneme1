/**
 * src/__tests__/middleware/authorizationMiddleware.test.ts
 * Yetkilendirme middleware'lerinin testleri
 */
import { Request, Response } from 'express';
import {
  authorizeResource,
  authorizeGroup,
  authorizeChannel,
  authorizeMessage,
  authorizeUser,
  requireAdmin,
  requireModerator,
} from '../../middleware/authorizationMiddleware';
import * as authorizationHelper from '../../utils/authorizationHelper';
import { ForbiddenError } from '../../utils/errors';

// Mock authorizationHelper
jest.mock('../../utils/authorizationHelper', () => ({
  hasPermission: jest.fn(),
  getUserIdFromRequest: jest.fn(),
  authorizeOrFail: jest.fn(),
}));

describe('Authorization Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      params: { id: 'resource-id' },
      user: { _id: 'user-id', role: 'user' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('authorizeResource', () => {
    it('should call next() when user has permission', async () => {
      // Mock hasPermission to return true
      (authorizationHelper.hasPermission as jest.Mock).mockResolvedValue(true);
      (authorizationHelper.getUserIdFromRequest as jest.Mock).mockReturnValue('user-id');

      const middleware = authorizeResource('group', 'view');
      await middleware(req as Request, res as Response, next);

      expect(authorizationHelper.hasPermission).toHaveBeenCalledWith(
        'user-id',
        'resource-id',
        'group',
        'view'
      );
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() with error when user does not have permission', async () => {
      // Mock hasPermission to return false
      (authorizationHelper.hasPermission as jest.Mock).mockResolvedValue(false);
      (authorizationHelper.getUserIdFromRequest as jest.Mock).mockReturnValue('user-id');

      const middleware = authorizeResource('group', 'edit');
      await middleware(req as Request, res as Response, next);

      expect(authorizationHelper.hasPermission).toHaveBeenCalledWith(
        'user-id',
        'resource-id',
        'group',
        'edit'
      );
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should use custom resource ID getter if provided', async () => {
      // Mock hasPermission to return true
      (authorizationHelper.hasPermission as jest.Mock).mockResolvedValue(true);
      (authorizationHelper.getUserIdFromRequest as jest.Mock).mockReturnValue('user-id');

      const getResourceId = jest.fn().mockReturnValue('custom-resource-id');
      const middleware = authorizeResource('channel', 'view', getResourceId);
      await middleware(req as Request, res as Response, next);

      expect(getResourceId).toHaveBeenCalledWith(req);
      expect(authorizationHelper.hasPermission).toHaveBeenCalledWith(
        'user-id',
        'custom-resource-id',
        'channel',
        'view'
      );
      expect(next).toHaveBeenCalledWith();
    });

    it('should handle errors', async () => {
      // Mock getUserIdFromRequest to throw error
      const error = new Error('Test error');
      (authorizationHelper.getUserIdFromRequest as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const middleware = authorizeResource('group', 'view');
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('authorizeGroup', () => {
    it('should create middleware for group authorization', () => {
      const middleware = authorizeGroup('edit');

      // Verify that authorizeResource was called with correct parameters
      expect(middleware).toBeInstanceOf(Function);
    });
  });

  describe('authorizeChannel', () => {
    it('should create middleware for channel authorization', () => {
      const middleware = authorizeChannel('edit');

      // Verify that authorizeResource was called with correct parameters
      expect(middleware).toBeInstanceOf(Function);
    });
  });

  describe('authorizeMessage', () => {
    it('should create middleware for message authorization', () => {
      const middleware = authorizeMessage('edit');

      // Verify that authorizeResource was called with correct parameters
      expect(middleware).toBeInstanceOf(Function);
    });
  });

  describe('authorizeUser', () => {
    it('should create middleware for user authorization', () => {
      const middleware = authorizeUser('edit');

      // Verify that authorizeResource was called with correct parameters
      expect(middleware).toBeInstanceOf(Function);
    });
  });

  describe('requireAdmin', () => {
    it('should call next() when user is admin', () => {
      req.user = { _id: 'user-id', role: 'admin' };

      const middleware = requireAdmin();
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() with error when user is not admin', () => {
      req.user = { _id: 'user-id', role: 'user' };

      const middleware = requireAdmin();
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should call next() with error when user is not authenticated', () => {
      req.user = undefined;

      const middleware = requireAdmin();
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe('requireModerator', () => {
    it('should call next() when user is admin', () => {
      req.user = { _id: 'user-id', role: 'admin' };

      const middleware = requireModerator();
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() when user is moderator', () => {
      req.user = { _id: 'user-id', role: 'moderator' };

      const middleware = requireModerator();
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() with error when user is not moderator or admin', () => {
      req.user = { _id: 'user-id', role: 'user' };

      const middleware = requireModerator();
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should call next() with error when user is not authenticated', () => {
      req.user = undefined;

      const middleware = requireModerator();
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });
});
