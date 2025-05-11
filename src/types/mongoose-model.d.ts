/**
 * src/types/mongoose-model.d.ts
 * Mongoose Model için genişletilmiş tip tanımlamaları
 */
import { Document, Model, Query, Schema } from 'mongoose';

// Mongoose Model için genişletilmiş tip tanımlamaları
declare module 'mongoose' {
  // Mongoose 6.x için Model tipi düzeltmesi
  interface Model<
    TRawDocType = any,
    TQueryHelpers = {},
    TInstanceMethods = {},
    TVirtuals = {},
    THydratedDocumentType = Document<unknown, {}, TRawDocType> &
      Omit<TRawDocType & Document, 'typeKey'>,
    TModelSchema = any,
    TSchemaOptions = any,
    TTimestamps = any,
  > {
    // Mongoose 6.x'te find() metodunun dönüş tipi için düzeltme
    find(
      filter?: any,
      projection?: any,
      options?: any
    ): Query<Document[], Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te findOne() metodunun dönüş tipi için düzeltme
    findOne(
      filter?: any,
      projection?: any,
      options?: any
    ): Query<Document | null, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te findById() metodunun dönüş tipi için düzeltme
    findById(
      id: any,
      projection?: any,
      options?: any
    ): Query<Document | null, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te findByIdAndUpdate() metodunun dönüş tipi için düzeltme
    findByIdAndUpdate(
      id: any,
      update: any,
      options?: any
    ): Query<Document | null, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te findByIdAndDelete() metodunun dönüş tipi için düzeltme
    findByIdAndDelete(
      id: any,
      options?: any
    ): Query<Document | null, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te updateOne() metodunun dönüş tipi için düzeltme
    updateOne(
      filter?: any,
      update?: any,
      options?: any
    ): Query<any, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te updateMany() metodunun dönüş tipi için düzeltme
    updateMany(
      filter?: any,
      update?: any,
      options?: any
    ): Query<any, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te deleteOne() metodunun dönüş tipi için düzeltme
    deleteOne(filter?: any, options?: any): Query<any, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te deleteMany() metodunun dönüş tipi için düzeltme
    deleteMany(filter?: any, options?: any): Query<any, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te countDocuments() metodunun dönüş tipi için düzeltme
    countDocuments(
      filter?: any,
      options?: any
    ): Query<number, Document, TQueryHelpers, TRawDocType>;

    // Mongoose 6.x'te create() metodunun dönüş tipi için düzeltme
    create(docs: any[], options?: any): Promise<Document[]>;
    create(doc: any, options?: any): Promise<Document>;
    create(...docs: any[]): Promise<Document[]>;

    // Mongoose 6.x'te findOneAndUpdate() metodunun dönüş tipi için düzeltme
    findOneAndUpdate(
      filter?: any,
      update?: any,
      options?: any
    ): Query<Document | null, Document, TQueryHelpers, TRawDocType>;
  }
}
