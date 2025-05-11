/**
 * src/modules/webhookManager.ts
 * Webhook yönetimi modülü
 */
import mongoose from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import { createModelHelper } from '../utils/mongoose-helpers';
import { Group, GroupDocument } from '../models/Group';
import { Channel, ChannelDocument } from '../models/Channel';

// Webhook modeli arayüzü
export interface WebhookDocument extends mongoose.Document {
  name: string;
  url: string;
  secret: string;
  events: string[];
  group?: mongoose.Types.ObjectId;
  channel?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastTriggered?: Date;
  lastResponse?: {
    status: number;
    message: string;
    timestamp: Date;
  };
}

// Webhook modeli şeması
const webhookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  secret: { type: String, required: true },
  events: [{ type: String, required: true }],
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  lastTriggered: { type: Date },
  lastResponse: {
    status: { type: Number },
    message: { type: String },
    timestamp: { type: Date },
  },
});

// Webhook modeli
const Webhook = mongoose.model<WebhookDocument>('Webhook', webhookSchema);

// Model yardımcıları
const WebhookHelper = createModelHelper<WebhookDocument, typeof Webhook>(Webhook);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);

// Webhook oluşturma arayüzü
export interface CreateWebhookOptions {
  name: string;
  url: string;
  events: string[];
  groupId?: string;
  channelId?: string;
  userId: string;
}

