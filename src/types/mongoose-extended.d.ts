/**
 * src/types/mongoose-extended.d.ts
 * Mongoose için genişletilmiş tip tanımlamaları
 */
import { Document, Model, Query, Schema } from 'mongoose';

// Mongoose Model için genişletilmiş tip tanımlamaları
declare module 'mongoose' {
  interface Query<ResultType, DocType, THelpers = {}, RawDocType = DocType> {
    // Mongoose 6.x'te lean() metodunun dönüş tipi için düzeltme
    lean<LeanResultType = ResultType>(): Query<LeanResultType, DocType, THelpers, RawDocType>;
  }

  // Mongoose Model için genişletilmiş tip tanımlamaları
  interface Model<T, TQueryHelpers = {}, TMethodsAndOverrides = {}, TVirtuals = {}> {
    // Mongoose 6.x'te find() metodunun dönüş tipi için düzeltme
    find(filter?: any, projection?: any, options?: any): Query<T[], T, TQueryHelpers, T>;
    
    // Mongoose 6.x'te findOne() metodunun dönüş tipi için düzeltme
    findOne(filter?: any, projection?: any, options?: any): Query<T | null, T, TQueryHelpers, T>;
    
    // Mongoose 6.x'te findById() metodunun dönüş tipi için düzeltme
    findById(id: any, projection?: any, options?: any): Query<T | null, T, TQueryHelpers, T>;
    
    // Mongoose 6.x'te findByIdAndUpdate() metodunun dönüş tipi için düzeltme
    findByIdAndUpdate(id: any, update: any, options?: any): Query<T | null, T, TQueryHelpers, T>;
    
    // Mongoose 6.x'te findByIdAndDelete() metodunun dönüş tipi için düzeltme
    findByIdAndDelete(id: any, options?: any): Query<T | null, T, TQueryHelpers, T>;
  }

  // Collection.stats() için tip tanımlaması
  interface Collection {
    stats(): Promise<any>;
  }
}
