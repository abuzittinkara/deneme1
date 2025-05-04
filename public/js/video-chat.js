// Video Chat Handler
class VideoChatHandler {
  constructor(mediasoupHandler) {
    this.mediasoupHandler = mediasoupHandler;
    this.isVideoEnabled = false;
    this.videoProducer = null;
    this.videoStream = null;
    this.onVideoStarted = null;
    this.onVideoStopped = null;
    this.onVideoError = null;
  }

  // Video iletişimini başlat
  async startVideo() {
    try {
      if (this.isVideoEnabled) {
        throw new Error('Video zaten etkin');
      }
      
      if (!this.mediasoupHandler || !this.mediasoupHandler.producerTransport) {
        throw new Error('Mediasoup bağlantısı kurulmadı');
      }
      
      // Video için medya akışını al
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        },
        audio: false // Ses için ayrı bir producer kullanılıyor
      });
      
      // Video producer'ı oluştur
      const videoTrack = this.videoStream.getVideoTracks()[0];
      
      // Producer oluştur
      this.videoProducer = await this.mediasoupHandler.producerTransport.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 300000, scaleResolutionDownBy: 2 },
          { maxBitrate: 600000, scaleResolutionDownBy: 1 }
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000
        },
        appData: {
          videoChat: true
        }
      });
      
      // Producer olaylarını dinle
      this.videoProducer.on('transportclose', () => {
        this.stopVideo();
      });
      
      this.videoProducer.on('trackended', () => {
        this.stopVideo();
      });
      
      this.isVideoEnabled = true;
      
      // Callback'i çağır
      if (this.onVideoStarted) {
        this.onVideoStarted(this.videoProducer, this.videoStream);
      }
      
      return this.videoProducer;
    } catch (error) {
      console.error('Video iletişimi başlatılırken hata oluştu:', error);
      
      // Medya akışını temizle
      if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop());
        this.videoStream = null;
      }
      
      // Callback'i çağır
      if (this.onVideoError) {
        this.onVideoError(error);
      }
      
      return null;
    }
  }

  // Video iletişimini durdur
  async stopVideo() {
    try {
      if (!this.isVideoEnabled) {
        return true;
      }
      
      // Medya akışını durdur
      if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop());
        this.videoStream = null;
      }
      
      // Producer'ı kapat
      if (this.videoProducer) {
        this.videoProducer.close();
        
        // Sunucuya bildir
        if (this.mediasoupHandler && this.mediasoupHandler.roomId) {
          await this.mediasoupHandler.sendRequest('mediasoup:stop-video', {
            roomId: this.mediasoupHandler.roomId,
            producerId: this.videoProducer.id
          });
        }
        
        this.videoProducer = null;
      }
      
      this.isVideoEnabled = false;
      
      // Callback'i çağır
      if (this.onVideoStopped) {
        this.onVideoStopped();
      }
      
      return true;
    } catch (error) {
      console.error('Video iletişimi durdurulurken hata oluştu:', error);
      
      // Callback'i çağır
      if (this.onVideoError) {
        this.onVideoError(error);
      }
      
      return false;
    }
  }

  // Video iletişimi durumunu değiştir
  async toggleVideo() {
    if (this.isVideoEnabled) {
      return this.stopVideo();
    } else {
      return this.startVideo();
    }
  }
}

export default VideoChatHandler;
