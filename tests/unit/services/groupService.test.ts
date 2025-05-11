/**
 * tests/unit/services/groupService.test.ts
 * Grup servisi birim testleri
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { groupService } from '../../../src/services/groupService';
import { Group } from '../../../src/models/Group';
import { Channel } from '../../../src/models/Channel';

describe('GroupService', () => {
  // Test öncesi ve sonrası işlemler
  beforeEach(() => {
    // Stub'ları temizle
    sinon.restore();
  });

  after(() => {
    // Tüm stub'ları temizle
    sinon.restore();
  });

  describe('createGroup', () => {
    it('should create a new group with default channels', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();
      const groupData = {
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
        createdBy: userId,
      };

      const savedGroup = {
        _id: new mongoose.Types.ObjectId(),
        ...groupData,
        members: [
          {
            userId,
            role: 'owner',
            joinedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedChannels = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'genel',
          type: 'text',
          groupId: savedGroup._id,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'sesli-sohbet',
          type: 'voice',
          groupId: savedGroup._id,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Group.create stub
      const groupCreateStub = sinon.stub(Group, 'create').resolves(savedGroup);

      // Channel.create stub
      const channelCreateStub = sinon.stub(Channel, 'create');
      channelCreateStub.onFirstCall().resolves(savedChannels[0]);
      channelCreateStub.onSecondCall().resolves(savedChannels[1]);

      // Act
      const result = await groupService.createGroup(groupData);

      // Assert
      expect(groupCreateStub.calledOnce).to.be.true;
      expect(groupCreateStub.firstCall.args[0]).to.deep.include({
        name: groupData.name,
        description: groupData.description,
        type: groupData.type,
        icon: groupData.icon,
        createdBy: userId,
      });
      expect(channelCreateStub.calledTwice).to.be.true;
      expect(result).to.have.property('_id');
      expect(result.name).to.equal(groupData.name);
      expect(result.members).to.have.lengthOf(1);
      expect(result.members[0].userId.toString()).to.equal(userId);
      expect(result.members[0].role).to.equal('owner');
    });

    it('should throw an error if group creation fails', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();
      const groupData = {
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
        createdBy: userId,
      };

      // Group.create stub
      const createStub = sinon.stub(Group, 'create').rejects(new Error('Database error'));

      // Act & Assert
      try {
        await groupService.createGroup(groupData);
        // Eğer buraya gelirse test başarısız olur
        expect.fail('Expected error was not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('Database error');
      }
      expect(createStub.calledOnce).to.be.true;
    });
  });

  describe('getGroupById', () => {
    it('should return a group by ID', async () => {
      // Arrange
      const groupId = new mongoose.Types.ObjectId().toString();
      const group = {
        _id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
        members: [
          {
            userId: new mongoose.Types.ObjectId(),
            role: 'owner',
            joinedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Group.findById stub
      const findByIdStub = sinon.stub(Group, 'findById').resolves(group);

      // Act
      const result = await groupService.getGroupById(groupId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(findByIdStub.firstCall.args[0]).to.equal(groupId);
      expect(result).to.deep.equal(group);
    });

    it('should return null if group not found', async () => {
      // Arrange
      const groupId = new mongoose.Types.ObjectId().toString();

      // Group.findById stub
      const findByIdStub = sinon.stub(Group, 'findById').resolves(null);

      // Act
      const result = await groupService.getGroupById(groupId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(result).to.be.null;
    });
  });

  describe('updateGroup', () => {
    it('should update a group if user is owner', async () => {
      // Arrange
      const groupId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const updateData = {
        name: 'Updated Group',
        description: 'Updated Description',
      };

      const group = {
        _id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
        members: [
          {
            userId,
            role: 'owner',
            joinedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedGroup = {
        ...group,
        name: updateData.name,
        description: updateData.description,
        updatedAt: new Date(),
      };

      // Group.findById stub
      const findByIdStub = sinon.stub(Group, 'findById').resolves(group);

      // Group.findByIdAndUpdate stub
      const findByIdAndUpdateStub = sinon.stub(Group, 'findByIdAndUpdate').resolves(updatedGroup);

      // Act
      const result = await groupService.updateGroup(groupId, updateData, userId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(findByIdAndUpdateStub.calledOnce).to.be.true;
      expect(findByIdAndUpdateStub.firstCall.args[0]).to.equal(groupId);
      expect(findByIdAndUpdateStub.firstCall.args[1]).to.deep.equal(updateData);
      expect(result).to.deep.equal(updatedGroup);
    });

    it('should return null if group not found', async () => {
      // Arrange
      const groupId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const updateData = { name: 'Updated Group' };

      // Group.findById stub
      const findByIdStub = sinon.stub(Group, 'findById').resolves(null);

      // Act
      const result = await groupService.updateGroup(groupId, updateData, userId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(result).to.be.null;
    });

    it('should return null if user is not owner', async () => {
      // Arrange
      const groupId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const ownerId = new mongoose.Types.ObjectId().toString();
      const updateData = { name: 'Updated Group' };

      const group = {
        _id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
        members: [
          {
            userId: ownerId,
            role: 'owner',
            joinedAt: new Date(),
          },
          {
            userId,
            role: 'member',
            joinedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Group.findById stub
      const findByIdStub = sinon.stub(Group, 'findById').resolves(group);

      // Act
      const result = await groupService.updateGroup(groupId, updateData, userId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(result).to.be.null;
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group if user is owner', async () => {
      // Arrange
      const groupId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();

      const group = {
        _id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
        members: [
          {
            userId,
            role: 'owner',
            joinedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Group.findById stub
      const findByIdStub = sinon.stub(Group, 'findById').resolves(group);

      // Group.findByIdAndDelete stub
      const findByIdAndDeleteStub = sinon.stub(Group, 'findByIdAndDelete').resolves(group);

      // Channel.deleteMany stub
      const deleteChannelsStub = sinon.stub(Channel, 'deleteMany').resolves({ deletedCount: 2 });

      // Act
      const result = await groupService.deleteGroup(groupId, userId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(findByIdAndDeleteStub.calledOnce).to.be.true;
      expect(deleteChannelsStub.calledOnce).to.be.true;
      expect(deleteChannelsStub.firstCall.args[0]).to.deep.equal({ groupId });
      expect(result).to.be.true;
    });

    it('should return false if group not found', async () => {
      // Arrange
      const groupId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();

      // Group.findById stub
      const findByIdStub = sinon.stub(Group, 'findById').resolves(null);

      // Act
      const result = await groupService.deleteGroup(groupId, userId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(result).to.be.false;
    });

    it('should return false if user is not owner', async () => {
      // Arrange
      const groupId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const ownerId = new mongoose.Types.ObjectId().toString();

      const group = {
        _id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        type: 'public',
        icon: 'test-icon',
        members: [
          {
            userId: ownerId,
            role: 'owner',
            joinedAt: new Date(),
          },
          {
            userId,
            role: 'member',
            joinedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Group.findById stub
      const findByIdStub = sinon.stub(Group, 'findById').resolves(group);

      // Act
      const result = await groupService.deleteGroup(groupId, userId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(result).to.be.false;
    });
  });
});
