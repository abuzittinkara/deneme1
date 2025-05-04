// Screen Share Handler
class ScreenShareHandler {
  constructor(mediasoupHandler) {
    this.mediasoupHandler = mediasoupHandler;
    this.isScreenSharing = false;
    this.screenShareProducer = null;
    this.screenShareStream = null;
    this.onScreenShareStarted = null;
    this.onScreenShareStopped = null;
    this.onScreenShareError = null;
  }

  // Ekran paylaşımını başlat
  async startScreenShare() {
    try {
      if (this.isScreenSharing) {
        throw new Error('Ekran zaten paylaşılıyor');
      }
      
      if (!this.mediasoupHandler || !this.mediasoupHandler.producerTransport) {
        throw new Error('Mediasoup bağlantısı kurulmadı');
      }
      
      // Ekran paylaşımı için medya akışını al
      this.screenShareStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      // Ekran paylaşımı durduğunda
      this.screenShareStream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenShare();
      });
      
      // Ekran paylaşımı producer'ı oluştur
      const videoTrack = this.screenShareStream.getVideoTracks()[0];
      
      // Producer oluştur
      this.screenShareProducer = await this.mediasoupHandler.producerTransport.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 500000 },
          { maxBitrate: 1000000 },
          { maxBitrate: 2000000 }
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000
        },
        appData: {
          screenShare: true
        }
      });
      
      // Producer olaylarını dinle
      this.screenShareProducer.on('transportclose', () => {
        this.stopScreenShare();
      });
      
      this.screenShareProducer.on('trackended', () => {
        this.stopScreenShare();
      });
      
      this.isScreenSharing = true;
      
      // Callback'i çağır
      if (this.onScreenShareStarted) {
        this.onScreenShareStarted(this.screenShareProducer);
      }
      
      return this.screenShareProducer;
    } catch (error) {
      console.error('Ekran paylaşımı başlatılırken hata oluştu:', error);
      
      // Medya akışını temizle
      if (this.screenShareStream) {
        this.screenShareStream.getTracks().forEach(track => track.stop());
        this.screenShareStream = null;
      }
      
      // Callback'i çağır
      if (this.onScreenShareError) {
        this.onScreenShareError(error);
      }
      
      return null;
    }
  }

  // Ekran paylaşımını durdur
  async stopScreenShare() {
    try {
      if (!this.isScreenSharing) {
        return true;
      }
      
      // Medya akışını durdur
      if (this.screenShareStream) {
        this.screenShareStream.getTracks().forEach(track => track.stop());
        this.screenShareStream = null;
      }
      
      // Producer'ı kapat
      if (this.screenShareProducer) {
        this.screenShareProducer.close();
        
        // Sunucuya bildir
        if (this.mediasoupHandler && this.mediasoupHandler.roomId) {
          await this.mediasoupHandler.sendRequest('mediasoup:stop-screen-share', {
            roomId: this.mediasoupHandler.roomId,
            producerId: this.screenShareProducer.id
          });
        }
        
        this.screenShareProducer = null;
      }
      
      this.isScreenSharing = false;
      
      // Callback'i çağır
      if (this.onScreenShareStopped) {
        this.onScreenShareStopped();
      }
      
      return true;
    } catch (error) {
      console.error('Ekran paylaşımı durdurulurken hata oluştu:', error);
      
      // Callback'i çağır
      if (this.onScreenShareError) {
        this.onScreenShareError(error);
      }
      
      return false;
    }
  }

  // Ekran paylaşımı durumunu değiştir
  async toggleScreenShare() {
    if (this.isScreenSharing) {
      return this.stopScreenShare();
    } else {
      return this.startScreenShare();
    }
  }
}

export default ScreenShareHandler;
