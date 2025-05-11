/**
 * src/modules/user/reportManager.ts
 * Kullanıcı raporlama işlemleri
 */
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { toObjectId } from '../../types/mongoose';

// Rapor nedenleri
export enum ReportReason {
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HATE_SPEECH = 'hate_speech',
  IMPERSONATION = 'impersonation',
  OTHER = 'other',
}

// Rapor durumları
export enum ReportStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

// Rapor oluşturma parametreleri
export interface CreateReportParams {
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  details?: string;
  evidence?: string[];
}

// Rapor sonucu
export interface ReportResult {
  id: string;
  reporter: {
    id: string;
    username: string;
  };
  reportedUser: {
    id: string;
    username: string;
  };
  reason: ReportReason;
  details?: string;
  evidence?: string[];
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Kullanıcı raporu oluşturur
 * @param params - Rapor parametreleri
 * @returns Oluşturulan rapor
 */
export async function createReport(params: CreateReportParams): Promise<ReportResult> {
  try {
    const { reporterId, reportedUserId, reason, details, evidence } = params;

    // Kendini raporlama kontrolü
    if (reporterId === reportedUserId) {
      throw new ValidationError('Kendinizi raporlayamazsınız');
    }

    // Kullanıcıları kontrol et
    const reporter = await User.findById(reporterId);
    if (!reporter) {
      throw new NotFoundError('Raporlayan kullanıcı bulunamadı');
    }

    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      throw new NotFoundError('Raporlanan kullanıcı bulunamadı');
    }

    // Rapor oluştur
    const report = await UserReport.create({
      reporter: toObjectId(reporterId),
      reportedUser: toObjectId(reportedUserId),
      reason,
      details: details || '',
      evidence: evidence || [],
      status: ReportStatus.PENDING,
    });

    // Raporu getir
    const populatedReport = await UserReport.findById(report._id)
      .populate('reporter', 'username')
      .populate('reportedUser', 'username');

    logger.info('Kullanıcı raporu oluşturuldu', {
      reportId: report._id,
      reporterId,
      reportedUserId,
      reason,
    });

    // Rapor sonucunu formatla
    return {
      id: populatedReport!._id.toString(),
      reporter: {
        id: (populatedReport!.reporter as any)._id.toString(),
        username: (populatedReport!.reporter as any).username,
      },
      reportedUser: {
        id: (populatedReport!.reportedUser as any)._id.toString(),
        username: (populatedReport!.reportedUser as any).username,
      },
      reason: populatedReport!.reason,
      details: populatedReport!.details,
      evidence: populatedReport!.evidence,
      status: populatedReport!.status,
      createdAt: populatedReport!.createdAt,
      updatedAt: populatedReport!.updatedAt,
    };
  } catch (error) {
    logger.error('Kullanıcı raporu oluşturma hatası', {
      error: (error as Error).message,
      reporterId: params.reporterId,
      reportedUserId: params.reportedUserId,
    });
    throw error;
  }
}

/**
 * Kullanıcının raporlarını getirir
 * @param userId - Kullanıcı ID'si
 * @returns Kullanıcının raporları
 */
export async function getUserReports(userId: string): Promise<ReportResult[]> {
  try {
    // Kullanıcıyı kontrol et
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kullanıcının raporlarını getir
    const reports = await UserReport.find({ reporter: toObjectId(userId) })
      .populate('reporter', 'username')
      .populate('reportedUser', 'username')
      .sort({ createdAt: -1 });

    // Raporları formatla
    const formattedReports = reports.map((report) => ({
      id: report._id.toString(),
      reporter: {
        id: (report.reporter as any)._id.toString(),
        username: (report.reporter as any).username,
      },
      reportedUser: {
        id: (report.reportedUser as any)._id.toString(),
        username: (report.reportedUser as any).username,
      },
      reason: report.reason,
      details: report.details,
      evidence: report.evidence,
      status: report.status,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

    logger.debug('Kullanıcı raporları getirildi', {
      userId,
      count: formattedReports.length,
    });

    return formattedReports;
  } catch (error) {
    logger.error('Kullanıcı raporlarını getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Rapor durumunu günceller (sadece admin)
 * @param reportId - Rapor ID'si
 * @param status - Yeni durum
 * @returns Güncellenmiş rapor
 */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus
): Promise<ReportResult> {
  try {
    // Raporu bul
    const report = await UserReport.findById(reportId);
    if (!report) {
      throw new NotFoundError('Rapor bulunamadı');
    }

    // Durumu güncelle
    report.status = status;
    await report.save();

    // Güncellenmiş raporu getir
    const updatedReport = await UserReport.findById(reportId)
      .populate('reporter', 'username')
      .populate('reportedUser', 'username');

    logger.info('Rapor durumu güncellendi', {
      reportId,
      status,
    });

    // Rapor sonucunu formatla
    return {
      id: updatedReport!._id.toString(),
      reporter: {
        id: (updatedReport!.reporter as any)._id.toString(),
        username: (updatedReport!.reporter as any).username,
      },
      reportedUser: {
        id: (updatedReport!.reportedUser as any)._id.toString(),
        username: (updatedReport!.reportedUser as any).username,
      },
      reason: updatedReport!.reason,
      details: updatedReport!.details,
      evidence: updatedReport!.evidence,
      status: updatedReport!.status,
      createdAt: updatedReport!.createdAt,
      updatedAt: updatedReport!.updatedAt,
    };
  } catch (error) {
    logger.error('Rapor durumu güncelleme hatası', {
      error: (error as Error).message,
      reportId,
      status,
    });
    throw error;
  }
}

// Kullanıcı raporu dokümanı arayüzü
interface UserReportDocument extends mongoose.Document {
  reporter: mongoose.Types.ObjectId;
  reportedUser: mongoose.Types.ObjectId;
  reason: ReportReason;
  details: string;
  evidence: string[];
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Kullanıcı raporu şeması
const UserReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: Object.values(ReportReason),
      required: true,
    },
    details: { type: String, default: '' },
    evidence: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
    },
  },
  { timestamps: true }
);

// İndeksler
UserReportSchema.index({ reporter: 1, reportedUser: 1 });
UserReportSchema.index({ status: 1 });
UserReportSchema.index({ createdAt: 1 });

// Kullanıcı raporu modelini oluştur
const UserReport = mongoose.model<UserReportDocument>('UserReport', UserReportSchema);

export default {
  ReportReason,
  ReportStatus,
  createReport,
  getUserReports,
  updateReportStatus,
};
