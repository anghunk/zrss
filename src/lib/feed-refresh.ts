import type { MessageType } from '@/types';

/**
 * Ask the background worker to refresh every subscribed feed.
 */
export async function requestFetchFeeds(): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: 'FETCH_FEEDS' } satisfies MessageType);
  } catch {
    // The background worker may be starting, or the current extension view may close.
  }
}
