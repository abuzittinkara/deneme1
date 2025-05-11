/**
 * src/types/call.ts
 * Sesli/görüntülü görüşme tipleri
 */

/**
 * Görüşme sinyali tipleri
 */
export enum CallSignalType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice-candidate',
  MEDIA_STATE = 'media-state',
  SCREEN_SHARE = 'screen-share',
}

/**
 * Görüşme sinyali
 */
export interface CallSignal {
  type: CallSignalType;
  callId: string;
  senderId: string;
  receiverId?: string;
  data: any;
  timestamp: number;
}

/**
 * SDP teklifi sinyali
 */
export interface OfferSignal extends CallSignal {
  type: CallSignalType.OFFER;
  data: {
    sdp: RTCSessionDescriptionInit;
  };
}

/**
 * SDP yanıtı sinyali
 */
export interface AnswerSignal extends CallSignal {
  type: CallSignalType.ANSWER;
  data: {
    sdp: RTCSessionDescriptionInit;
  };
}

/**
 * ICE adayı sinyali
 */
export interface IceCandidateSignal extends CallSignal {
  type: CallSignalType.ICE_CANDIDATE;
  data: {
    candidate: RTCIceCandidateInit;
  };
}

/**
 * Medya durumu sinyali
 */
export interface MediaStateSignal extends CallSignal {
  type: CallSignalType.MEDIA_STATE;
  data: {
    audio: boolean;
    video: boolean;
  };
}

/**
 * Ekran paylaşımı sinyali
 */
export interface ScreenShareSignal extends CallSignal {
  type: CallSignalType.SCREEN_SHARE;
  data: {
    active: boolean;
  };
}

/**
 * Görüşme katılımcısı
 */
export interface CallParticipant {
  id: string;
  username: string;
  avatar?: string;
  mediaState: {
    audio: boolean;
    video: boolean;
    screenShare: boolean;
  };
  joinedAt: number;
}

/**
 * Görüşme
 */
export interface Call {
  id: string;
  channelId: string;
  initiatorId: string;
  participants: CallParticipant[];
  startedAt: number;
  endedAt?: number;
  active: boolean;
}

/**
 * Görüşme oluşturma parametreleri
 */
export interface CreateCallParams {
  channelId: string;
  initiatorId: string;
}

/**
 * Görüşme katılma parametreleri
 */
export interface JoinCallParams {
  callId: string;
  userId: string;
}

/**
 * Görüşme ayrılma parametreleri
 */
export interface LeaveCallParams {
  callId: string;
  userId: string;
}

/**
 * Görüşme sonlandırma parametreleri
 */
export interface EndCallParams {
  callId: string;
  userId: string;
}

/**
 * Görüşme medya durumu güncelleme parametreleri
 */
export interface UpdateMediaStateParams {
  callId: string;
  userId: string;
  audio: boolean;
  video: boolean;
}

/**
 * Görüşme ekran paylaşımı güncelleme parametreleri
 */
export interface UpdateScreenShareParams {
  callId: string;
  userId: string;
  active: boolean;
}

/**
 * Görüşme yöneticisi arayüzü
 */
export interface CallManager {
  createCall(params: CreateCallParams): Promise<Call | null>;
  joinCall(params: JoinCallParams): Promise<Call | null>;
  leaveCall(params: LeaveCallParams): Promise<boolean>;
  endCall(params: EndCallParams): Promise<boolean>;
  getCall(callId: string): Promise<Call | null>;
  getActiveCallsByUserId(userId: string): Promise<Call[]>;
  getActiveCallsByChannelId(channelId: string): Promise<Call[]>;
  updateMediaState(params: UpdateMediaStateParams): Promise<boolean>;
  updateScreenShare(params: UpdateScreenShareParams): Promise<boolean>;
}
