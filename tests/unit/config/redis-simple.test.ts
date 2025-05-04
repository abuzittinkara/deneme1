/**
 * tests/unit/config/redis-simple.test.ts
 * Redis bağlantısı için basitleştirilmiş birim testleri
 */
import { RedisConnectionState } from '../../../src/config/redis';

describe('Redis Connection State', () => {
  it('should have all required connection states', () => {
    expect(RedisConnectionState.CONNECTING).toBe('connecting');
    expect(RedisConnectionState.CONNECTED).toBe('connected');
    expect(RedisConnectionState.DISCONNECTED).toBe('disconnected');
    expect(RedisConnectionState.RECONNECTING).toBe('reconnecting');
    expect(RedisConnectionState.ERROR).toBe('error');
    expect(RedisConnectionState.READY).toBe('ready');
  });
});
