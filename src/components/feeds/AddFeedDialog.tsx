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
  const {
    addFeedOpen,
    setAddFeedOpen,
    prefillUrl,
    setPrefillUrl,
    addFeedFolderId,
    setAddFeedFolderId,
  } = useUIStore();
  const { addFeed, folders, loading } = useFeedStore();
  const [url, setUrl] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [error, setError] = useState('');

  /**
   * 同步程序化打开弹窗时传入的订阅链接和目标分组。
   */
  useEffect(() => {
    if (addFeedOpen) {
      setUrl(prefillUrl || '');
      setFolderId(addFeedFolderId);
    }
  }, [addFeedFolderId, addFeedOpen, prefillUrl]);

  /**
   * 处理添加订阅弹窗开关，并在关闭后重置临时状态。
   */
  const handleOpenChange = (open: boolean) => {
    setAddFeedOpen(open);
    if (!open) {
      setUrl('');
      setFolderId(null);
      setError('');
      setPrefillUrl('');
      setAddFeedFolderId(null);
    }
  };

  /**
   * 提交订阅链接，并把新订阅放入选中的分组。
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setError('');
    try {
      await addFeed(url.trim(), folderId);
      setUrl('');
      setFolderId(null);
      setPrefillUrl('');
      setAddFeedFolderId(null);
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
          <div className="space-y-2">
            <Label htmlFor="feed-folder">所属分组</Label>
            <select
              id="feed-folder"
              value={folderId || ''}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">未分组</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
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
