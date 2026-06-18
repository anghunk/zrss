import { fetchAllFeeds } from '@/lib/feed-fetcher';
import { getSettings } from '@/lib/db';

export default defineBackground(() => {
  const ALARM_NAME = 'zrss-refresh';
  let refreshPromise: Promise<void> | null = null;

  /**
   * 根据当前设置重建 RSS 刷新定时器。
   */
  async function setupAlarm() {
    const settings = await getSettings();
    const intervalMinutes = settings.refreshInterval || 15;

    await browser.alarms.clear(ALARM_NAME);
    await browser.alarms.create(ALARM_NAME, {
      periodInMinutes: intervalMinutes,
    });

    console.log(`[ZRSS] Alarm set: refresh every ${intervalMinutes} minutes`);
  }

  /**
   * 抓取所有订阅源并通知已打开的阅读器页面刷新数据。
   */
  async function refreshFeeds() {
    try {
      console.log('[ZRSS] Starting feed refresh...');
      const results = await fetchAllFeeds();
      const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
      const errors = results.filter((r) => r.error);

      console.log(
        `[ZRSS] Refresh complete: ${totalNew} new articles` +
        (errors.length > 0 ? `, ${errors.length} errors` : '')
      );

      // 通知 reader 页面更新
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

  // Reuse the in-flight refresh when multiple extension views open at once.
  async function doRefresh() {
    if (!refreshPromise) {
      refreshPromise = refreshFeeds().finally(() => {
        refreshPromise = null;
      });
    }

    await refreshPromise;
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
      void doRefresh();
      return;
    }
    if (message.type === 'SETTINGS_UPDATED') {
      void setupAlarm();
      return;
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
