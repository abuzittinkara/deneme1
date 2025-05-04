/**
 * src/models/FileAttachment.ts
 * Dosya eki modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from '../types/mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Dosya eki arayüzü
export interface IFileAttachment {
  originalName: string;
  serverFilename: string;
  mimeType: string;
  size: number;
  uploadDate: Date;
  uploader: ObjectId;
  message?: ObjectId;
  dmMessage?: ObjectId;
  path: string;
}

// Dosya eki dokümanı arayüzü
export interface FileAttachmentDocument extends TypedDocument<IFileAttachment> {}

// Dosya eki modeli arayüzü
export interface FileAttachmentModel extends FullModelType<IFileAttachment> {}

// Dosya eki şeması
const FileAttachmentSchema = new Schema<FileAttachmentDocument, FileAttachmentModel>(
  {
    // Original filename provided by the user
    originalName: { type: String, required: true },
    // Server-generated filename (to avoid conflicts)
    serverFilename: { type: String, required: true, unique: true },
    // MIME type of the file
    mimeType: { type: String, required: true },
    // File size in bytes
    size: { type: Number, required: true },
    // Upload timestamp
    uploadDate: { type: Date, default: Date.now },
    // User who uploaded the file
    uploader: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Message this file is attached to (optional - could be null for profile pictures)
    message: { type: Schema.Types.ObjectId, ref: 'Message' },
    // DM message this file is attached to (optional)
    dmMessage: { type: Schema.Types.ObjectId, ref: 'DMMessage' },
    // Path where the file is stored on the server
    path: { type: String, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// İndeksler
FileAttachmentSchema.index({ uploader: 1, uploadDate: -1 });
FileAttachmentSchema.index({ message: 1 });
FileAttachmentSchema.index({ dmMessage: 1 });
FileAttachmentSchema.index({ mimeType: 1 });

// Dosya eki modelini oluştur
let FileAttachment: FileAttachmentModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  FileAttachment = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
  } as unknown as FileAttachmentModel;
} else {
  // Gerçek model
  FileAttachment = (mongoose.models.FileAttachment as FileAttachmentModel) ||
    mongoose.model<FileAttachmentDocument, FileAttachmentModel>('FileAttachment', FileAttachmentSchema);
}

export default FileAttachment;
