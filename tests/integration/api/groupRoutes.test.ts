/**
 * tests/integration/api/groupRoutes.test.ts
 * Grup rotaları entegrasyon testleri
 */
import { expect } from 'chai';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../../../src/app';
import { Group } from '../../../src/models/Group';
import { User } from '../../../src/models/User';
import { generateToken } from '../../../src/utils/jwt';

describe('Group Routes', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
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
    await Group.deleteMany({});
  });

  describe('POST /api/groups', () => {
    it('should create a new group', async () => {
      const groupData = {
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('_id');
      expect(response.body.data.name).to.equal(groupData.name);
      expect(response.body.data.description).to.equal(groupData.description);
      expect(response.body.data.type).to.equal(groupData.type);
      expect(response.body.data.icon).to.equal(groupData.icon);
      expect(response.body.data.members).to.have.lengthOf(1);
      expect(response.body.data.members[0].userId.toString()).to.equal(testUser._id.toString());
      expect(response.body.data.members[0].role).to.equal('owner');
    });

    it('should return 400 if name is missing', async () => {
      const groupData = {
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Grup adı zorunludur');
    });

    it('should return 401 if not authenticated', async () => {
      const groupData = {
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
      };

      await request(app)
        .post('/api/groups')
        .send(groupData)
        .expect(401);
    });
  });

  describe('GET /api/groups', () => {
    beforeEach(async () => {
      // Test grupları oluştur
      await Group.create([
        {
          name: 'Group 1',
          description: 'Description 1',
          type: 'public',
          icon: 'icon1',
          members: [
            {
              userId: testUser._id,
              role: 'owner',
              joinedAt: new Date(),
            },
          ],
        },
        {
          name: 'Group 2',
          description: 'Description 2',
          type: 'private',
          icon: 'icon2',
          members: [
            {
              userId: testUser._id,
              role: 'member',
              joinedAt: new Date(),
            },
          ],
        },
        {
          name: 'Group 3',
          description: 'Description 3',
          type: 'public',
          icon: 'icon3',
          members: [
            {
              userId: new mongoose.Types.ObjectId(),
              role: 'owner',
              joinedAt: new Date(),
            },
          ],
        },
      ]);
    });

    it('should return user groups', async () => {
      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.lengthOf(2);
      expect(response.body.data[0].name).to.equal('Group 1');
      expect(response.body.data[1].name).to.equal('Group 2');
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .get('/api/groups')
        .expect(401);
    });
  });

  describe('GET /api/groups/:id', () => {
    let testGroup: any;

    beforeEach(async () => {
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
    });

    it('should return a group by ID', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data._id.toString()).to.equal(testGroup._id.toString());
      expect(response.body.data.name).to.equal(testGroup.name);
      expect(response.body.data.description).to.equal(testGroup.description);
      expect(response.body.data.type).to.equal(testGroup.type);
      expect(response.body.data.icon).to.equal(testGroup.icon);
    });

    it('should return 404 if group not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/groups/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Grup bulunamadı');
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .get(`/api/groups/${testGroup._id}`)
        .expect(401);
    });
  });

  describe('PUT /api/groups/:id', () => {
    let testGroup: any;

    beforeEach(async () => {
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
    });

    it('should update a group', async () => {
      const updateData = {
        name: 'Updated Group',
        description: 'Updated Description',
        type: 'private',
        icon: 'updated-icon',
      };

      const response = await request(app)
        .put(`/api/groups/${testGroup._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.name).to.equal(updateData.name);
      expect(response.body.data.description).to.equal(updateData.description);
      expect(response.body.data.type).to.equal(updateData.type);
      expect(response.body.data.icon).to.equal(updateData.icon);
    });

    it('should return 400 if name is missing', async () => {
      const updateData = {
        name: '',
        description: 'Updated Description',
      };

      const response = await request(app)
        .put(`/api/groups/${testGroup._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Grup adı zorunludur');
    });

    it('should return 404 if group not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = {
        name: 'Updated Group',
        description: 'Updated Description',
      };

      const response = await request(app)
        .put(`/api/groups/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Grup bulunamadı');
    });

    it('should return 401 if not authenticated', async () => {
      const updateData = {
        name: 'Updated Group',
        description: 'Updated Description',
      };

      await request(app)
        .put(`/api/groups/${testGroup._id}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('DELETE /api/groups/:id', () => {
    let testGroup: any;

    beforeEach(async () => {
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
    });

    it('should delete a group', async () => {
      const response = await request(app)
        .delete(`/api/groups/${testGroup._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('Grup başarıyla silindi');

      // Grubun silindiğini doğrula
      const deletedGroup = await Group.findById(testGroup._id);
      expect(deletedGroup).to.be.null;
    });

    it('should return 404 if group not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/groups/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Grup bulunamadı');
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .delete(`/api/groups/${testGroup._id}`)
        .expect(401);
    });
  });
});
