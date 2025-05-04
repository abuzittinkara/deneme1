/**
 * src/models/Role.ts
 * Rol modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { Permission } from '../types/enums';
import { ObjectId } from '../types/mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Rol izinleri arayüzü
export type RolePermissions = {
  [key in Permission]: boolean;
};

// Rol arayüzü
export interface IRole {
  name: string;
  group: ObjectId;
  color: string;
  position: number;
  permissions: RolePermissions;
}

// Rol dokümanı arayüzü
export interface RoleDocument extends TypedDocument<IRole> {}

// Rol modeli arayüzü
export interface RoleModel extends FullModelType<IRole> {
  // Özel statik metodlar buraya eklenebilir
  findByGroupAndName(groupId: ObjectId, name: string): Promise<RoleDocument | null>;
}

// Rol şeması
const RoleSchema = new Schema<RoleDocument, RoleModel>(
  {
    name: { type: String, required: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    color: { type: String, default: '#99AAB5' },
    position: { type: Number, default: 0 },
    permissions: {
      [Permission.ADMINISTRATOR]: { type: Boolean, default: false },
      [Permission.MANAGE_GROUP]: { type: Boolean, default: false },
      [Permission.MANAGE_CHANNELS]: { type: Boolean, default: false },
      [Permission.MANAGE_ROLES]: { type: Boolean, default: false },
      [Permission.MANAGE_MESSAGES]: { type: Boolean, default: false },
      [Permission.KICK_MEMBERS]: { type: Boolean, default: false },
      [Permission.BAN_MEMBERS]: { type: Boolean, default: false },
      [Permission.CREATE_INVITE]: { type: Boolean, default: true },
      [Permission.SEND_MESSAGES]: { type: Boolean, default: true },
      [Permission.READ_MESSAGES]: { type: Boolean, default: true },
      [Permission.ATTACH_FILES]: { type: Boolean, default: true },
      [Permission.CONNECT]: { type: Boolean, default: true },
      [Permission.SPEAK]: { type: Boolean, default: true },
      [Permission.USE_VOICE_ACTIVITY]: { type: Boolean, default: true },
      [Permission.PRIORITY_SPEAKER]: { type: Boolean, default: false }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// İndeksler
RoleSchema.index({ group: 1, name: 1 }, { unique: true });
RoleSchema.index({ group: 1, position: 1 });

// Statik metodlar
RoleSchema.statics.findByGroupAndName = function(
  groupId: ObjectId,
  name: string
): Promise<RoleDocument | null> {
  return this.findOne({ group: groupId, name }) as unknown as Promise<RoleDocument | null>;
};

// Rol modelini oluştur
let Role: RoleModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  Role = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByGroup: () => Promise.resolve([]),
    findByGroupAndName: () => Promise.resolve(null),
  } as unknown as RoleModel;
} else {
  // Gerçek model
  Role = (mongoose.models.Role as RoleModel) ||
    mongoose.model<RoleDocument, RoleModel>('Role', RoleSchema);
}

export default Role;
