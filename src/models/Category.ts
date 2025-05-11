/**
 * src/models/Category.ts
 * Kategori modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from '../types/mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Kategori arayüzü
export interface ICategory {
  name: string;
  group: mongoose.Types.ObjectId;
  position: number;
  channels: mongoose.Types.ObjectId[];
  isCollapsed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Kategori dokümanı arayüzü
export interface CategoryDocument extends TypedDocument<ICategory> {
  createdAt: Date;
  updatedAt: Date;
}

// Kategori modeli arayüzü
export interface CategoryModel extends FullModelType<ICategory> {
  // Özel statik metodlar
  findByGroup(groupId: mongoose.Types.ObjectId): Promise<CategoryDocument[]>;
}

// Kategori şeması
const CategorySchema = new Schema<CategoryDocument, CategoryModel>(
  {
    // Kategori adı
    name: { type: String, required: true },
    // Kategorinin ait olduğu grup
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    // Kategorinin pozisyonu
    position: { type: Number, default: 0 },
    // Kategoriye ait kanallar
    channels: [{ type: Schema.Types.ObjectId, ref: 'Channel' }],
    // Kategori daraltılmış mı?
    isCollapsed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// İndeksler
CategorySchema.index({ group: 1, position: 1 });
CategorySchema.index({ name: 'text' });

// Statik metodlar
CategorySchema.statics['findByGroup'] = function (
  groupId: mongoose.Types.ObjectId
): Promise<CategoryDocument[]> {
  return this.find({ group: groupId })
    .sort({ position: 1 })
    .populate('channels') as unknown as Promise<CategoryDocument[]>;
};

// Kategori modelini oluştur
let Category: CategoryModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  Category = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByGroup: () => Promise.resolve([]),
  } as unknown as CategoryModel;
} else {
  // Gerçek model
  Category =
    (mongoose.models['Category'] as CategoryModel) ||
    mongoose.model<CategoryDocument, CategoryModel>('Category', CategorySchema);
}

export default Category;
