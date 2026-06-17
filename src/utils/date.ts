import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 相对时间
export function timeAgo(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: zhCN,
  });
}

// 格式化日期
// 本年：MM-dd HH:mm:ss，非本年：yyyy-MM-dd HH:mm:ss
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const currentYear = new Date().getFullYear();
  const isCurrentYear = date.getFullYear() === currentYear;

  return format(date, isCurrentYear ? 'MM-dd HH:mm' : 'yyyy-MM-dd HH:mm');
}
