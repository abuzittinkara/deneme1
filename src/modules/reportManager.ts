/**
 * src/modules/reportManager.ts
 * Rapor yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { Report, ReportDocument, ReportStatus } from '../models/Report';
import { User, UserDocument } from '../models/User';
import { Message, MessageDocument } from '../models/Message';
import { DmMessage, DmMessageDocument } from '../models/DmMessage';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { createModelHelper } from '../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const ReportHelper = createModelHelper<ReportDocument, typeof Report>(Report);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const DmMessageHelper = createModelHelper<DmMessageDocument, typeof DmMessage>(DmMessage);

// Rapor mesajları sonucu arayüzü
export interface ReportMessagesResult {
  messages: MessageDocument[];
  dmMessages: DmMessageDocument[];
}

/**
 * Kullanıcı raporu oluşturur
 * @param reporterId - Raporu oluşturan kullanıcı ID'si
 * @param reportedUsername - Raporlanan kullanıcı adı
 * @param reason - Rapor nedeni
 * @param description - Rapor açıklaması
 * @param relatedMessageIds - İlgili mesaj ID'leri
 * @param relatedDMMessageIds - İlgili DM mesaj ID'leri
 * @returns Oluşturulan rapor
 */
export async function createUserReport(
  reporterId: string,
  reportedUsername: string,
  reason: string,
  description: string,
  relatedMessageIds: string[] = [],
  relatedDMMessageIds: string[] = []
): Promise<ReportDocument> {
  try {
    // Raporlanan kullanıcıyı bul
    const reportedUser = await User.findOne({ username: reportedUsername });
    if (!reportedUser) {
      throw new NotFoundError('Raporlanan kullanıcı bulunamadı');
    }

    // Kendini raporlama kontrolü
    if (reporterId.toString() === reportedUser._id.toString()) {
      throw new ValidationError('Kendinizi raporlayamazsınız');
    }

    // Rapor oluştur
    const report = new Report({
      reporter: reporterId,
      reportedUser: reportedUser._id,
      reason,
      description,
      relatedMessages: relatedMessageIds.map(id => new mongoose.Types.ObjectId(id)),
      relatedDMMessages: relatedDMMessageIds.map(id => new mongoose.Types.ObjectId(id))
    });

    await report.save();

    // Raporu populate et
    const populatedReport = await Report.findById(report._id)
      .populate('reporter', 'username')
      .populate('reportedUser', 'username');

    if (!populatedReport) {
      throw new Error('Rapor oluşturuldu ancak getirilemedi');
    }

    logger.info('Kullanıcı raporu oluşturuldu', {
      reportId: report._id,
      reporter: reporterId,
      reportedUser: reportedUser._id
    });

    return populatedReport as ReportDocument;
  } catch (error) {
    logger.error('Kullanıcı raporu oluşturma hatası', {
      error: (error as Error).message,
      reporterId,
      reportedUsername
    });
    throw error;
  }
}

/**
 * Kullanıcının raporlarını getirir
 * @param userId - Kullanıcı ID'si
 * @returns Raporlar listesi
 */
