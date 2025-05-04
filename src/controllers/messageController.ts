/**
 * src/controllers/messageController.ts
 * Mesaj controller'ı - Sayfalama ve filtreleme örnekleri
 */
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MessageService } from '../services/messageService';
import { FilterConfig, filteringMiddleware } from '../middleware/filtering';
import { paginationMiddleware } from '../middleware/pagination';

// Mesaj modeli için tip tanımı (tam model tanımı ayrı dosyada olacak)
const Message = mongoose.model('Message');

// Mesaj servisi örneği
const messageService = new MessageService(Message);

// Mesaj filtreleme yapılandırması
const messageFilterConfigs: FilterConfig[] = [
  { field: 'search', transform: (value) => value.trim() },
  { field: 'startDate', transform: (value) => new Date(value).toISOString() },
  { field: 'endDate', transform: (value) => new Date(value).toISOString() },
  { field: 'userId' },
  { field: 'includeDeleted', transform: (value) => value === 'true' },
  { field: 'pinned', transform: (value) => value === 'true' },
  { field: 'sort', transform: (value) => value === 'asc' ? 'asc' : 'desc' }
];

/**
 * Kanal mesajlarını getir
 * @route GET /api/channels/:channelId/messages
 */
export const getChannelMessages = [
  // Sayfalama middleware'i
  paginationMiddleware(20, 100),
  
  // Filtreleme middleware'i
  filteringMiddleware(messageFilterConfigs),
  
  // Controller
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId } = req.params;
      
      // Sayfalama ve filtreleme parametrelerini al
      const pagination = req.pagination!;
      const filters = req.filters || {};
      
      // Mesajları getir
      const result = await messageService.getChannelMessages(channelId, pagination, filters);
      
      // Yanıtı döndür
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
];

/**
 * Cursor tabanlı sayfalama ile kanal mesajlarını getir
 * @route GET /api/channels/:channelId/messages/cursor
 */
export const getChannelMessagesWithCursor = [
  // Filtreleme middleware'i
  filteringMiddleware(messageFilterConfigs),
  
  // Controller
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId } = req.params;
      const { cursor, limit } = req.query;
      
      // Filtreleme parametrelerini al
      const filters = req.filters || {};
      
      // Mesajları getir
      const result = await messageService.getChannelMessagesWithCursor(
        channelId,
        cursor as string,
        limit ? parseInt(limit as string) : 20,
        filters
      );
      
      // Yanıtı döndür
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
];
