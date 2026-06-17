import { useState } from 'react';
import { useFeedStore } from '@/stores/feedStore';
import { useUIStore } from '@/stores/uiStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export function AddFeedDialog() {
  const { addFeedOpen, setAddFeedOpen, prefillUrl, setPrefillUrl } = useUIStore();
  const { addFeed, loading } = useFeedStore();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  // 当 prefillUrl 变化时，将其作为初始 URL
  // 使用 key 技巧：打开时读取 prefillUrl 一次
  // 这里通过监听 addFeedOpen 变化来同步
  const handleOpenChange = (open: boolean) => {
    setAddFeedOpen(open);
    if (open) {
      // 打开时用预填 URL 初始化输入框
      setUrl(prefillUrl || '');
    } else {
      setUrl('');
      setError('');
      setPrefillUrl('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setError('');
    try {
      await addFeed(url.trim());
      setUrl('');
      setPrefillUrl('');
      setAddFeedOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加订阅失败');
    }
  };

  return (
    <Dialog open={addFeedOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加订阅</DialogTitle>
          <DialogDescription>
            输入 RSS 或 Atom 订阅链接开始订阅。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed-url">订阅链接</Label>
            <Input
              id="feed-url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={!url.trim() || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              添加
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
