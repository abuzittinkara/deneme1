/**
 * src/models/File.ts
 * Dosya modeli
 */
import mongoose, { Document, Schema } from 'mongoose';

// Dosya türleri
export type FileType = 'image' | 'audio' | 'video' | 'document' | 'other';

// Dosya arayüzü
export interface FileDocument extends Document {
  originalName: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileType: FileType;
  mimeType: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;
  thumbnail?: {
    fileName: string;
    filePath: string;
    fileUrl: string;
    width: number;
    height: number;
  };
  metadata?: Record<string, any>;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Dosya şeması
const FileSchema = new Schema<FileDocument>(
  {
    originalName: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true,
      unique: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      required: true,
      enum: ['image', 'audio', 'video', 'document', 'other'],
      index: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    dimensions: {
      width: Number,
      height: Number
    },
    duration: {
      type: Number
    },
    thumbnail: {
      fileName: String,
      filePath: String,
      fileUrl: String,
      width: Number,
      height: Number
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Dosya model arayüzü
export interface FileModel extends mongoose.Model<FileDocument> {
  // Özel model metodları buraya eklenebilir
}

// Dosya modeli
let File: FileModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  File = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
  } as unknown as FileModel;
} else {
  // Gerçek model
  File = mongoose.model<FileDocument, FileModel>('File', FileSchema);
}

export default File;
