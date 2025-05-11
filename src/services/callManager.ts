/**
 * src/services/callManager.ts
 * Görüntülü görüşme yöneticisi
 */
import { logger } from '../utils/logger';
import {
  Call,
  CallParticipant,
  CreateCallParams,
  JoinCallParams,
  LeaveCallParams,
  EndCallParams,
  UpdateMediaStateParams,
  UpdateScreenShareParams,
  CallManager as ICallManager,
} from '../types/call';
import { ID } from '../types/common';
import { v4 as uuidv4 } from 'uuid';
import { TypedServer } from '../types/socket';

/**
 * Görüntülü görüşme yöneticisi
 */
export class CallManager implements ICallManager {
  private calls: Map<string, Call>;
  private voiceChannels: Map<string, Set<string>> = new Map();
  private io: TypedServer;

  /**
   * Yapıcı
   * @param io Socket.IO sunucusu
   */
  constructor(io: TypedServer) {
    this.calls = new Map<string, Call>();
    this.io = io;
    logger.info('Görüntülü görüşme yöneticisi başlatıldı');
  }

  /**
   * Yeni görüşme oluşturur
   * @param params Görüşme oluşturma parametreleri
   * @returns Oluşturulan görüşme
   */
  async createCall(params: CreateCallParams): Promise<Call | null> {
    try {
      const { channelId, initiatorId } = params;

      // Aynı kanalda aktif görüşme var mı kontrol et
      const existingCall = await this.getActiveCallsByChannelId(channelId);
      if (existingCall.length > 0) {
        logger.warn('Bu kanalda zaten aktif bir görüşme var', {
          channelId,
          callId: existingCall[0].id,
        });
        return existingCall[0];
      }

      // Yeni görüşme oluştur
      const callId = uuidv4();
      const call: Call = {
        id: callId,
        channelId,
        initiatorId,
        participants: [
          {
            id: initiatorId,
            username: 'unknown', // Kullanıcı adı daha sonra güncellenecek
            mediaState: {
              audio: true,
              video: false,
              screenShare: false,
            },
            joinedAt: Date.now(),
          },
        ],
        startedAt: Date.now(),
        active: true,
      };

      // Görüşmeyi kaydet
      this.calls.set(callId, call);

      logger.info('Yeni görüşme oluşturuldu', {
        callId,
        channelId,
        initiatorId,
      });

      return call;
    } catch (error) {
      logger.error('Görüşme oluşturma hatası', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Görüşmeye katılır
   * @param params Görüşme katılma parametreleri
   * @returns Katılınan görüşme
   */
  async joinCall(params: JoinCallParams): Promise<Call | null> {
    try {
      const { callId, userId } = params;

      // Görüşmeyi bul
      const call = this.calls.get(callId);
      if (!call) {
        logger.warn('Görüşme bulunamadı', { callId });
        return null;
      }

      // Kullanıcı zaten katılmış mı kontrol et
      const existingParticipant = call.participants.find((p) => p.id === userId);
      if (existingParticipant) {
        logger.warn('Kullanıcı zaten görüşmeye katılmış', {
          callId,
          userId,
        });
        return call;
      }

      // Kullanıcıyı katılımcı olarak ekle
      const participant: CallParticipant = {
        id: userId,
        username: 'unknown', // Kullanıcı adı daha sonra güncellenecek
        mediaState: {
          audio: true,
          video: false,
          screenShare: false,
        },
        joinedAt: Date.now(),
      };

      call.participants.push(participant);

      // Görüşmeyi güncelle
      this.calls.set(callId, call);

      logger.info('Kullanıcı görüşmeye katıldı', {
        callId,
        userId,
      });

      return call;
    } catch (error) {
      logger.error('Görüşmeye katılma hatası', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Ses kanalına katılır
   * @param userId Kullanıcı ID
   * @param channelId Kanal ID
   * @param options Seçenekler
   * @returns İşlem başarılı mı
   */
  async joinVoiceChannel(
    userId: ID,
    channelId: ID,
    options: { listenOnly?: boolean } = {}
  ): Promise<boolean> {
    try {
      // Kanal ID'yi string'e çevir
      const channelIdStr = channelId.toString();

      // Ses kanalı listesini al veya oluştur
      if (!this.voiceChannels.has(channelIdStr)) {
        this.voiceChannels.set(channelIdStr, new Set());
      }

      // Kullanıcıyı ses kanalına ekle
      this.voiceChannels.get(channelIdStr)?.add(userId.toString());

      logger.info('Kullanıcı ses kanalına katıldı', {
        userId,
        channelId: channelIdStr,
        listenOnly: options.listenOnly,
      });

      return true;
    } catch (error) {
      logger.error('Ses kanalına katılma hatası', {
        error: (error as Error).message,
        userId,
        channelId,
      });
      return false;
    }
  }

  /**
   * Ses kanalından ayrılır
   * @param userId Kullanıcı ID
   * @param channelId Kanal ID
   * @returns İşlem başarılı mı
   */
  async leaveVoiceChannel(userId: ID, channelId: ID): Promise<boolean> {
    try {
      // Kanal ID'yi string'e çevir
      const channelIdStr = channelId.toString();

      // Ses kanalı var mı kontrol et
      if (!this.voiceChannels.has(channelIdStr)) {
        return true; // Kanal yoksa işlem başarılı sayılır
      }

      // Kullanıcıyı ses kanalından çıkar
      this.voiceChannels.get(channelIdStr)?.delete(userId.toString());

      // Kanal boşsa kanalı kaldır
      if (this.voiceChannels.get(channelIdStr)?.size === 0) {
        this.voiceChannels.delete(channelIdStr);
      }

      logger.info('Kullanıcı ses kanalından ayrıldı', {
        userId,
        channelId: channelIdStr,
      });

      return true;
    } catch (error) {
      logger.error('Ses kanalından ayrılma hatası', {
        error: (error as Error).message,
        userId,
        channelId,
      });
      return false;
    }
  }

  /**
   * Ses kanalındaki kullanıcıları getirir
   * @param channelId Kanal ID
   * @returns Kullanıcı ID'leri
   */
  async getUsersInVoiceChannel(channelId: ID): Promise<string[]> {
    try {
      // Kanal ID'yi string'e çevir
      const channelIdStr = channelId.toString();

      // Ses kanalı var mı kontrol et
      if (!this.voiceChannels.has(channelIdStr)) {
        return [];
      }

      // Kullanıcı ID'lerini dizi olarak döndür
      return Array.from(this.voiceChannels.get(channelIdStr) || []);
    } catch (error) {
      logger.error('Ses kanalı kullanıcıları getirme hatası', {
        error: (error as Error).message,
        channelId,
      });
      return [];
    }
  }

  /**
   * Görüşmeden ayrılır
   * @param params Görüşme ayrılma parametreleri
   * @returns İşlem başarılı mı
   */
  async leaveCall(params: LeaveCallParams): Promise<boolean> {
    try {
      const { callId, userId } = params;

      // Görüşmeyi bul
      const call = this.calls.get(callId);
      if (!call) {
        logger.warn('Görüşme bulunamadı', { callId });
        return false;
      }

      // Kullanıcıyı katılımcılardan çıkar
      call.participants = call.participants.filter((p) => p.id !== userId);

      // Görüşmede katılımcı kalmadıysa görüşmeyi sonlandır
      if (call.participants.length === 0) {
        call.active = false;
        call.endedAt = Date.now();
      }

      // Görüşmeyi güncelle
      this.calls.set(callId, call);

      logger.info('Kullanıcı görüşmeden ayrıldı', {
        callId,
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Görüşmeden ayrılma hatası', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Görüşmeyi sonlandırır
   * @param params Görüşme sonlandırma parametreleri
   * @returns İşlem başarılı mı
   */
  async endCall(params: EndCallParams): Promise<boolean> {
    try {
      const { callId, userId } = params;

      // Görüşmeyi bul
      const call = this.calls.get(callId);
      if (!call) {
        logger.warn('Görüşme bulunamadı', { callId });
        return false;
      }

      // Kullanıcının görüşmeyi sonlandırma yetkisi var mı kontrol et
      if (call.initiatorId !== userId) {
        logger.warn('Kullanıcının görüşmeyi sonlandırma yetkisi yok', {
          callId,
          userId,
        });
        return false;
      }

      // Görüşmeyi sonlandır
      call.active = false;
      call.endedAt = Date.now();

      // Görüşmeyi güncelle
      this.calls.set(callId, call);

      logger.info('Görüşme sonlandırıldı', {
        callId,
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Görüşme sonlandırma hatası', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Görüşmeyi getirir
   * @param callId Görüşme ID
   * @returns Görüşme
   */
  async getCall(callId: ID): Promise<Call | null> {
    return this.calls.get(callId as string) || null;
  }

  /**
   * Kullanıcının aktif görüşmelerini getirir
   * @param userId Kullanıcı ID
   * @returns Aktif görüşmeler
   */
  async getActiveCallsByUserId(userId: ID): Promise<Call[]> {
    const activeCalls: Call[] = [];

    for (const call of this.calls.values()) {
      if (call.active && call.participants.some((p) => p.id === userId)) {
        activeCalls.push(call);
      }
    }

    return activeCalls;
  }

  /**
   * Kanalın aktif görüşmelerini getirir
   * @param channelId Kanal ID
   * @returns Aktif görüşmeler
   */
  async getActiveCallsByChannelId(channelId: ID): Promise<Call[]> {
    const activeCalls: Call[] = [];

    for (const call of this.calls.values()) {
      if (call.active && call.channelId === channelId) {
        activeCalls.push(call);
      }
    }

    return activeCalls;
  }

  /**
   * Medya durumunu günceller
   * @param params Medya durumu güncelleme parametreleri
   * @returns İşlem başarılı mı
   */
  async updateMediaState(params: UpdateMediaStateParams): Promise<boolean> {
    try {
      const { callId, userId, audio, video } = params;

      // Görüşmeyi bul
      const call = this.calls.get(callId);
      if (!call) {
        logger.warn('Görüşme bulunamadı', { callId });
        return false;
      }

      // Kullanıcıyı bul
      const participant = call.participants.find((p) => p.id === userId);
      if (!participant) {
        logger.warn('Kullanıcı görüşmede bulunamadı', {
          callId,
          userId,
        });
        return false;
      }

      // Medya durumunu güncelle
      participant.mediaState.audio = audio;
      participant.mediaState.video = video;

      // Görüşmeyi güncelle
      this.calls.set(callId, call);

      logger.info('Medya durumu güncellendi', {
        callId,
        userId,
        audio,
        video,
      });

      return true;
    } catch (error) {
      logger.error('Medya durumu güncelleme hatası', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Ekran paylaşımı durumunu günceller
   * @param params Ekran paylaşımı güncelleme parametreleri
   * @returns İşlem başarılı mı
   */
  async updateScreenShare(params: UpdateScreenShareParams): Promise<boolean> {
    try {
      const { callId, userId, active } = params;

      // Görüşmeyi bul
      const call = this.calls.get(callId);
      if (!call) {
        logger.warn('Görüşme bulunamadı', { callId });
        return false;
      }

      // Kullanıcıyı bul
      const participant = call.participants.find((p) => p.id === userId);
      if (!participant) {
        logger.warn('Kullanıcı görüşmede bulunamadı', {
          callId,
          userId,
        });
        return false;
      }

      // Ekran paylaşımı durumunu güncelle
      participant.mediaState.screenShare = active;

      // Görüşmeyi güncelle
      this.calls.set(callId, call);

      logger.info('Ekran paylaşımı durumu güncellendi', {
        callId,
        userId,
        active,
      });

      return true;
    } catch (error) {
      logger.error('Ekran paylaşımı durumu güncelleme hatası', {
        error: (error as Error).message,
      });
      return false;
    }
  }
}
