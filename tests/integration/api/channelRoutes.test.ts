/**
 * tests/integration/api/channelRoutes.test.ts
 * Kanal rotaları entegrasyon testleri
 */
import { expect } from 'chai';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../../../src/app';
import { Channel } from '../../../src/models/Channel';
import { Group } from '../../../src/models/Group';
import { User } from '../../../src/models/User';
import { generateToken } from '../../../src/utils/jwt';

describe('Channel Routes', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let testGroup: any;
  let authToken: string;

  before(async () => {
    // MongoDB bellek sunucusu başlat
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // MongoDB'ye bağlan
    await mongoose.connect(mongoUri);

    // Test kullanıcısı oluştur
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedPassword',
    });

    // Test grubu oluştur
    testGroup = await Group.create({
      name: 'Test Group',
      description: 'Test Description',
      type: 'public',
      icon: 'test-icon',
      members: [
        {
          userId: testUser._id,
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
    });

    // JWT token oluştur
    authToken = generateToken(testUser._id.toString());
  });

  after(async () => {
    // Bağlantıyı kapat
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Koleksiyonları temizle
    await Channel.deleteMany({});
  });

  describe('POST /api/channels', () => {
    it('should create a new channel', async () => {
      const channelData = {
        name: 'test-channel',
        description: 'Test Channel Description',
        type: 'text',
        groupId: testGroup._id.toString(),
      };

      const response = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send(channelData)
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('_id');
      expect(response.body.data.name).to.equal(channelData.name);
      expect(response.body.data.description).to.equal(channelData.description);
      expect(response.body.data.type).to.equal(channelData.type);
      expect(response.body.data.groupId.toString()).to.equal(testGroup._id.toString());
      expect(response.body.data.createdBy.toString()).to.equal(testUser._id.toString());
    });

    it('should return 400 if name is missing', async () => {
      const channelData = {
        description: 'Test Channel Description',
        type: 'text',
        groupId: testGroup._id.toString(),
      };

      const response = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send(channelData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Kanal adı zorunludur');
    });

    it('should return 400 if type is invalid', async () => {
      const channelData = {
        name: 'test-channel',
        description: 'Test Channel Description',
        type: 'invalid-type',
        groupId: testGroup._id.toString(),
      };

      const response = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send(channelData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Geçerli bir kanal tipi belirtilmelidir');
    });

    it('should return 400 if groupId is missing', async () => {
      const channelData = {
        name: 'test-channel',
        description: 'Test Channel Description',
        type: 'text',
      };

      const response = await request(app)
        .post('/api/channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send(channelData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Grup ID zorunludur');
    });

    it('should return 401 if not authenticated', async () => {
      const channelData = {
        name: 'test-channel',
        description: 'Test Channel Description',
        type: 'text',
        groupId: testGroup._id.toString(),
      };

      await request(app)
        .post('/api/channels')
        .send(channelData)
        .expect(401);
    });
  });

  describe('GET /api/channels/group/:groupId', () => {
    beforeEach(async () => {
      // Test kanalları oluştur
      await Channel.create([
        {
          name: 'channel-1',
          description: 'Channel 1 Description',
          type: 'text',
          groupId: testGroup._id,
          createdBy: testUser._id,
        },
        {
          name: 'channel-2',
          description: 'Channel 2 Description',
          type: 'voice',
          groupId: testGroup._id,
          createdBy: testUser._id,
        },
        {
          name: 'channel-3',
          description: 'Channel 3 Description',
          type: 'text',
          groupId: new mongoose.Types.ObjectId(),
          createdBy: testUser._id,
        },
      ]);
    });

    it('should return channels for a group', async () => {
      const response = await request(app)
        .get(`/api/channels/group/${testGroup._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.lengthOf(2);
      expect(response.body.data[0].name).to.equal('channel-1');
      expect(response.body.data[1].name).to.equal('channel-2');
    });

    it('should return empty array if no channels found', async () => {
      const nonExistentGroupId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/channels/group/${nonExistentGroupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.lengthOf(0);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .get(`/api/channels/group/${testGroup._id}`)
        .expect(401);
    });
  });

  describe('GET /api/channels/:id', () => {
    let testChannel: any;

    beforeEach(async () => {
      // Test kanalı oluştur
      testChannel = await Channel.create({
        name: 'test-channel',
        description: 'Test Channel Description',
        type: 'text',
        groupId: testGroup._id,
        createdBy: testUser._id,
      });
    });

    it('should return a channel by ID', async () => {
      const response = await request(app)
        .get(`/api/channels/${testChannel._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data._id.toString()).to.equal(testChannel._id.toString());
      expect(response.body.data.name).to.equal(testChannel.name);
      expect(response.body.data.description).to.equal(testChannel.description);
      expect(response.body.data.type).to.equal(testChannel.type);
      expect(response.body.data.groupId.toString()).to.equal(testGroup._id.toString());
    });

    it('should return 404 if channel not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/channels/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Kanal bulunamadı');
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .get(`/api/channels/${testChannel._id}`)
        .expect(401);
    });
  });

  describe('PUT /api/channels/:id', () => {
    let testChannel: any;

    beforeEach(async () => {
      // Test kanalı oluştur
      testChannel = await Channel.create({
        name: 'test-channel',
        description: 'Test Channel Description',
        type: 'text',
        groupId: testGroup._id,
        createdBy: testUser._id,
      });
    });

    it('should update a channel', async () => {
      const updateData = {
        name: 'updated-channel',
        description: 'Updated Channel Description',
      };

      const response = await request(app)
        .put(`/api/channels/${testChannel._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.name).to.equal(updateData.name);
      expect(response.body.data.description).to.equal(updateData.description);
      expect(response.body.data.type).to.equal(testChannel.type);
      expect(response.body.data.groupId.toString()).to.equal(testGroup._id.toString());
    });

    it('should return 400 if name is missing', async () => {
      const updateData = {
        name: '',
        description: 'Updated Channel Description',
      };

      const response = await request(app)
        .put(`/api/channels/${testChannel._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Kanal adı zorunludur');
    });

    it('should return 404 if channel not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = {
        name: 'updated-channel',
        description: 'Updated Channel Description',
      };

      const response = await request(app)
        .put(`/api/channels/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Kanal bulunamadı');
    });

    it('should return 401 if not authenticated', async () => {
      const updateData = {
        name: 'updated-channel',
        description: 'Updated Channel Description',
      };

      await request(app)
        .put(`/api/channels/${testChannel._id}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('DELETE /api/channels/:id', () => {
    let testChannel: any;

    beforeEach(async () => {
      // Test kanalı oluştur
      testChannel = await Channel.create({
        name: 'test-channel',
        description: 'Test Channel Description',
        type: 'text',
        groupId: testGroup._id,
        createdBy: testUser._id,
      });
    });

    it('should delete a channel', async () => {
      const response = await request(app)
        .delete(`/api/channels/${testChannel._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('Kanal başarıyla silindi');

      // Kanalın silindiğini doğrula
      const deletedChannel = await Channel.findById(testChannel._id);
      expect(deletedChannel).to.be.null;
    });

    it('should return 404 if channel not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/channels/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Kanal bulunamadı');
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .delete(`/api/channels/${testChannel._id}`)
        .expect(401);
    });
  });
});
