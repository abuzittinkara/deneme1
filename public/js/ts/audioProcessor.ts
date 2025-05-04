/**
 * public/js/ts/audioProcessor.ts
 * Ses işleme ve kalite iyileştirmeleri
 */

// TypeScript için tip tanımlamaları
// Not: Çalışma zamanında Socket.IO CDN üzerinden yüklenir
type Socket = any;
import { Producer } from 'mediasoup-client/lib/types';

// Ses işleme durumu
interface AudioProcessingState {
  isNoiseSuppressionEnabled: boolean;
  isEchoCancellationEnabled: boolean;
  isAutoGainControlEnabled: boolean;
  isVoiceActivityDetectionEnabled: boolean;
  isSpeaking: boolean;
  volume: number;
  speakingThreshold: number;
  silenceTimeout: number;
  silenceTimer: number | null;
}

/**
 * Ses işleme sınıfı
 * Gürültü engelleme, yankı engelleme ve ses seviyesi normalizasyonu gibi
 * ses kalitesi iyileştirmelerini yönetir
 */
class AudioProcessor {
  private socket: Socket;
  private producer: Producer | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private audioLevelCallback: ((level: number) => void) | null = null;
  private speakingCallback: ((isSpeaking: boolean) => void) | null = null;
  private state: AudioProcessingState = {
    isNoiseSuppressionEnabled: true,
    isEchoCancellationEnabled: true,
    isAutoGainControlEnabled: true,
    isVoiceActivityDetectionEnabled: true,
    isSpeaking: false,
    volume: 1.0,
    speakingThreshold: 0.05,
    silenceTimeout: 500,
    silenceTimer: null
  };

  /**
   * Ses işleme sınıfını oluşturur
   * @param socket - Socket.IO bağlantısı
   */
  constructor(socket: Socket) {
    this.socket = socket;
  }

  /**
   * Ses işlemeyi başlatır
   * @param mediaStream - Medya akışı
   * @param producer - Mediasoup producer
   * @returns İşlem başarılı mı
   */
  public async start(mediaStream: MediaStream, producer: Producer): Promise<boolean> {
    try {
      this.mediaStream = mediaStream;
      this.producer = producer;
      this.audioTrack = mediaStream.getAudioTracks()[0];

      if (!this.audioTrack) {
        console.error('Ses track\'i bulunamadı');
        return false;
      }

      // AudioContext oluştur
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Kaynak düğümü oluştur
      this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);

      // Analiz düğümü oluştur
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 1024;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Gain düğümü oluştur
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.state.volume;

      // İşlemci düğümü oluştur
      this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);
      this.processorNode.onaudioprocess = this.handleAudioProcess.bind(this);

