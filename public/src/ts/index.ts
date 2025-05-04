/**
 * public/src/ts/index.ts
 * İstemci tarafı TypeScript modüllerini içe aktarır
 */

// Modülleri içe aktar
import { initFileUpload } from './fileUpload';
import { initMessageManager } from './messageManager';
import { initSearch } from './searchMessages';
import { initMediaPlayer } from './mediaPlayer';
import { initArchiveManager } from './archiveManager';
import { initCategoryManager } from './categoryManager';
import { initFeedback, showToast } from './feedback';
import { initTips } from './tips';
import {
  initNotifications,
  updateNotificationSettings,
  getNotificationSettings,
} from './notifications';
import { initEmojiPicker, getEmojiByCode, replaceEmojiCodes } from './emojiPicker';
import { initMessageReactions } from './messageReactions';
import { initTypingIndicator } from './typingIndicator';
import { initFriendRequests } from './friendRequests';
import { initUserSettings } from './userSettings';
import { initUserStatus } from './userStatus';
import { initNotificationSettings } from './notificationSettings';
import { initDMChat } from './dmChat';
import { initProfileManager } from './profileManager';
import { initGroupManager } from './groupManager';
import { initChannelManager } from './channelManager';
import { initTextChannelEvents } from './textChannel';
import { initRichTextFormatter, formatText } from './richTextFormatter';
import { initVoiceChannel, joinVoiceChannel, leaveVoiceChannel } from './voiceChannel';
import { initFavorites } from './favorites';
import { initMessagePinning } from './messagePinning';
import { initMessageQuoting } from './messageQuoting';
import { initUserBlocking } from './userBlocking';
import { initHelp } from './help';
import {
  showMicrophoneHelp,
  enableListenOnlyMode,
  checkMicrophoneAvailability,
} from './microphoneHelper';
import { initReadReceipts } from './readReceipts';
import { initReportManager } from './reportManager';
import { initRoleManager } from './roleManager';
import { initScheduledMessages } from './scheduledMessages';
import { startScreenShare, stopScreenShare } from './screenShare';
import { initSessionManager } from './sessionManager';

// Global değişkenlere ekle
declare global {
  interface Window {
    fileUpload: typeof initFileUpload;
    messageManager: typeof initMessageManager;
    search: typeof initSearch;
    mediaPlayer: typeof initMediaPlayer;
    archiveManager: typeof initArchiveManager;
    categoryManager: typeof initCategoryManager;
    feedback: {
      init: typeof initFeedback;
      showToast: typeof showToast;
    };
    tips: typeof initTips;
    notifications: {
      init: typeof initNotifications;
      updateSettings: typeof updateNotificationSettings;
      getSettings: typeof getNotificationSettings;
    };
    emojiPicker: {
      init: typeof initEmojiPicker;
      getEmojiByCode: typeof getEmojiByCode;
      replaceEmojiCodes: typeof replaceEmojiCodes;
    };
    messageReactions: typeof initMessageReactions;
    typingIndicator: typeof initTypingIndicator;
    friendRequests: typeof initFriendRequests;
    userSettings: typeof initUserSettings;
    userStatus: typeof initUserStatus;
    notificationSettings: typeof initNotificationSettings;
    dmChat: typeof initDMChat;
    profileManager: typeof initProfileManager;
    groupManager: typeof initGroupManager;
    channelManager: typeof initChannelManager;
    textChannel: typeof initTextChannelEvents;
    richTextFormatter: typeof initRichTextFormatter;
    formatText: typeof formatText;
    voiceChannel: typeof initVoiceChannel;
    joinVoiceChannel: typeof joinVoiceChannel;
    leaveVoiceChannel: typeof leaveVoiceChannel;
    favorites: typeof initFavorites;
    messagePinning: typeof initMessagePinning;
    messageQuoting: typeof initMessageQuoting;
    userBlocking: typeof initUserBlocking;
    help: typeof initHelp;
    showMicrophoneHelp: typeof showMicrophoneHelp;
    enableListenOnlyMode: typeof enableListenOnlyMode;
    checkMicrophoneAvailability: typeof checkMicrophoneAvailability;
    readReceipts: typeof initReadReceipts;
    reportManager: typeof initReportManager;
    roleManager: typeof initRoleManager;
    scheduledMessages: typeof initScheduledMessages;
    startScreenShare: typeof startScreenShare;
    stopScreenShare: typeof stopScreenShare;
    sessionManager: typeof initSessionManager;
    socket: any;
    username: string;
    currentGroup: string;
  }
}

// Global değişkenlere modülleri ekle
window.fileUpload = initFileUpload;
window.messageManager = initMessageManager;
window.search = initSearch;
window.mediaPlayer = initMediaPlayer;
window.archiveManager = initArchiveManager;
window.categoryManager = initCategoryManager;
window.feedback = {
  init: initFeedback,
  showToast: showToast,
};
window.tips = initTips;
window.notifications = {
  init: initNotifications,
  updateSettings: updateNotificationSettings,
  getSettings: getNotificationSettings,
};
window.emojiPicker = {
  init: initEmojiPicker,
  getEmojiByCode: getEmojiByCode,
  replaceEmojiCodes: replaceEmojiCodes,
};
window.messageReactions = initMessageReactions;
window.typingIndicator = initTypingIndicator;
window.friendRequests = initFriendRequests;
window.userSettings = initUserSettings;
window.userStatus = initUserStatus;
window.notificationSettings = initNotificationSettings;
window.dmChat = initDMChat;
window.profileManager = initProfileManager;
window.groupManager = initGroupManager;
window.channelManager = initChannelManager;
window.textChannel = initTextChannelEvents;
window.richTextFormatter = initRichTextFormatter;
window.formatText = formatText;
window.voiceChannel = initVoiceChannel;
window.joinVoiceChannel = joinVoiceChannel;
window.leaveVoiceChannel = leaveVoiceChannel;
window.favorites = initFavorites;
window.messagePinning = initMessagePinning;
window.messageQuoting = initMessageQuoting;
window.userBlocking = initUserBlocking;
window.help = initHelp;
window.showMicrophoneHelp = showMicrophoneHelp;
window.enableListenOnlyMode = enableListenOnlyMode;
window.checkMicrophoneAvailability = checkMicrophoneAvailability;
window.readReceipts = initReadReceipts;
window.reportManager = initReportManager;
window.roleManager = initRoleManager;
window.scheduledMessages = initScheduledMessages;
window.startScreenShare = startScreenShare;
window.stopScreenShare = stopScreenShare;
window.sessionManager = initSessionManager;

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', () => {
  console.log('TypeScript modülleri yüklendi');
});
