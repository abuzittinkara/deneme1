/**
 * src/__tests__/modules/searchManager.test.ts
 * searchManager modülü için birim testleri
 */
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { Message } from '../../models/Message';
import { DmMessage } from '../../models/DmMessage';
import { Channel } from '../../models/Channel';
import { Group } from '../../models/Group';
import * as searchManager from '../../modules/searchManager';

// Modülleri mockla
jest.mock('../../models/User');
jest.mock('../../models/Message');
jest.mock('../../models/DmMessage');
jest.mock('../../models/Channel');
jest.mock('../../models/Group');

describe('Search Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should throw error for short query', async () => {
      await expect(searchManager.search('a')).rejects.toThrow(
        'Arama sorgusu en az 2 karakter olmalıdır.'
      );
    });

    it('should search users successfully', async () => {
      // Mock User.find
      const mockUsers = [
        {
          _id: 'user1',
          username: 'testuser',
          name: 'Test',
          surname: 'User',
          profilePicture: 'picture1',
          status: 'online',
        },
        {
          _id: 'user2',
          username: 'anotheruser',
          name: 'Another',
          surname: 'User',
          profilePicture: 'picture2',
          status: 'away',
        },
      ];

      (User.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers),
      });

      const result = await searchManager.search('test', { searchType: 'users' });

      expect(User.find).toHaveBeenCalledWith({
        $or: [
          { username: expect.any(RegExp) },
          { name: expect.any(RegExp) },
          { surname: expect.any(RegExp) },
          { email: expect.any(RegExp) },
        ],
        isActive: true,
      });

      expect(result).toEqual({
        users: [
          {
            id: 'user1',
            username: 'testuser',
            name: 'Test',
            surname: 'User',
            profilePicture: 'picture1',
            status: 'online',
          },
          {
            id: 'user2',
            username: 'anotheruser',
            name: 'Another',
            surname: 'User',
            profilePicture: 'picture2',
            status: 'away',
          },
        ],
        totalCount: 2,
      });
    });

    it('should search messages successfully', async () => {
      // Mock Message.find
      const mockMessages = [
        {
          _id: 'message1',
          content: 'Test message content',
          timestamp: new Date('2023-01-01'),
          user: {
            _id: 'user1',
            username: 'testuser',
          },
          channel: {
            _id: 'channel1',
            channelId: 'channel1',
            name: 'general',
            group: {
              _id: 'group1',
              groupId: 'group1',
              name: 'Test Group',
            },
          },
        },
      ];

      (Message.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockMessages),
      });

      const result = await searchManager.search('test', { searchType: 'messages' });

      expect(Message.find).toHaveBeenCalledWith({
        content: expect.any(RegExp),
      });

      expect(result).toEqual({
        messages: [
          {
            id: 'message1',
            content: 'Test message content',
            timestamp: expect.any(Date),
            user: {
              id: 'user1',
              username: 'testuser',
            },
            channel: {
              id: 'channel1',
              name: 'general',
            },
            group: {
              id: 'group1',
              name: 'Test Group',
            },
            highlightedContent: expect.any(String),
          },
        ],
        totalCount: 1,
      });
    });

    it('should search DM messages successfully', async () => {
      // Mock DmMessage.find
      const mockDmMessages = [
        {
          _id: 'dm1',
          content: 'Test DM content',
          timestamp: new Date('2023-01-01'),
          sender: {
            _id: 'user1',
            username: 'testuser',
          },
          receiver: {
            _id: 'user2',
            username: 'anotheruser',
          },
        },
      ];

      (DmMessage.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockDmMessages),
      });

      const result = await searchManager.search('test', { searchType: 'dmMessages' });

      expect(DmMessage.find).toHaveBeenCalledWith({
        content: expect.any(RegExp),
      });

      expect(result).toEqual({
        dmMessages: [
          {
            id: 'dm1',
            content: 'Test DM content',
            timestamp: expect.any(Date),
            sender: {
              id: 'user1',
              username: 'testuser',
            },
            receiver: {
              id: 'user2',
              username: 'anotheruser',
            },
            highlightedContent: expect.any(String),
          },
        ],
        totalCount: 1,
      });
    });

    it('should search channels successfully', async () => {
      // Mock Channel.find
      const mockChannels = [
        {
          _id: 'channel1',
          channelId: 'channel1',
          name: 'general',
          description: 'General channel for testing',
          type: 'text',
          group: {
            _id: 'group1',
            groupId: 'group1',
            name: 'Test Group',
          },
        },
      ];

      (Channel.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockChannels),
      });

      const result = await searchManager.search('test', { searchType: 'channels' });

      expect(Channel.find).toHaveBeenCalledWith({
        $or: [{ name: expect.any(RegExp) }, { description: expect.any(RegExp) }],
        isArchived: false,
      });

      expect(result).toEqual({
        channels: [
          {
            id: 'channel1',
            name: 'general',
            description: 'General channel for testing',
            type: 'text',
            group: {
              id: 'group1',
              name: 'Test Group',
            },
          },
        ],
        totalCount: 1,
      });
    });

    it('should search groups successfully', async () => {
      // Mock Group.find
      const mockGroups = [
        {
          _id: 'group1',
          groupId: 'group1',
          name: 'Test Group',
          description: 'Test group description',
          owner: {
            _id: 'user1',
            username: 'testuser',
          },
        },
      ];

      (Group.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockGroups),
      });

      // Mock mongoose.model
      (mongoose.model as jest.Mock).mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(10),
      });

      const result = await searchManager.search('test', { searchType: 'groups' });

      expect(Group.find).toHaveBeenCalledWith({
        $or: [{ name: expect.any(RegExp) }, { description: expect.any(RegExp) }],
        isPublic: true,
      });

      expect(result).toEqual({
        groups: [
          {
            id: 'group1',
            name: 'Test Group',
            description: 'Test group description',
            memberCount: 10,
            owner: {
              id: 'user1',
              username: 'testuser',
            },
          },
        ],
        totalCount: 1,
      });
    });

    it('should search all types successfully', async () => {
      // Mock User.find
      const mockUsers = [
        {
          _id: 'user1',
          username: 'testuser',
          name: 'Test',
          surname: 'User',
          profilePicture: 'picture1',
          status: 'online',
        },
      ];

      (User.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers),
      });

      // Mock Message.find
      const mockMessages = [
        {
          _id: 'message1',
          content: 'Test message content',
          timestamp: new Date('2023-01-01'),
          user: {
            _id: 'user1',
            username: 'testuser',
          },
          channel: {
            _id: 'channel1',
            channelId: 'channel1',
            name: 'general',
            group: {
              _id: 'group1',
              groupId: 'group1',
              name: 'Test Group',
            },
          },
        },
      ];

      (Message.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockMessages),
      });

      // Mock DmMessage.find
      const mockDmMessages = [
        {
          _id: 'dm1',
          content: 'Test DM content',
          timestamp: new Date('2023-01-01'),
          sender: {
            _id: 'user1',
            username: 'testuser',
          },
          receiver: {
            _id: 'user2',
            username: 'anotheruser',
          },
        },
      ];

      (DmMessage.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockDmMessages),
      });

      // Mock Channel.find
      const mockChannels = [
        {
          _id: 'channel1',
          channelId: 'channel1',
          name: 'general',
          description: 'General channel for testing',
          type: 'text',
          group: {
            _id: 'group1',
            groupId: 'group1',
            name: 'Test Group',
          },
        },
      ];

      (Channel.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockChannels),
      });

      // Mock Group.find
      const mockGroups = [
        {
          _id: 'group1',
          groupId: 'group1',
          name: 'Test Group',
          description: 'Test group description',
          owner: {
            _id: 'user1',
            username: 'testuser',
          },
        },
      ];

      (Group.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockGroups),
      });

      // Mock mongoose.model
      (mongoose.model as jest.Mock).mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(10),
      });

      const result = await searchManager.search('test', { searchType: 'all' });

      expect(result.totalCount).toBe(4); // 1 user + 1 message + 1 dmMessage + 1 channel + 1 group = 5
      expect(result.users).toHaveLength(1);
      expect(result.messages).toHaveLength(1);
      expect(result.dmMessages).toHaveLength(1);
      expect(result.channels).toHaveLength(1);
      expect(result.groups).toHaveLength(1);
    });
  });
});
