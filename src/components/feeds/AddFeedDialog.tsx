import { useEffect, useState } from 'react';
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

  // 当对话框通过 store 被程序化打开时（如从 popup 跳转过来），
  // Radix Dialog 的 onOpenChange 不会触发，需要用 useEffect 同步 prefillUrl
  useEffect(() => {
    if (addFeedOpen) {
      setUrl(prefillUrl || '');
    }
  }, [addFeedOpen, prefillUrl]);

  const handleOpenChange = (open: boolean) => {
    setAddFeedOpen(open);
    if (!open) {
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
