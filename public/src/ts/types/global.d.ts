/**
 * Global type declarations for the application
 */

// Import the types we need
import { NotificationSettings } from './index';

// Extend the Window interface to include our custom events
declare global {
  interface WindowEventMap {
    'channelContextMenuCreated': CustomEvent<{
      channelId: string;
      channelType: string;
      x: number;
      y: number;
      menu: HTMLElement;
      roomObj: any;
    }>;
    'userContextMenuCreated': CustomEvent<{
      username: string;
      x: number;
      y: number;
      menu: HTMLElement;
      user: any;
    }>;
    'channelSelected': CustomEvent<{
      newChannel: string;
      channelType: string;
      groupId: string;
      channelId: string;
    }>;
    'dmSelected': CustomEvent<{
      friend: string;
      userId: string;
    }>;
    'notificationSettingsChanged': CustomEvent<{
      settings: {
        enabled: boolean;
        sound: boolean;
        desktop: boolean;
        mentions: boolean;
        directMessages: boolean;
        groupMessages: boolean;
      };
    }>;
    'themeSettingsChanged': CustomEvent<{
      theme: string;
    }>;
    'languageSettingsChanged': CustomEvent<{
      language: string;
    }>;
  }

  // Extend the Window interface to include our custom properties
  interface Window {
    screenShareProducerVideo: MediaStreamTrack | null;
    screenShareProducerAudio: MediaStreamTrack | null;
    currentGroup: string;
    selectedGroup: string;
    username: string;
    isDMMode: boolean;
    socket: import('./socket').AppSocket;
    audioPermissionGranted: boolean;
    micEnabled: boolean;
    selfDeafened: boolean;
    feedback: {
      showToast: (message: string, options: { type: string }) => void;
    };
    showToast: (message: string, type: string, title?: string, duration?: number) => void;
    showConfirm: (options: {
      title: string;
      message: string;
      confirmText: string;
      cancelText: string;
      onConfirm: () => void;
      onCancel?: () => void;
    }) => void;
    showLoading: () => void;
    hideLoading: () => void;
    applyAudioStates: () => void;
  }
}

// This export is needed to make this a module
export {};
