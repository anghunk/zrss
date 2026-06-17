import { fetchAllFeeds } from '@/lib/feed-fetcher';
import { getSettings } from '@/lib/db';

export default defineBackground(() => {
  const ALARM_NAME = 'zrss-refresh';

  // 设置定时器
  async function setupAlarm() {
    const settings = await getSettings();
    const intervalMinutes = settings.refreshInterval || 15;

    await browser.alarms.clear(ALARM_NAME);
    await browser.alarms.create(ALARM_NAME, {
      periodInMinutes: intervalMinutes,
    });

    console.log(`[ZRSS] Alarm set: refresh every ${intervalMinutes} minutes`);
  }

  // 执行刷新
  async function doRefresh() {
    try {
      console.log('[ZRSS] Starting feed refresh...');
      const results = await fetchAllFeeds();
      const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
      const errors = results.filter((r) => r.error);

      console.log(
        `[ZRSS] Refresh complete: ${totalNew} new articles` +
        (errors.length > 0 ? `, ${errors.length} errors` : '')
      );

      // 通知 newtab 页面更新
      try {
        await browser.runtime.sendMessage({
          type: 'FEEDS_UPDATED',
          payload: results,
        });
      } catch {
        // 没有监听器（页面可能没打开），忽略
      }
    } catch (err) {
      console.error('[ZRSS] Refresh failed:', err);
    }
  }

  // 监听定时器
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      doRefresh();
    }
  });

  // 监听消息
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'FETCH_FEEDS') {
      doRefresh();
      return true;
    }
  });

  // 安装/更新时初始化
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install' || details.reason === 'update') {
      await setupAlarm();
      // 安装时立即刷新一次
      await doRefresh();
    }
  });

  // 启动时设置定时器
  setupAlarm();

  // 首次启动也刷新一次
  doRefresh();
});
