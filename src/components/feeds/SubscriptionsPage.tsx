import { useState } from 'react';
import { useFeedStore } from '@/stores/feedStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Rss,
  FolderOpen,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  ExternalLink,
  FolderPlus,
} from 'lucide-react';
import type { Feed, Folder } from '@/types';
import { cn } from '@/lib/utils';

export function SubscriptionsPage() {
  const { setAddFeedOpen } = useUIStore();
  const {
    feeds,
    folders,
    loading,
    updateFeed,
    deleteFeed,
    addFolder,
    updateFolder,
    deleteFolder,
  } = useFeedStore();

  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editFolder, setEditFolder] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [confirmDeleteFeed, setConfirmDeleteFeed] = useState<Feed | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<Folder | null>(null);

  const startEditFeed = (feed: Feed) => {
    setEditingFeedId(feed.id);
    setEditTitle(feed.title);
    setEditUrl(feed.url);
    setEditFolder(feed.folderId);
  };

  const cancelEditFeed = () => {
    setEditingFeedId(null);
    setEditTitle('');
    setEditUrl('');
    setEditFolder(null);
  };

  const saveEditFeed = async () => {
    if (!editingFeedId) return;
    await updateFeed(editingFeedId, {
      title: editTitle.trim() || '未命名',
      url: editUrl.trim(),
      folderId: editFolder,
    });
    cancelEditFeed();
  };

  const handleDeleteFeed = async (feed: Feed) => {
    await deleteFeed(feed.id);
    setConfirmDeleteFeed(null);
  };

  const startEditFolder = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
  };

  const cancelEditFolder = () => {
    setEditingFolderId(null);
    setEditFolderName('');
  };

  const saveEditFolder = async () => {
    if (!editingFolderId || !editFolderName.trim()) return;
    await updateFolder(editingFolderId, { name: editFolderName.trim() });
    cancelEditFolder();
  };

  const handleDeleteFolder = async (folder: Folder) => {
    await deleteFolder(folder.id);
    setConfirmDeleteFolder(null);
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    await addFolder(newFolderName.trim());
    setNewFolderName('');
  };

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">订阅管理</h1>
        <p className="text-xs text-muted-foreground">管理你的订阅源和分组。</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
          {/* Folders section */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <Label>分组</Label>
            </div>

            <div className="space-y-2">
              {folders.map((folder) => {
                const isEditing = editingFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2"
                  >
                    {isEditing ? (
                      <>
                        <Input
                          value={editFolderName}
                          onChange={(e) => setEditFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditFolder();
                            if (e.key === 'Escape') cancelEditFolder();
                          }}
                          className="h-7 flex-1"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={saveEditFolder}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={cancelEditFolder}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">{folder.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditFolder(folder)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDeleteFolder(folder)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="新建分组名称"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFolder();
                }}
                className="h-8 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFolder}
                disabled={!newFolderName.trim()}
              >
                <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                新建
              </Button>
            </div>
          </section>

          {/* Feeds section */}
          <section className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rss className="h-4 w-4 text-muted-foreground" />
                <Label>订阅源</Label>
                <Badge variant="secondary" className="text-xs">
                  {feeds.length}
                </Badge>
              </div>
              <Button size="sm" onClick={() => setAddFeedOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                添加订阅
              </Button>
            </div>

            {feeds.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                还没有任何订阅。点击右上角「添加订阅」开始。
              </div>
            ) : (
              <div className="space-y-2">
                {feeds.map((feed) => {
                  const isEditing = editingFeedId === feed.id;
                  const folderName = folders.find((f) => f.id === feed.folderId)?.name;
                  return (
                    <div
                      key={feed.id}
                      className={cn(
                        'rounded-md border px-3 py-2',
                        isEditing && 'bg-accent/30'
                      )}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="订阅名称"
                            className="h-8"
                            autoFocus
                          />
                          <Input
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            placeholder="RSS 链接"
                            className="h-8"
                          />
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">
                              所属分组
                            </Label>
                            <select
                              value={editFolder || ''}
                              onChange={(e) =>
                                setEditFolder(e.target.value || null)
                              }
                              className="h-8 rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="">无分组</option>
                              {folders.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditFeed}
                            >
                              取消
                            </Button>
                            <Button size="sm" onClick={saveEditFeed}>
                              保存
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                            {feed.favicon ? (
                              <img
                                src={feed.favicon}
                                alt=""
                                className="h-5 w-5 rounded-sm"
                              />
                            ) : (
                              <Rss className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {feed.title}
                              </span>
                              {folderName && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {folderName}
                                </Badge>
                              )}
                              {feed.unreadCount > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {feed.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="truncate">{feed.url}</span>
                              {feed.siteUrl && (
                                <a
                                  href={feed.siteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="ml-1 hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEditFeed(feed)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDeleteFeed(feed)}
                            disabled={loading}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="h-6" />
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={!!confirmDeleteFeed}
        onOpenChange={(open) => !open && setConfirmDeleteFeed(null)}
        title="删除订阅"
        description={
          confirmDeleteFeed
            ? `确定要删除订阅「${confirmDeleteFeed.title}」吗？所有相关文章也会被删除。`
            : ''
        }
        confirmText="删除"
        variant="destructive"
        onConfirm={() => confirmDeleteFeed && handleDeleteFeed(confirmDeleteFeed)}
      />

      <ConfirmDialog
        open={!!confirmDeleteFolder}
        onOpenChange={(open) => !open && setConfirmDeleteFolder(null)}
        title="删除分组"
        description={
          confirmDeleteFolder
            ? `确定要删除分组「${confirmDeleteFolder.name}」吗？其中的订阅会移到根目录。`
            : ''
        }
        confirmText="删除"
        variant="destructive"
        onConfirm={() => confirmDeleteFolder && handleDeleteFolder(confirmDeleteFolder)}
      />
    </div>
  );
}
