import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration: number;
  createdAt: number;
}

export interface NotificationInput {
  type?: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

interface NotificationState {
  notifications: NotificationItem[];
  showNotification: (input: NotificationInput) => string;
  updateNotification: (id: string, updates: Partial<NotificationInput>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

/**
 * 根据通知类型获取默认展示时长。
 */
function getDefaultDuration(type: NotificationType): number {
  return type === 'loading' ? 0 : 2600;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  /**
   * 显示一条全局通知。
   */
  showNotification: (input) => {
    const type = input.type || 'info';
    const id = nanoid();
    const notification: NotificationItem = {
      id,
      type,
      title: input.title,
      message: input.message,
      duration: input.duration ?? getDefaultDuration(type),
      createdAt: Date.now(),
    };

    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    return id;
  },

  /**
   * 更新已有通知的状态与文案。
   */
  updateNotification: (id, updates) => {
    set((state) => ({
      notifications: state.notifications.map((notification) => {
        if (notification.id !== id) return notification;
        const type = updates.type || notification.type;
        const duration =
          updates.duration ??
          (updates.type && updates.type !== notification.type
            ? getDefaultDuration(type)
            : notification.duration);

        return {
          ...notification,
          ...updates,
          type,
          duration,
          createdAt: Date.now(),
        };
      }),
    }));
  },

  /**
   * 关闭指定通知。
   */
  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    }));
  },

  /**
   * 清空所有通知。
   */
  clearNotifications: () => {
    set({ notifications: [] });
  },
}));
