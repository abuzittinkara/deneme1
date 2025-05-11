import { Server } from 'socket.io';
import { createServer } from 'http';

describe('Socket Handler Tests', () => {
  let io;
  let httpServer;

  beforeAll(() => {
    httpServer = createServer();
    io = new Server(httpServer);
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  test('Socket server should initialize successfully', () => {
    expect(io).toBeDefined();
    expect(io.sockets).toBeDefined();
  });

  test('Socket server should handle connections', (done) => {
    io.on('connection', (socket) => {
      expect(socket).toBeDefined();
      done();
    });

    const clientSocket = require('socket.io-client')('http://localhost:3000');
    clientSocket.on('connect', () => {
      clientSocket.close();
    });
  });
});
