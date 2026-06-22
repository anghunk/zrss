import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import {
  type NotificationItem,
  type NotificationType,
  useNotificationStore,
} from '@/stores/notificationStore';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

const EXIT_DURATION = 180;

const notificationStyles: Record<
  NotificationType,
  {
    icon: ReactNode;
    className: string;
  }
> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-success" />,
    className: 'border-success/20 bg-success/10 text-foreground',
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 text-destructive" />,
    className: 'border-destructive/20 bg-destructive/10 text-foreground',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 text-warning" />,
    className: 'border-warning/25 bg-warning/10 text-foreground',
  },
  info: {
    icon: <Info className="h-4 w-4 text-brand" />,
    className: 'border-brand/20 bg-brand-soft text-foreground',
  },
  loading: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    className: 'border-border bg-popover text-popover-foreground',
  },
};

/**
 * 全局通知容器。
 */
export function NotificationCenter() {
  const notifications = useNotificationStore((state) => state.notifications);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="notification-stack pointer-events-none fixed left-1/2 top-4 z-[2147483647] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2">
      {notifications.map((notification) => (
        <div key={notification.id} className="notification-toast-slot">
          <NotificationToast notification={notification} />
        </div>
      ))}
    </div>,
    document.body
  );
}

/**
 * 单条全局通知。
 */
function NotificationToast({ notification }: { notification: NotificationItem }) {
  const dismissNotification = useNotificationStore((state) => state.dismissNotification);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const style = notificationStyles[notification.type];

  /**
   * 播放退出动画后移除通知。
   */
  const close = useCallback(() => {
    if (closingRef.current) return;

    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      dismissNotification(notification.id);
      closeTimerRef.current = null;
    }, EXIT_DURATION);
  }, [dismissNotification, notification.id]);

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    closingRef.current = false;
    setClosing(false);

    if (notification.duration <= 0) return;

    const timer = setTimeout(() => {
      close();
    }, notification.duration);

    return () => clearTimeout(timer);
  }, [close, notification.createdAt, notification.duration]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        'notification-toast pointer-events-auto flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-sm shadow-lg',
        closing && 'notification-toast-closing',
        style.className
      )}
      role="status"
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="mt-0.5 shrink-0">{style.icon}</div>
      <div className="min-w-0 flex-1">
        {notification.title && (
          <div className="mb-0.5 truncate font-medium">{notification.title}</div>
        )}
        <div className="break-words text-xs opacity-85">{notification.message}</div>
      </div>
      <button
        type="button"
        className="mt-0.5 shrink-0 rounded-sm p-0.5 opacity-65 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={close}
        aria-label="关闭提示"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
