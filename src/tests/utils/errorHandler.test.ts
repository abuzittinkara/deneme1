/**
 * src/tests/utils/errorHandler.test.ts
 * Hata işleyici testleri
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../../utils/errorHandler';
import { ValidationError } from '../../utils/errors';

describe('Error Handler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusStub: sinon.SinonStub;
  let jsonStub: sinon.SinonStub;
  
  beforeEach(() => {
    jsonStub = sinon.stub();
    statusStub = sinon.stub().returns({ json: jsonStub });
    
    req = {
      path: '/test',
      method: 'GET'
    };
    
    res = {
      status: statusStub
    };
    
    next = sinon.stub() as unknown as NextFunction;
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('should handle ValidationError correctly', () => {
    const error = new ValidationError('Validation failed', { field: 'Invalid value' });
    
    errorHandler(error, req as Request, res as Response, next);
    
    expect(statusStub.calledWith(400)).to.be.true;
    expect(jsonStub.calledOnce).to.be.true;
    
    const response = jsonStub.firstCall.args[0];
    expect(response.success).to.be.false;
    expect(response.error.message).to.equal('Validation failed');
    expect(response.error.statusCode).to.equal(400);
    expect(response.error.details).to.deep.equal({ field: 'Invalid value' });
  });
  
  it('should handle NotFoundHandler correctly', () => {
    notFoundHandler(req as Request, res as Response, next);
    
    expect(next.calledOnce).to.be.true;
    const error = next.firstCall.args[0];
    expect(error.statusCode).to.equal(404);
    expect(error.message).to.include('/test');
  });
  
  it('should include stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at TestFunction';
    
    errorHandler(error, req as Request, res as Response, next);
    
    const response = jsonStub.firstCall.args[0];
    expect(response.error.stack).to.include('Error: Test error');
    
    process.env.NODE_ENV = originalEnv;
  });
  
  it('should not include stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at TestFunction';
    
    errorHandler(error, req as Request, res as Response, next);
    
    const response = jsonStub.firstCall.args[0];
    expect(response.error.stack).to.be.undefined;
    
    process.env.NODE_ENV = originalEnv;
  });
});