      // Düğümleri bağla
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      console.log('Ses işleme başlatıldı');
      return true;
    } catch (error) {
      console.error('Ses işleme başlatılırken hata oluştu:', error);
      this.stop();
      return false;
    }
  }

  /**
   * Ses işlemeyi durdurur
   */
  public stop(): void {
    try {
      // İşlemci düğümünü kapat
      if (this.processorNode) {
        this.processorNode.disconnect();
        this.processorNode = null;
      }

      // Gain düğümünü kapat
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }

      // Analiz düğümünü kapat
      if (this.analyserNode) {
        this.analyserNode.disconnect();
        this.analyserNode = null;
      }

      // Kaynak düğümünü kapat
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }

      // AudioContext'i kapat
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        this.audioContext = null;
      }

      // Zamanlayıcıyı temizle
      if (this.state.silenceTimer !== null) {
        clearTimeout(this.state.silenceTimer);
        this.state.silenceTimer = null;
      }

      this.mediaStream = null;
      this.audioTrack = null;
      this.producer = null;

      console.log('Ses işleme durduruldu');
    } catch (error) {
      console.error('Ses işleme durdurulurken hata oluştu:', error);
    }
  }

  /**
   * Ses seviyesi değişikliği için callback ayarlar
   * @param callback - Ses seviyesi callback fonksiyonu
   */
  public onAudioLevel(callback: (level: number) => void): void {
    this.audioLevelCallback = callback;
  }

  /**
   * Konuşma durumu değişikliği için callback ayarlar
   * @param callback - Konuşma durumu callback fonksiyonu
   */
  public onSpeakingChange(callback: (isSpeaking: boolean) => void): void {
    this.speakingCallback = callback;
  }

  /**
   * Ses seviyesini ayarlar
   * @param volume - Ses seviyesi (0.0 - 1.0)
   */
  public setVolume(volume: number): void {
    if (volume < 0) volume = 0;
    if (volume > 1) volume = 1;

    this.state.volume = volume;

    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  /**
   * Gürültü engellemeyi açar/kapatır
   * @param enabled - Etkin mi
   */
  public setNoiseSuppression(enabled: boolean): void {
    this.state.isNoiseSuppressionEnabled = enabled;

    if (this.audioTrack) {
      const constraints = {
        noiseSuppression: enabled
      };

      (this.audioTrack as any).applyConstraints(constraints)
        .catch((error: any) => {
          console.error('Gürültü engelleme ayarlanırken hata oluştu:', error);
        });
    }
  }

  /**
   * Yankı engellemeyi açar/kapatır
   * @param enabled - Etkin mi
   */
  public setEchoCancellation(enabled: boolean): void {
    this.state.isEchoCancellationEnabled = enabled;

    if (this.audioTrack) {
      const constraints = {
        echoCancellation: enabled
      };

      (this.audioTrack as any).applyConstraints(constraints)
        .catch((error: any) => {
          console.error('Yankı engelleme ayarlanırken hata oluştu:', error);
        });
    }
  }

  /**
   * Otomatik kazanç kontrolünü açar/kapatır
   * @param enabled - Etkin mi
   */
  public setAutoGainControl(enabled: boolean): void {
    this.state.isAutoGainControlEnabled = enabled;

    if (this.audioTrack) {
      const constraints = {
        autoGainControl: enabled
      };

      (this.audioTrack as any).applyConstraints(constraints)
        .catch((error: any) => {
          console.error('Otomatik kazanç kontrolü ayarlanırken hata oluştu:', error);
        });
    }
  }

  /**
   * Konuşma algılama eşiğini ayarlar
   * @param threshold - Eşik değeri (0.0 - 1.0)
   */
  public setSpeakingThreshold(threshold: number): void {
    if (threshold < 0) threshold = 0;
    if (threshold > 1) threshold = 1;

    this.state.speakingThreshold = threshold;
  }

  /**
   * Ses işleme olayını yönetir
   * @param event - Ses işleme olayı
   */
  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (!this.analyserNode) return;

    // Ses seviyesini hesapla
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);

    let sum = 0;
    for (const value of dataArray) {
      sum += value;
    }

    const average = sum / dataArray.length;
    const level = average / 255; // 0.0 - 1.0 aralığına normalize et

    // Ses seviyesi callback'ini çağır
    if (this.audioLevelCallback) {
      this.audioLevelCallback(level);
    }

    // Konuşma algılama
    if (this.state.isVoiceActivityDetectionEnabled) {
      const isSpeakingNow = level >= this.state.speakingThreshold;

      if (isSpeakingNow && !this.state.isSpeaking) {
        // Konuşma başladı
        this.state.isSpeaking = true;

        // Zamanlayıcıyı temizle
        if (this.state.silenceTimer !== null) {
          clearTimeout(this.state.silenceTimer);
          this.state.silenceTimer = null;
        }

        // Callback'i çağır
        if (this.speakingCallback) {
          this.speakingCallback(true);
        }

        // Sunucuya bildir
        this.socket.emit('userSpeakingChanged', { isSpeaking: true });
      } else if (!isSpeakingNow && this.state.isSpeaking) {
        // Konuşma bitmiş olabilir, zamanlayıcı başlat
        if (this.state.silenceTimer === null) {
          this.state.silenceTimer = window.setTimeout(() => {
            // Konuşma bitti
            this.state.isSpeaking = false;
            this.state.silenceTimer = null;

            // Callback'i çağır
            if (this.speakingCallback) {
              this.speakingCallback(false);
            }

            // Sunucuya bildir
            this.socket.emit('userSpeakingChanged', { isSpeaking: false });
          }, this.state.silenceTimeout);
        }
      }
    }
  }
}

export default AudioProcessor;