export async function getUserReports(userId: string): Promise<ReportDocument[]> {
  try {
    const reports = await Report.find({ reporter: userId })
      .populate('reportedUser', 'username')
      .sort({ createdAt: -1 });

    logger.info('Kullanıcı raporları getirildi', { userId, count: reports.length });

    return reports as ReportDocument[];
  } catch (error) {
    logger.error('Kullanıcı raporlarını getirme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

/**
 * Rapor durumunu günceller
 * @param reportId - Rapor ID'si
 * @param status - Yeni durum
 * @param adminId - İşlemi yapan admin ID'si
 * @param resolution - Çözüm açıklaması
 * @returns Güncellenen rapor
 */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  adminId: string,
  resolution: string = ''
): Promise<ReportDocument> {
  try {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new NotFoundError('Rapor bulunamadı');
    }

    // Geçerli durum kontrolü
    if (!['pending', 'investigating', 'resolved', 'dismissed'].includes(status)) {
      throw new ValidationError('Geçersiz rapor durumu');
    }

    report.set('status', status);
    report.set('updatedAt', new Date());

    if (status === 'resolved' || status === 'dismissed') {
      report.set('resolvedBy', new mongoose.Types.ObjectId(adminId));
      report.set('resolution', resolution);
    }

    await report.save();

    // Raporu populate et
    const populatedReport = await Report.findById(report._id)
      .populate('reporter', 'username')
      .populate('reportedUser', 'username')
      .populate('resolvedBy', 'username');

    if (!populatedReport) {
      throw new Error('Rapor güncellendi ancak getirilemedi');
    }

    logger.info('Rapor durumu güncellendi', {
      reportId,
      status,
      adminId
    });

    return populatedReport as ReportDocument;
  } catch (error) {
    logger.error('Rapor durumu güncelleme hatası', {
      error: (error as Error).message,
      reportId,
      status,
      adminId
    });
    throw error;
  }
}

/**
 * Raporu arşivler
 * @param reportId - Rapor ID'si
 * @returns Arşivlenen rapor
 */
export async function archiveReport(reportId: string): Promise<ReportDocument> {
  try {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new NotFoundError('Rapor bulunamadı');
    }

    report.set('isArchived', true);
    report.set('updatedAt', new Date());

    await report.save();

    logger.info('Rapor arşivlendi', { reportId });

    return report as ReportDocument;
  } catch (error) {
    logger.error('Rapor arşivleme hatası', {
      error: (error as Error).message,
      reportId
    });
    throw error;
  }
}

/**
 * Bekleyen raporları getirir
 * @param limit - Maksimum rapor sayısı
 * @returns Bekleyen raporlar listesi
 */
export async function getPendingReports(limit: number = 10): Promise<ReportDocument[]> {
  try {
    const reports = await Report.find({ status: 'pending', isArchived: false })
      .populate('reporter', 'username')
      .populate('reportedUser', 'username')
      .sort({ createdAt: 1 })
      .limit(limit);

    logger.info('Bekleyen raporlar getirildi', { count: reports.length });

    return reports as ReportDocument[];
  } catch (error) {
    logger.error('Bekleyen raporları getirme hatası', {
      error: (error as Error).message,
      limit
    });
    throw error;
  }
}

/**
 * Raporla ilgili mesajları getirir
 * @param reportId - Rapor ID'si
 * @returns Mesajlar
 */
export async function getReportMessages(reportId: string): Promise<ReportMessagesResult> {
  try {
    const report = await ReportHelper.findById(reportId).exec();
    if (!report) {
      throw new NotFoundError('Rapor bulunamadı');
    }

    // İlgili mesajları getir
    const messages = await MessageHelper.find({ _id: { $in: report.relatedMessages } })
      .populate('user', 'username')
      .sort({ timestamp: 1 })
      .exec();

    // İlgili DM mesajlarını getir
    const dmMessages = await DmMessageHelper.find({ _id: { $in: report.relatedDMMessages } })
      .populate('sender', 'username')
      .populate('receiver', 'username')
      .sort({ timestamp: 1 })
      .exec();

    logger.info('Rapor mesajları getirildi', {
      reportId,
      messageCount: messages.length,
      dmMessageCount: dmMessages.length
    });

    return {
      messages,
      dmMessages
    };
  } catch (error) {
    logger.error('Rapor mesajlarını getirme hatası', {
      error: (error as Error).message,
      reportId
    });
    throw error;
  }
}

/**
 * Kullanıcıya karşı yapılan raporları getirir
 * @param userId - Kullanıcı ID'si
 * @returns Raporlar listesi
 */
export async function getReportsAgainstUser(userId: string): Promise<ReportDocument[]> {
  try {
    const reports = await Report.find({ reportedUser: userId })
      .populate('reporter', 'username')
      .sort({ createdAt: -1 });

    logger.info('Kullanıcıya karşı yapılan raporlar getirildi', {
      userId,
      count: reports.length
    });

    return reports as ReportDocument[];
  } catch (error) {
    logger.error('Kullanıcıya karşı yapılan raporları getirme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

export default {
  createUserReport,
  getUserReports,
  updateReportStatus,
  archiveReport,
  getPendingReports,
  getReportMessages,
  getReportsAgainstUser
};
