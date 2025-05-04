/**
 * src/types/messages.ts
 * Mesaj tipleri için discriminated unions
 */

import { ID } from './common';
import { UserResponse } from './api';

/**
 * Mesaj tipi
 */
export type MessageType = 'text' | 'image' | 'file' | 'system';

/**
 * Temel mesaj arayüzü
 */
interface BaseMessage {
  id: ID;
  createdAt: Date;
  senderId: ID;
  channelId: ID;
  isEdited: boolean;
  isPinned: boolean;
}

/**
 * Metin mesajı
 */
export interface TextMessage extends BaseMessage {
  type: 'text';
  content: string;
  mentions?: ID[];
}

/**
 * Resim mesajı
 */
export interface ImageMessage extends BaseMessage {
  type: 'image';
  imageUrl: string;
  caption?: string;
  width?: number;
  height?: number;
}

/**
 * Dosya mesajı
 */
export interface FileMessage extends BaseMessage {
  type: 'file';
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Sistem mesajı
 */
export interface SystemMessage extends BaseMessage {
  type: 'system';
  action: 'user_joined' | 'user_left' | 'channel_created' | 'user_added' | 'user_removed';
  metadata: Record<string, unknown>;
}

/**
 * Mesaj birleşim tipi
 */
export type Message = TextMessage | ImageMessage | FileMessage | SystemMessage;

/**
 * Mesaj işleme yardımcı fonksiyonu
 * @param message - İşlenecek mesaj
 * @param handlers - Mesaj tiplerine göre işleyiciler
 * @returns İşleyicinin dönüş değeri
 */
export function processMessage<T>(
  message: Message,
  handlers: {
    text?: (message: TextMessage) => T;
    image?: (message: ImageMessage) => T;
    file?: (message: FileMessage) => T;
    system?: (message: SystemMessage) => T;
    default?: (message: Message) => T;
  }
): T {
  switch (message.type) {
    case 'text':
      return handlers.text ? handlers.text(message) : (handlers.default?.(message) as T);
    case 'image':
      return handlers.image ? handlers.image(message) : (handlers.default?.(message) as T);
    case 'file':
      return handlers.file ? handlers.file(message) : (handlers.default?.(message) as T);
    case 'system':
      return handlers.system ? handlers.system(message) : (handlers.default?.(message) as T);
    default:
      if (handlers.default) {
        return handlers.default(message as Message);
      }
      throw new Error(`Bilinmeyen mesaj tipi: ${(message as any).type}`);
  }
}
