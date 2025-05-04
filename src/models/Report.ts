/**
 * src/models/Report.ts
 * Rapor modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Rapor nedeni tipi
export type ReportReason = 'harassment' | 'spam' | 'inappropriate_content' | 'threats' | 'impersonation' | 'other';

// Rapor durumu tipi
export type ReportStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';

// Rapor arayüzü
export interface IReport {
  reporter: mongoose.Types.ObjectId;
  reportedUser: mongoose.Types.ObjectId;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  relatedMessages?: mongoose.Types.ObjectId[];
  relatedDMMessages?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolution?: string;
  isArchived: boolean;
}

// Rapor dokümanı arayüzü
export interface ReportDocument extends TypedDocument<IReport> {}

// Rapor modeli arayüzü
export interface ReportModel extends FullModelType<IReport> {
  // Özel statik metodlar buraya eklenebilir
  findPendingReports(): Promise<ReportDocument[]>;
  findByReporter(userId: mongoose.Types.ObjectId): Promise<ReportDocument[]>;
}

// Rapor şeması
const ReportSchema = new Schema<ReportDocument, ReportModel>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: [
        'harassment',
        'spam',
        'inappropriate_content',
        'threats',
        'impersonation',
        'other'
      ],
      required: true
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'dismissed'],
      default: 'pending'
    },
    relatedMessages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    relatedDMMessages: [{ type: Schema.Types.ObjectId, ref: 'DMMessage' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolution: { type: String },
    isArchived: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

// İndeksler
ReportSchema.index({ reporter: 1, createdAt: -1 });
ReportSchema.index({ reportedUser: 1 });
ReportSchema.index({ status: 1 });
ReportSchema.index({ createdAt: -1 });
ReportSchema.index({ isArchived: 1 });

// Statik metodlar
ReportSchema.statics.findPendingReports = function(): Promise<ReportDocument[]> {
  return this.find({ status: 'pending', isArchived: false })
    .sort({ createdAt: 1 })
    .populate('reporter', 'username')
    .populate('reportedUser', 'username') as unknown as Promise<ReportDocument[]>;
};

ReportSchema.statics.findByReporter = function(userId: mongoose.Types.ObjectId): Promise<ReportDocument[]> {
  return this.find({ reporter: userId })
    .sort({ createdAt: -1 })
    .populate('reportedUser', 'username') as unknown as Promise<ReportDocument[]>;
};

// Rapor modelini oluştur
let Report: ReportModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  Report = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByStatus: () => Promise.resolve([]),
    findByReporter: () => Promise.resolve([]),
  } as unknown as ReportModel;
} else {
  // Gerçek model
  Report = (mongoose.models.Report as ReportModel) ||
    mongoose.model<ReportDocument, ReportModel>('Report', ReportSchema);
}

export default Report;
