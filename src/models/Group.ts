/**
 * src/models/Group.ts
 * Grup modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Grup arayüzü
export interface IGroup {
  groupId: string;
  name: string;
  owner: mongoose.Types.ObjectId;
  users: mongoose.Types.ObjectId[];
  channels: mongoose.Types.ObjectId[];
  defaultRole?: mongoose.Types.ObjectId;
  description: string;
  icon?: mongoose.Types.ObjectId;
  type: 'public' | 'private' | 'secret';
  rules?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Grup dokümanı arayüzü
export interface GroupDocument extends TypedDocument<IGroup> {
  createdAt: Date;
  updatedAt: Date;
}

// Grup modeli arayüzü
export interface GroupModel extends FullModelType<IGroup> {
  // Özel statik metodlar buraya eklenebilir
  findByGroupId(groupId: string): Promise<GroupDocument | null>;
}

// Grup şeması
const GroupSchema = new Schema<GroupDocument, GroupModel>(
  {
    // Uygulamada grup için oluşturduğumuz rastgele UUID
    groupId: { type: String, required: true, unique: true },
    // Grup ismi
    name: { type: String, required: true },
    // Grubu oluşturan kişinin User tablosundaki _id değeri
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Bu gruba üye tüm kullanıcıların _id değerleri
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // Gruba ait kanallar
    channels: [{ type: Schema.Types.ObjectId, ref: 'Channel' }],
    // Varsayılan rol
    defaultRole: { type: Schema.Types.ObjectId, ref: 'Role' },
    // Grup açıklaması
    description: { type: String, default: '' },
    // Grup ikonunun dosya ID'si
    icon: { type: Schema.Types.ObjectId, ref: 'FileAttachment' },
    // Grup türü
    type: { type: String, enum: ['public', 'private', 'secret'], default: 'public' },
    // Grup kuralları
    rules: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// İndeksler
// Şema tanımında index: true kullanıldığı için burada tekrar tanımlamıyoruz
// Sadece özel indeksleri tanımlıyoruz
GroupSchema.index({ owner: 1 });
GroupSchema.index({ name: 'text', description: 'text' });

// Statik metodlar
GroupSchema.statics['findByGroupId'] = function (groupId: string): Promise<GroupDocument | null> {
  return this.findOne({ groupId }) as unknown as Promise<GroupDocument | null>;
};

// Grup modelini oluştur
let GroupModel_: GroupModel;

// Gerçek model
GroupModel_ =
  (mongoose.models['Group'] as GroupModel) ||
  mongoose.model<GroupDocument, GroupModel>('Group', GroupSchema);

// Hem default export hem de named export sağla
export const Group = GroupModel_;
export default GroupModel_;
