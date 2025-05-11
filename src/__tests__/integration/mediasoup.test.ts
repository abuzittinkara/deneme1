/**
 * src/__tests__/integration/mediasoup.test.ts
 * Mediasoup entegrasyon testleri
 */
import { Server } from 'socket.io';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { User } from '../../models/User';
import { Channel } from '../../models/Channel';
import { Group } from '../../models/Group';

// Mock modüller
jest.mock('mediasoup', () => {
  return {
    createWorker: jest.fn().mockResolvedValue({
      appData: {},
      closed: false,
      died: false,
      observer: {
        on: jest.fn(),
        once: jest.fn(),
      },
      on: jest.fn(),
      once: jest.fn(),
      close: jest.fn(),
      dump: jest.fn().mockResolvedValue({}),
      getResourceUsage: jest.fn().mockResolvedValue({}),
      updateSettings: jest.fn(),
      createRouter: jest.fn().mockResolvedValue({
        appData: {},
        closed: false,
        observer: {
          on: jest.fn(),
          once: jest.fn(),
        },
        id: 'router-id',
        on: jest.fn(),
        once: jest.fn(),
        close: jest.fn(),
        dump: jest.fn().mockResolvedValue({}),
        createWebRtcTransport: jest.fn().mockResolvedValue({
          appData: {},
          closed: false,
          observer: {
            on: jest.fn(),
            once: jest.fn(),
          },
          id: 'transport-id',
          on: jest.fn(),
          once: jest.fn(),
          close: jest.fn(),
          dump: jest.fn().mockResolvedValue({}),
          getStats: jest.fn().mockResolvedValue({}),
          connect: jest.fn(),
          setMaxIncomingBitrate: jest.fn(),
          setMaxOutgoingBitrate: jest.fn(),
          produce: jest.fn().mockResolvedValue({
            appData: {},
            closed: false,
            observer: {
              on: jest.fn(),
              once: jest.fn(),
            },
            id: 'producer-id',
            kind: 'audio',
            on: jest.fn(),
            once: jest.fn(),
            close: jest.fn(),
            dump: jest.fn().mockResolvedValue({}),
            getStats: jest.fn().mockResolvedValue({}),
            pause: jest.fn(),
            resume: jest.fn(),
          }),
          consume: jest.fn().mockResolvedValue({
            appData: {},
            closed: false,
            observer: {
              on: jest.fn(),
              once: jest.fn(),
            },
            id: 'consumer-id',
            kind: 'audio',
            on: jest.fn(),
            once: jest.fn(),
            close: jest.fn(),
            dump: jest.fn().mockResolvedValue({}),
            getStats: jest.fn().mockResolvedValue({}),
            pause: jest.fn(),
            resume: jest.fn(),
          }),
        }),
        createPlainTransport: jest.fn().mockResolvedValue({}),
        createPipeTransport: jest.fn().mockResolvedValue({}),
        createDirectTransport: jest.fn().mockResolvedValue({}),
        pipeToRouter: jest.fn().mockResolvedValue({}),
        canConsume: jest.fn().mockReturnValue(true),
      }),
    }),
  };
});

// Mock modelleri
jest.mock('../../models/User');
jest.mock('../../models/Channel');
jest.mock('../../models/Group');

// Mediasoup işleyicilerini içe aktar
import { setupMediasoupHandlers } from '../../socket/mediasoupHandler';

describe('Mediasoup Integration Tests', () => {
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

    // Mediasoup işleyicilerini ayarla
    setupMediasoupHandlers(io);

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

  describe('WebRTC Transport Events', () => {
    it('should create WebRTC transport', (done) => {
      // WebRTC transport oluşturma olayını dinle
      clientSocket.on('transportCreated', (data) => {
        expect(data).toEqual({
          transportId: 'transport-id',
          iceParameters: expect.any(Object),
          iceCandidates: expect.any(Array),
          dtlsParameters: expect.any(Object),
        });
        done();
      });

      // WebRTC transport oluştur
      clientSocket.emit('createTransport', {
        direction: 'send',
      });
    });
  });

  describe('Producer Events', () => {
    it('should create producer', (done) => {
      // Producer oluşturma olayını dinle
      clientSocket.on('producerCreated', (data) => {
        expect(data).toEqual({
          producerId: 'producer-id',
        });
        done();
      });

      // Producer oluştur
      clientSocket.emit('createProducer', {
        transportId: 'transport-id',
        kind: 'audio',
        rtpParameters: {},
      });
    });
  });

  describe('Consumer Events', () => {
    it('should create consumer', (done) => {
      // Consumer oluşturma olayını dinle
      clientSocket.on('consumerCreated', (data) => {
        expect(data).toEqual({
          consumerId: 'consumer-id',
          producerId: 'producer-id',
          kind: 'audio',
          rtpParameters: expect.any(Object),
        });
        done();
      });

      // Consumer oluştur
      clientSocket.emit('createConsumer', {
        transportId: 'transport-id',
        producerId: 'producer-id',
      });
    });
  });
});
