/**
 * src/routes/api/index.ts
 * API router
 */
import express from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import groupRoutes from './groups';
import channelRoutes from './channels';
import messageRoutes from './messages';
import directMessageRoutes from './directMessages';
import notificationRoutes from './notifications';
import webhookRoutes from './webhooks';
import activityRoutes from './activities';
import invitationRoutes from './invitations';
import friendRoutes from './friends';
import exampleRoutes from './example';
import performanceRoutes from './performance';
import diagnosticsRoutes from './diagnostics';

const router = express.Router();

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/groups', groupRoutes);
router.use('/channels', channelRoutes);
router.use('/messages', messageRoutes);
router.use('/direct-messages', directMessageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/activities', activityRoutes);
router.use('/invitations', invitationRoutes);
router.use('/friends', friendRoutes);
router.use('/example', exampleRoutes);
router.use('/performance', performanceRoutes);
router.use('/diagnostics', diagnosticsRoutes);

export default router;