// Webhook güncelleme arayüzü
export interface UpdateWebhookOptions {
  name?: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

// Webhook tetikleme arayüzü
export interface TriggerWebhookOptions {
  event: string;
  payload: any;
  groupId?: string;
  channelId?: string;
}

/**
 * Webhook oluşturur
 * @param options - Webhook oluşturma seçenekleri
 * @returns Oluşturulan webhook
 */
export async function createWebhook(options: CreateWebhookOptions): Promise<WebhookDocument> {
  try {
    // URL doğrulama
    if (!isValidUrl(options.url)) {
      throw new ValidationError('Geçersiz URL formatı.');
    }

    // Event doğrulama
    if (!options.events || options.events.length === 0) {
      throw new ValidationError('En az bir event seçilmelidir.');
    }

    // Grup ve kanal kontrolü
    let group;
    let channel;

    if (options.groupId) {
      group = await GroupHelper.findOne({ groupId: options.groupId });
      if (!group) {
        throw new NotFoundError('Grup bulunamadı.');
      }
    }

    if (options.channelId) {
      channel = await ChannelHelper.findOne({ channelId: options.channelId });
      if (!channel) {
        throw new NotFoundError('Kanal bulunamadı.');
      }

      // Kanal ve grup uyumluluğu kontrolü
      if (group && channel.group.toString() !== group._id.toString()) {
        throw new ValidationError('Kanal belirtilen gruba ait değil.');
      }
    }

    // Secret oluştur
    const secret = crypto.randomBytes(32).toString('hex');

    // Webhook oluştur
    const webhook = new Webhook({
      name: options.name,
      url: options.url,
      secret,
      events: options.events,
      group: group?._id,
      channel: channel?._id,
      createdBy: options.userId,
    });

    await webhook.save();

    logger.info('Webhook oluşturuldu', {
      webhookId: webhook._id,
      name: webhook.name,
      events: webhook.events,
    });

    return webhook;
  } catch (error) {
    logger.error('Webhook oluşturma hatası', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

/**
 * Webhook günceller
 * @param webhookId - Webhook ID'si
 * @param options - Webhook güncelleme seçenekleri
 * @returns Güncellenmiş webhook
 */
export async function updateWebhook(
  webhookId: string,
  options: UpdateWebhookOptions
): Promise<WebhookDocument> {
  try {
    const webhook = await WebhookHelper.findById(webhookId);
    if (!webhook) {
      throw new NotFoundError('Webhook bulunamadı.');
    }

    // URL doğrulama
    if (options.url && !isValidUrl(options.url)) {
      throw new ValidationError('Geçersiz URL formatı.');
    }

    // Event doğrulama
    if (options.events && options.events.length === 0) {
      throw new ValidationError('En az bir event seçilmelidir.');
    }

    // Alanları güncelle
    if (options.name) webhook.name = options.name;
    if (options.url) webhook.url = options.url;
    if (options.events) webhook.events = options.events;
    if (options.isActive !== undefined) webhook.isActive = options.isActive;

    webhook.updatedAt = new Date();
    await webhook.save();

    logger.info('Webhook güncellendi', {
      webhookId,
      name: webhook.name,
      isActive: webhook.isActive,
    });

    return webhook;
  } catch (error) {
    logger.error('Webhook güncelleme hatası', {
      error: (error as Error).message,
      webhookId,
      options,
    });
    throw error;
  }
}

/**
 * Webhook siler
 * @param webhookId - Webhook ID'si
 * @returns İşlem sonucu
 */
export async function deleteWebhook(webhookId: string): Promise<{ success: boolean }> {
  try {
    const result = await WebhookHelper.getModel().deleteOne({ _id: webhookId });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Webhook bulunamadı.');
    }

    logger.info('Webhook silindi', { webhookId });

    return { success: true };
  } catch (error) {
    logger.error('Webhook silme hatası', {
      error: (error as Error).message,
      webhookId,
    });
    throw error;
  }
}

/**
 * Webhook'ları getirir
 * @param filters - Filtreler
 * @returns Webhook listesi
 */
export async function getWebhooks(
  filters: {
    userId?: string;
    groupId?: string;
    channelId?: string;
    isActive?: boolean;
  } = {}
): Promise<WebhookDocument[]> {
  try {
    const query: any = {};

    if (filters.userId) {
      query.createdBy = filters.userId;
    }

    if (filters.groupId) {
      const group = await GroupHelper.findOne({ groupId: filters.groupId });
      if (group) {
        query.group = group._id;
      }
    }

    if (filters.channelId) {
      const channel = await ChannelHelper.findOne({ channelId: filters.channelId });
      if (channel) {
        query.channel = channel._id;
      }
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const webhooks = await WebhookHelper.find(query, null, {
      populate: [
        { path: 'createdBy', select: 'username' },
        { path: 'group', select: 'groupId name' },
        { path: 'channel', select: 'channelId name' },
      ],
      sort: { createdAt: -1 },
    });

    logger.info('Webhook\'lar getirildi', {
      count: webhooks.length,
      filters,
    });

    return webhooks;
  } catch (error) {
    logger.error('Webhook\'ları getirme hatası', {
      error: (error as Error).message,
      filters,
    });
    throw error;
  }
}

/**
 * Webhook tetikler
 * @param options - Webhook tetikleme seçenekleri
 * @returns Tetiklenen webhook sayısı
 */
export async function triggerWebhooks(
  options: TriggerWebhookOptions
): Promise<{ triggeredCount: number }> {
  try {
    // Webhook'ları bul
    const query: any = {
      events: options.event,
      isActive: true,
    };

    if (options.groupId) {
      const group = await GroupHelper.findOne({ groupId: options.groupId });
      if (group) {
        query.group = group._id;
      }
    }

    if (options.channelId) {
      const channel = await ChannelHelper.findOne({ channelId: options.channelId });
      if (channel) {
        query.channel = channel._id;
      }
    }

    const webhooks = await WebhookHelper.find(query);

    // Her webhook için istek gönder
    let triggeredCount = 0;

    for (const webhook of webhooks) {
      try {
        // İmza oluştur
        const timestamp = Date.now().toString();
        const signature = createSignature(
          webhook.secret,
          JSON.stringify(options.payload),
          timestamp
        );

        // İsteği gönder
        const response = await axios.post(webhook.url, options.payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Fisqos-Event': options.event,
            'X-Fisqos-Signature': signature,
            'X-Fisqos-Timestamp': timestamp,
          },
          timeout: 5000, // 5 saniye timeout
        });

        // Webhook'u güncelle
        webhook.lastTriggered = new Date();
        webhook.lastResponse = {
          status: response.status,
          message: response.statusText,
          timestamp: new Date(),
        };

        await webhook.save();
        triggeredCount++;

        logger.info('Webhook tetiklendi', {
          webhookId: webhook._id,
          event: options.event,
          status: response.status,
        });
      } catch (error) {
        // Hata durumunda webhook'u güncelle
        webhook.lastTriggered = new Date();
        webhook.lastResponse = {
          status: (error as any).response?.status || 500,
          message: (error as Error).message,
          timestamp: new Date(),
        };

        await webhook.save();

        logger.warn('Webhook tetikleme hatası', {
          webhookId: webhook._id,
          event: options.event,
          error: (error as Error).message,
        });
      }
    }

    return { triggeredCount };
  } catch (error) {
    logger.error('Webhook tetikleme hatası', {
      error: (error as Error).message,
      event: options.event,
    });
    throw error;
  }
}

/**
 * URL doğrulama
 * @param url - URL
 * @returns URL geçerli mi
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * İmza oluşturma
 * @param secret - Webhook secret
 * @param payload - İstek içeriği
 * @param timestamp - Zaman damgası
 * @returns İmza
 */
function createSignature(secret: string, payload: string, timestamp: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${timestamp}.${payload}`);
  return hmac.digest('hex');
}

// Webhook modelini ve createSignature fonksiyonunu dışa aktar
export { Webhook, createSignature };

export default {
  Webhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhooks,
  triggerWebhooks,
  createSignature,
};
