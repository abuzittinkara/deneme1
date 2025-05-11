// ... Jest ve mock örneği ...
import { configureSocketServer } from '../socketManager';

describe('Socket Manager', () => {
  it('should handle new socket connection', () => {
    const mockSocket = { id: 'test-socket', on: jest.fn(), emit: jest.fn() };
    const mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    configureSocketServer(mockSocket as any, mockIo as any);
    expect(mockSocket.on).toHaveBeenCalled();
  });
});
