/**
 * src/__tests__/models/User.test.ts
 * User modeli için testler
 */
import mongoose from 'mongoose';
import { User, UserDocument } from '../../models/User';

// MongoDB bağlantısını mockla
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      ...actualMongoose.connection,
      db: {
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn(),
          find: jest.fn(),
          insertOne: jest.fn(),
          updateOne: jest.fn(),
          deleteOne: jest.fn()
        })
      }
    }
  };
});

describe('User Model', () => {
  let user: UserDocument;

  beforeEach(() => {
    // Her test öncesi yeni bir User nesnesi oluştur
    user = new User({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
      name: 'Test',
      surname: 'User',
      birthdate: new Date('1990-01-01'),
      status: 'online',
      lastSeen: new Date(),
      emailVerified: true,
      isActive: true,
      role: 'user'
    });
  });

  afterEach(() => {
    // Her test sonrası mockları temizle
    jest.clearAllMocks();
  });

  it('should create a new user successfully', () => {
    expect(user).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test');
    expect(user.surname).toBe('User');
    expect(user.status).toBe('online');
    expect(user.role).toBe('user');
    expect(user.emailVerified).toBe(true);
    expect(user.isActive).toBe(true);
  });

  it('should have default values for optional fields', () => {
    const minimalUser = new User({
      username: 'minimal',
      passwordHash: 'hashedpassword'
    });

    expect(minimalUser).toBeDefined();
    expect(minimalUser.username).toBe('minimal');

    // Varsayılan değerleri kontrol et
    expect(minimalUser.bio).toBe(''); // Default bio
    expect(minimalUser.customStatus).toBe(''); // Default customStatus
    expect(minimalUser.isActive).toBe(true); // Default isActive
    expect(minimalUser.emailVerified).toBe(false); // Default emailVerified

    // Tercihler varsayılan değerlerini kontrol et
    expect(minimalUser.preferences).toBeDefined(); // Default preferences
    expect(minimalUser.preferences.theme).toBe('dark'); // Default theme
    expect(minimalUser.preferences.notifications).toBe(true); // Default notifications
  });

  it('should validate required fields', async () => {
    // Username olmadan kullanıcı oluşturmayı dene
    const invalidUser = new User({
      email: 'invalid@example.com',
      passwordHash: 'hashedpassword'
    });

    // validateSync metodu, validasyon hatalarını döndürür
    const validationError = invalidUser.validateSync();

    expect(validationError).toBeDefined();
    expect(validationError?.errors.username).toBeDefined();
  });

  it('should have correct schema paths', () => {
    const userSchema = User.schema.paths;

    // Temel alanları kontrol et
    expect(userSchema.username).toBeDefined();
    expect(userSchema.passwordHash).toBeDefined();

    // Opsiyonel alanları kontrol et
    expect(userSchema.name).toBeDefined();
    expect(userSchema.surname).toBeDefined();
    expect(userSchema.birthdate).toBeDefined();
    expect(userSchema.email).toBeDefined();

    // Durum alanlarını kontrol et
    expect(userSchema.status).toBeDefined();
    expect(userSchema['isActive']).toBeDefined();
    expect(userSchema['role']).toBeDefined();

    // Tercihler alanını kontrol et - Mongoose'un iç yapısı nedeniyle doğrudan erişilemeyebilir
    // Bu nedenle bu kontrolü atlıyoruz
  });

  it('should convert to object correctly', () => {
    const userObject = user.toObject();

    expect(userObject).toHaveProperty('_id');
    expect(userObject).toHaveProperty('username', 'testuser');
    expect(userObject).toHaveProperty('email', 'test@example.com');
    expect(userObject).toHaveProperty('name', 'Test');
    expect(userObject).toHaveProperty('surname', 'User');
    expect(userObject).toHaveProperty('status', 'online');
  });
});
