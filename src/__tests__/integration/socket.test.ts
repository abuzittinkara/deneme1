/**
 * src/__tests__/integration/socket.test.ts
 * Socket.io entegrasyon testleri
 */
import { Server } from 'socket.io';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { setupSocketHandlers } from '../../socket/socketHandler';
import { User } from '../../models/User';
import { Message } from '../../models/Message';
import { Channel } from '../../models/Channel';
import { Group } from '../../models/Group';

// Mock modelleri
jest.mock('../../models/User');
jest.mock('../../models/Message');
jest.mock('../../models/Channel');
jest.mock('../../models/Group');

describe('Socket.io Integration Tests', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let clientSocket: ClientSocket;
  let serverSocket: any;
  let port: number;

  beforeAll((done) => {
    // HTTP sunucusu oluştur
    httpServer = createServer();

    // Socket.io sunucusu oluştur
    io = new Server(httpServer);

    // Socket.io işleyicilerini ayarla
    setupSocketHandlers(io);

    // Sunucuyu başlat
    httpServer.listen(() => {
      port = (httpServer.address() as AddressInfo).port;
      done();
    });

    // Bağlantı olayını dinle
    io.on('connection', (socket) => {
      serverSocket = socket;
    });
  });

  afterAll(() => {
    // Bağlantıları kapat
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  beforeEach((done) => {
    // İstemci soketi oluştur
    clientSocket = ioc(`http://localhost:${port}`, {
      autoConnect: false,
      transports: ['websocket'],
      auth: {
        token: 'test-token',
      },
    });

    // Bağlantıyı aç
    clientSocket.connect();

    // Bağlantı kurulduğunda
    clientSocket.on('connect', () => {
      done();
    });
  });

  afterEach(() => {
    // İstemci soketini kapat
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }

    // Mock'ları temizle
    jest.clearAllMocks();
  });

  describe('Message Events', () => {
    it('should send a message', (done) => {
      // Mock Message.create
      (Message.create as jest.Mock).mockResolvedValue({
        _id: 'message-id',
        content: 'Test message',
        sender: 'user-id',
        channel: 'channel-id',
        createdAt: new Date(),
        save: jest.fn(),
      });

      // Mock Channel.findById
      (Channel.findById as jest.Mock).mockResolvedValue({
        _id: 'channel-id',
        name: 'test-channel',
        group: 'group-id',
        type: 'text',
        save: jest.fn(),
      });

      // Mock Group.findById
      (Group.findById as jest.Mock).mockResolvedValue({
        _id: 'group-id',
        name: 'test-group',
        members: ['user-id'],
        save: jest.fn(),
      });

      // Mesaj gönderme olayını dinle
      clientSocket.on('newMessage', (data) => {
        expect(data).toEqual({
          messageId: 'message-id',
          content: 'Test message',
          sender: 'user-id',
          channel: 'channel-id',
          createdAt: expect.any(String),
        });
        done();
      });

      // Mesaj gönder
      clientSocket.emit('sendMessage', {
        content: 'Test message',
        channelId: 'channel-id',
      });
    });
  });

  describe('Channel Events', () => {
    it('should join a channel', (done) => {
      // Mock Channel.findById
      (Channel.findById as jest.Mock).mockResolvedValue({
        _id: 'channel-id',
        name: 'test-channel',
        group: 'group-id',
        type: 'text',
        save: jest.fn(),
      });

      // Mock Group.findById
      (Group.findById as jest.Mock).mockResolvedValue({
        _id: 'group-id',
        name: 'test-group',
        members: ['user-id'],
        save: jest.fn(),
      });

      // Kanala katılma olayını dinle
      clientSocket.on('joinedChannel', (data) => {
        expect(data).toEqual({
          channelId: 'channel-id',
          userId: 'user-id',
        });
        done();
      });

      // Kanala katıl
      clientSocket.emit('joinChannel', {
        channelId: 'channel-id',
      });
    });
  });

  describe('Voice Channel Events', () => {
    it('should join a voice channel', (done) => {
      // Mock Channel.findById
      (Channel.findById as jest.Mock).mockResolvedValue({
        _id: 'voice-channel-id',
        name: 'test-voice-channel',
        group: 'group-id',
        type: 'voice',
        save: jest.fn(),
      });

      // Mock Group.findById
      (Group.findById as jest.Mock).mockResolvedValue({
        _id: 'group-id',
        name: 'test-group',
        members: ['user-id'],
        save: jest.fn(),
      });

      // Ses kanalına katılma olayını dinle
      clientSocket.on('userJoinedVoice', (data) => {
        expect(data).toEqual({
          channelId: 'voice-channel-id',
          userId: 'user-id',
          username: 'test-user',
        });
        done();
      });

      // Ses kanalına katıl
      clientSocket.emit('joinVoiceChannel', {
        channelId: 'voice-channel-id',
        groupId: 'group-id',
      });
    });
  });

  describe('Screen Share Events', () => {
    it('should start screen sharing', (done) => {
      // Ekran paylaşımı başlatma olayını dinle
      clientSocket.on('screenShareStarted', (data) => {
        expect(data).toEqual({
          userId: 'user-id',
          producerId: 'producer-id',
        });
        done();
      });

      // Ekran paylaşımı başlat
      clientSocket.emit('screenShareStarted', {
        producerId: 'producer-id',
      });
    });
  });
});
