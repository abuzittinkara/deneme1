import { createWorker } from 'mediasoup';

describe('Mediasoup Worker Tests', () => {
  let worker;

  beforeAll(async () => {
    worker = await createWorker();
  });

  afterAll(async () => {
    await worker.close();
  });

  test('Worker should be created successfully', () => {
    expect(worker).toBeDefined();
    expect(worker.pid).toBeGreaterThan(0);
  });

  test('Worker should close without errors', async () => {
    await expect(worker.close()).resolves.not.toThrow();
  });
});
