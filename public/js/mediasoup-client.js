// Mediasoup Client
// Global mediasoupClient değişkenini kullan

class MediasoupHandler {
  constructor(socket) {
    this.socket = socket;
    this.device = null;
    this.roomId = null;
    this.producerTransport = null;
    this.consumerTransport = null;
    this.producers = new Map();
    this.consumers = new Map();
    this.isProducing = false;
    this.isConsuming = false;
    this.localStream = null;
    this.onNewConsumer = null;
    this.onConsumerClosed = null;
    this.onPeerJoined = null;
    this.onPeerLeft = null;
  }

  // Mediasoup cihazını yükle
  async loadDevice(roomId) {
    try {
      this.roomId = roomId;

      // RTP yeteneklerini al
      const { rtpCapabilities } = await this.sendRequest('mediasoup:join-room', { roomId });

      // Mediasoup cihazını oluştur
      this.device = new mediasoupClient.Device();

      // Cihazı yükle
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });

      console.log('Mediasoup cihazı yüklendi');

      return true;
    } catch (error) {
      console.error('Mediasoup cihazı yüklenirken hata oluştu:', error);
      return false;
    }
  }

  // Medya akışını başlat
  async startMedia() {
    try {
      // Kullanıcı medya akışını al
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // Producer transport oluştur
      await this.createProducerTransport();

      // Consumer transport oluştur
      await this.createConsumerTransport();

      // Ses üreticisi oluştur
      const audioTrack = this.localStream.getAudioTracks()[0];

      if (audioTrack) {
        await this.produceAudio(audioTrack);
      }

      return true;
    } catch (error) {
      console.error('Medya akışı başlatılırken hata oluştu:', error);
      return false;
    }
  }

  // Producer transport oluştur
  async createProducerTransport() {
    try {
      // Transport oluştur
      const { transportId, params } = await this.sendRequest('mediasoup:create-transport', {
        roomId: this.roomId,
        direction: 'send'
      });

      // Transport oluştur
      this.producerTransport = this.device.createSendTransport(params);

      // Transport olaylarını dinle
      this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Transport'u bağla
          await this.sendRequest('mediasoup:connect-transport', {
            roomId: this.roomId,
            transportId,
            dtlsParameters
          });

          callback();
        } catch (error) {
          errback(error);
        }
      });

      this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          // Producer oluştur
          const { producerId } = await this.sendRequest('mediasoup:produce', {
            roomId: this.roomId,
            transportId,
            kind,
            rtpParameters
          });

          callback({ id: producerId });
        } catch (error) {
          errback(error);
        }
      });

      this.producerTransport.on('connectionstatechange', (state) => {
        console.log('Producer transport bağlantı durumu:', state);

        if (state === 'closed' || state === 'failed' || state === 'disconnected') {
          this.producerTransport.close();
          this.producers.forEach((producer) => producer.close());
          this.producers.clear();
        }
      });

      console.log('Producer transport oluşturuldu');

      return true;
    } catch (error) {
      console.error('Producer transport oluşturulurken hata oluştu:', error);
      return false;
    }
  }

  // Consumer transport oluştur
  async createConsumerTransport() {
    try {
      // Transport oluştur
      const { transportId, params } = await this.sendRequest('mediasoup:create-transport', {
        roomId: this.roomId,
        direction: 'recv'
      });

      // Transport oluştur
      this.consumerTransport = this.device.createRecvTransport(params);

      // Transport olaylarını dinle
      this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Transport'u bağla
          await this.sendRequest('mediasoup:connect-transport', {
            roomId: this.roomId,
            transportId,
            dtlsParameters
          });

          callback();
        } catch (error) {
          errback(error);
        }
      });

      this.consumerTransport.on('connectionstatechange', (state) => {
        console.log('Consumer transport bağlantı durumu:', state);

        if (state === 'closed' || state === 'failed' || state === 'disconnected') {
          this.consumerTransport.close();
          this.consumers.forEach((consumer) => consumer.close());
          this.consumers.clear();
        }
      });

      console.log('Consumer transport oluşturuldu');

      // Socket olaylarını dinle
      this.socket.on('mediasoup:new-producer', async ({ producerId, peerId, kind }) => {
        await this.consume(producerId, peerId, kind);
      });

      this.socket.on('mediasoup:peer-joined', ({ peerId, username }) => {
        console.log(`Kullanıcı odaya katıldı: ${username}`);

        if (this.onPeerJoined) {
          this.onPeerJoined(peerId, username);
        }
      });

      this.socket.on('mediasoup:peer-left', ({ peerId }) => {
        console.log(`Kullanıcı odadan ayrıldı: ${peerId}`);

        // Kullanıcının consumer'larını kapat
        this.consumers.forEach((consumer) => {
          if (consumer.appData.peerId === peerId) {
            consumer.close();
            this.consumers.delete(consumer.id);

            if (this.onConsumerClosed) {
              this.onConsumerClosed(consumer.id, peerId);
            }
          }
        });

        if (this.onPeerLeft) {
          this.onPeerLeft(peerId);
        }
      });

      return true;
    } catch (error) {
      console.error('Consumer transport oluşturulurken hata oluştu:', error);
      return false;
    }
  }

  // Ses üret
  async produceAudio(audioTrack) {
    try {
      if (!this.producerTransport) {
        throw new Error('Producer transport oluşturulmadı');
      }

      // Ses üreticisi oluştur
      const producer = await this.producerTransport.produce({
        track: audioTrack,
        codecOptions: {
          opusStereo: true,
          opusDtx: true,
          opusFec: true,
          opusNack: true
        }
      });

      // Producer olaylarını dinle
      producer.on('transportclose', () => {
        producer.close();
        this.producers.delete(producer.id);
      });

      producer.on('trackended', () => {
        producer.close();
        this.producers.delete(producer.id);
      });

      // Producer'ı sakla
      this.producers.set(producer.id, producer);
      this.isProducing = true;

      console.log('Ses üreticisi oluşturuldu');

      return producer;
    } catch (error) {
      console.error('Ses üretilirken hata oluştu:', error);
      return null;
    }
  }

  // Ses tüket
  async consume(producerId, peerId, kind) {
    try {
      if (!this.consumerTransport) {
        throw new Error('Consumer transport oluşturulmadı');
      }

      // RTP yeteneklerini kontrol et
      if (!this.device.canConsume({
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      })) {
        throw new Error('RTP yetenekleri uyumsuz');
      }

      // Consumer oluştur
      const { consumerId, producerId: remoteProducerId, rtpParameters, kind: consumerKind } = await this.sendRequest('mediasoup:consume', {
        roomId: this.roomId,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      });

      // Consumer oluştur
      const consumer = await this.consumerTransport.consume({
        id: consumerId,
        producerId: remoteProducerId,
        kind: consumerKind,
        rtpParameters,
        appData: { peerId }
      });

      // Consumer olaylarını dinle
      consumer.on('transportclose', () => {
        consumer.close();
        this.consumers.delete(consumer.id);
      });

      // Consumer'ı sakla
      this.consumers.set(consumer.id, consumer);
      this.isConsuming = true;

      // Consumer'ı başlat
      await this.sendRequest('mediasoup:resume-consumer', {
        roomId: this.roomId,
        consumerId
      });

      console.log(`${kind} consumer oluşturuldu`);

      // Callback'i çağır
      if (this.onNewConsumer) {
        this.onNewConsumer(consumer, peerId);
      }

      return consumer;
    } catch (error) {
      console.error('Consumer oluşturulurken hata oluştu:', error);
      return null;
    }
  }

  // Odadan ayrıl
  async leaveRoom() {
    try {
      // Odadan ayrıl
      await this.sendRequest('mediasoup:leave-room', { roomId: this.roomId });

      // Producer'ları kapat
      this.producers.forEach((producer) => producer.close());
      this.producers.clear();

      // Consumer'ları kapat
      this.consumers.forEach((consumer) => consumer.close());
      this.consumers.clear();

      // Transport'ları kapat
      if (this.producerTransport) {
        this.producerTransport.close();
        this.producerTransport = null;
      }

      if (this.consumerTransport) {
        this.consumerTransport.close();
        this.consumerTransport = null;
      }

      // Medya akışını kapat
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }

      this.isProducing = false;
      this.isConsuming = false;
      this.roomId = null;

      console.log('Odadan ayrıldı');

      return true;
    } catch (error) {
      console.error('Odadan ayrılırken hata oluştu:', error);
      return false;
    }
  }

  // Socket.IO isteği gönder
  sendRequest(event, data) {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, data, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }
}

export default MediasoupHandler;
