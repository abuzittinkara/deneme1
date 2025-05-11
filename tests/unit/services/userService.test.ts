/**
 * tests/unit/services/userService.test.ts
 * Kullanıcı servisi birim testleri
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { userService } from '../../../src/services/userService';
import { User } from '../../../src/models/User';
import { UserStatus } from '../../../src/types/enums';

describe('UserService', () => {
  // Test öncesi ve sonrası işlemler
  beforeEach(() => {
    // Stub'ları temizle
    sinon.restore();
  });

  after(() => {
    // Tüm stub'ları temizle
    sinon.restore();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
      };

      const savedUser = {
        _id: new mongoose.Types.ObjectId(),
        username: userData.username,
        email: userData.email,
        password: 'hashedPassword',
        status: UserStatus.OFFLINE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // User.create stub
      const createStub = sinon.stub(User, 'create').resolves(savedUser);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.deep.include({
        username: userData.username,
        email: userData.email,
      });
      expect(result).to.have.property('_id');
      expect(result.username).to.equal(userData.username);
      expect(result.email).to.equal(userData.email);
    });

    it('should throw an error if user creation fails', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
      };

      // User.create stub
      const createStub = sinon.stub(User, 'create').rejects(new Error('Database error'));

      // Act & Assert
      try {
        await userService.createUser(userData);
        // Eğer buraya gelirse test başarısız olur
        expect.fail('Expected error was not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('Database error');
      }
      expect(createStub.calledOnce).to.be.true;
    });
  });

  describe('getUserById', () => {
    it('should return a user by ID', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();
      const user = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
        status: UserStatus.ONLINE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // User.findById stub
      const findByIdStub = sinon.stub(User, 'findById').resolves(user);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(findByIdStub.firstCall.args[0]).to.equal(userId);
      expect(result).to.deep.equal(user);
    });

    it('should return null if user not found', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();

      // User.findById stub
      const findByIdStub = sinon.stub(User, 'findById').resolves(null);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(findByIdStub.calledOnce).to.be.true;
      expect(result).to.be.null;
    });

    it('should throw an error if database query fails', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();

      // User.findById stub
      const findByIdStub = sinon.stub(User, 'findById').rejects(new Error('Database error'));

      // Act & Assert
      try {
        await userService.getUserById(userId);
        // Eğer buraya gelirse test başarısız olur
        expect.fail('Expected error was not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('Database error');
      }
      expect(findByIdStub.calledOnce).to.be.true;
    });
  });

  describe('getUserByUsername', () => {
    it('should return a user by username', async () => {
      // Arrange
      const username = 'testuser';
      const user = {
        _id: new mongoose.Types.ObjectId(),
        username,
        email: 'test@example.com',
        status: UserStatus.ONLINE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // User.findOne stub
      const findOneStub = sinon.stub(User, 'findOne').resolves(user);

      // Act
      const result = await userService.getUserByUsername(username);

      // Assert
      expect(findOneStub.calledOnce).to.be.true;
      expect(findOneStub.firstCall.args[0]).to.deep.equal({ username });
      expect(result).to.deep.equal(user);
    });

    it('should return null if user not found', async () => {
      // Arrange
      const username = 'nonexistentuser';

      // User.findOne stub
      const findOneStub = sinon.stub(User, 'findOne').resolves(null);

      // Act
      const result = await userService.getUserByUsername(username);

      // Assert
      expect(findOneStub.calledOnce).to.be.true;
      expect(result).to.be.null;
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();
      const updateData = {
        status: UserStatus.ONLINE,
        displayName: 'Test User',
      };

      const updatedUser = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
        status: UserStatus.ONLINE,
        displayName: 'Test User',
        updatedAt: new Date(),
      };

      // User.findByIdAndUpdate stub
      const findByIdAndUpdateStub = sinon.stub(User, 'findByIdAndUpdate').resolves(updatedUser);

      // Act
      const result = await userService.updateUser(userId, updateData);

      // Assert
      expect(findByIdAndUpdateStub.calledOnce).to.be.true;
      expect(findByIdAndUpdateStub.firstCall.args[0]).to.equal(userId);
      expect(findByIdAndUpdateStub.firstCall.args[1]).to.deep.equal(updateData);
      expect(result).to.deep.equal(updatedUser);
    });

    it('should return null if user not found', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();
      const updateData = { status: UserStatus.ONLINE };

      // User.findByIdAndUpdate stub
      const findByIdAndUpdateStub = sinon.stub(User, 'findByIdAndUpdate').resolves(null);

      // Act
      const result = await userService.updateUser(userId, updateData);

      // Assert
      expect(findByIdAndUpdateStub.calledOnce).to.be.true;
      expect(result).to.be.null;
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();
      const deletedUser = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
      };

      // User.findByIdAndDelete stub
      const findByIdAndDeleteStub = sinon.stub(User, 'findByIdAndDelete').resolves(deletedUser);

      // Act
      const result = await userService.deleteUser(userId);

      // Assert
      expect(findByIdAndDeleteStub.calledOnce).to.be.true;
      expect(findByIdAndDeleteStub.firstCall.args[0]).to.equal(userId);
      expect(result).to.be.true;
    });

    it('should return false if user not found', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId().toString();

      // User.findByIdAndDelete stub
      const findByIdAndDeleteStub = sinon.stub(User, 'findByIdAndDelete').resolves(null);

      // Act
      const result = await userService.deleteUser(userId);

      // Assert
      expect(findByIdAndDeleteStub.calledOnce).to.be.true;
      expect(result).to.be.false;
    });
  });
});
