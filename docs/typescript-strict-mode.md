# TypeScript Strict Mode Geçiş Planı

Bu belge, projenin TypeScript strict mode'a geçiş planını içerir. TypeScript strict mode, daha güvenli ve daha sağlam kod yazmanıza yardımcı olan bir dizi kontrol içerir.

## Strict Mode Flagleri

TypeScript strict mode, aşağıdaki flagleri içerir:

1. **noImplicitAny**: Değişkenlerin tipinin açıkça belirtilmesini zorunlu kılar.
2. **strictNullChecks**: `null` ve `undefined` değerlerinin diğer tiplerle uyumlu olmadığını kontrol eder.
3. **strictFunctionTypes**: Fonksiyon parametrelerinin tiplerini daha sıkı kontrol eder.
4. **strictPropertyInitialization**: Sınıf özelliklerinin constructor'da veya property initializer'da başlatılmasını zorunlu kılar.
5. **noImplicitThis**: `this` anahtar kelimesinin tipinin açıkça belirtilmesini zorunlu kılar.
6. **alwaysStrict**: JavaScript'in strict mode'da çalışmasını sağlar.

## Mevcut Durum

Projenin mevcut durumunda, strict mode flagleri aşağıdaki gibi ayarlanmıştır:

```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,
    "strictFunctionTypes": false,
    "strictBindCallApply": true,
    "strictPropertyInitialization": false,
    "noImplicitThis": false,
    "alwaysStrict": true
  }
}
```

## Strict Mode Kontrol Sonuçları

Her bir strict mode flag'i için kontrol sonuçları aşağıdaki gibidir:

### 1. noImplicitAny

**Sonuç**: ❌ Başarısız (2 hata)

**Hatalar**:
- `src/config/swagger.ts:41:9`: Object literal's property 'bearerAuth' implicitly has an 'any[]' type.
- `src/routes/setup.ts:18:16`: Argument of type 'Application' is not assignable to parameter of type 'Express'.

### 2. strictNullChecks

**Sonuç**: ❌ Başarısız (86 hata)

**Hatalar**:
- 39 farklı dosyada 86 hata bulundu.
- En yaygın hatalar:
  - 'x is of type unknown' hataları
  - 'x is possibly undefined' hataları
  - Argument of type 'null' is not assignable to parameter of type 'ProjectionType<...> | undefined'

### 3. strictFunctionTypes

**Sonuç**: ❌ Başarısız (1 hata)

**Hatalar**:
- `src/routes/setup.ts:18:16`: Argument of type 'Application' is not assignable to parameter of type 'Express'.

### 4. strictPropertyInitialization

**Sonuç**: ❌ Başarısız (1 hata)

**Hatalar**:
- `tsconfig.temp.json:4:5`: Option 'strictPropertyInitialization' cannot be specified without specifying option 'strictNullChecks'.

### 5. noImplicitThis

**Sonuç**: ❌ Başarısız (1 hata)

**Hatalar**:
- `src/routes/setup.ts:18:16`: Argument of type 'Application' is not assignable to parameter of type 'Express'.

### 6. alwaysStrict

**Sonuç**: ❌ Başarısız (1 hata)

**Hatalar**:
- `src/routes/setup.ts:18:16`: Argument of type 'Application' is not assignable to parameter of type 'Express'.

## Geçiş Planı

Strict mode'a geçiş için aşağıdaki adımları izleyeceğiz:

1. **Ortak Hataları Düzelt**:
   - `src/routes/setup.ts:18:16` hatasını düzelt (tüm flaglerde ortak)
   - `src/config/swagger.ts:41:9` hatasını düzelt

2. **Flag'leri Kademeli Olarak Etkinleştir**:
   - Önce `alwaysStrict` (zaten etkin)
   - Sonra `noImplicitThis`
   - Sonra `strictFunctionTypes`
   - Sonra `noImplicitAny`
   - Sonra `strictNullChecks`
   - En son `strictPropertyInitialization` (strictNullChecks gerektirir)

3. **Her Flag İçin Adımlar**:
   - Flag'i etkinleştir
   - Hataları düzelt
   - Testleri çalıştır
   - Değişiklikleri commit et

4. **Tüm Flag'ler Etkinleştirildikten Sonra**:
   - `strict: true` olarak ayarla
   - Testleri çalıştır
   - Değişiklikleri commit et

## Öncelikli Düzeltmeler

1. **src/routes/setup.ts:18:16** hatasını düzelt:
   ```typescript
   // Hatalı
   setupSwagger(app);
   
   // Düzeltme
   setupSwagger(app as Express);
   ```

2. **src/config/swagger.ts:41:9** hatasını düzelt:
   ```typescript
   // Hatalı
   bearerAuth: []
   
   // Düzeltme
   bearerAuth: [] as string[]
   ```

## Sonraki Adımlar

1. Ortak hataları düzelt
2. `noImplicitThis` flag'ini etkinleştir ve hataları düzelt
3. `strictFunctionTypes` flag'ini etkinleştir ve hataları düzelt
4. `noImplicitAny` flag'ini etkinleştir ve hataları düzelt
5. `strictNullChecks` flag'ini etkinleştir ve hataları düzelt
6. `strictPropertyInitialization` flag'ini etkinleştir ve hataları düzelt
7. `strict: true` olarak ayarla

## Kaynaklar

- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [TypeScript Handbook: Strict Mode](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#strictness)
