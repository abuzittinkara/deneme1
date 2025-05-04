/**
 * src/models/GroupMember.ts
 * Grup üyesi modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from '../types/mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Grup üyesi arayüzü
export interface IGroupMember {
  user: ObjectId;
  group: ObjectId;
  roles: ObjectId[];
  nickname?: string;
  joinedAt: Date;
}

// Grup üyesi dokümanı arayüzü
export interface GroupMemberDocument extends TypedDocument<IGroupMember> {}

// Grup üyesi modeli arayüzü
export interface GroupMemberModel extends FullModelType<IGroupMember> {
  // Özel statik metodlar buraya eklenebilir
  findByUserAndGroup(userId: ObjectId, groupId: ObjectId): Promise<GroupMemberDocument | null>;
}

// Grup üyesi şeması
const GroupMemberSchema = new Schema<GroupMemberDocument, GroupMemberModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    nickname: { type: String },
    joinedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Kullanıcı başına grup için benzersiz kayıt
GroupMemberSchema.index({ user: 1, group: 1 }, { unique: true });
GroupMemberSchema.index({ group: 1 });
GroupMemberSchema.index({ user: 1 });
GroupMemberSchema.index({ joinedAt: -1 });

// Statik metodlar
GroupMemberSchema.statics.findByUserAndGroup = function(
  userId: ObjectId,
  groupId: ObjectId
): Promise<GroupMemberDocument | null> {
  return this.findOne({ user: userId, group: groupId }) as unknown as Promise<GroupMemberDocument | null>;
};

// Grup üyesi modelini oluştur
let GroupMember: GroupMemberModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  GroupMember = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByUserAndGroup: () => Promise.resolve(null),
  } as unknown as GroupMemberModel;
} else {
  // Gerçek model
  GroupMember = (mongoose.models.GroupMember as GroupMemberModel) ||
    mongoose.model<GroupMemberDocument, GroupMemberModel>('GroupMember', GroupMemberSchema);
}

export default GroupMember;
