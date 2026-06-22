import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { useFeedStore } from '@/stores/feedStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  Plus,
  Rss,
  Trash2,
  X,
} from 'lucide-react';
import type { Feed, Folder } from '@/types';
import { cn } from '@/lib/utils';

interface FeedGroup {
  id: string | null;
  name: string;
  feeds: Feed[];
  folder?: Folder;
}

export function SubscriptionsPage() {
  const { setAddFeedOpen, setAddFeedFolderId } = useUIStore();
  const {
    feeds,
    folders,
    loading,
    updateFeed,
    deleteFeed,
    addFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
  } = useFeedStore();

  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editFolder, setEditFolder] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [confirmDeleteFeed, setConfirmDeleteFeed] = useState<Feed | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<Folder | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    () => new Set()
  );
  const [sortingFolders, setSortingFolders] = useState(false);
  const [sortFolderIds, setSortFolderIds] = useState<string[]>([]);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);

  const groupedFeeds = useMemo<FeedGroup[]>(() => {
    const feedsByFolder = feeds.reduce<Record<string, Feed[]>>((acc, feed) => {
      const key = feed.folderId || '__root__';
      acc[key] = acc[key] || [];
      acc[key].push(feed);
      return acc;
    }, {});

    const groups = folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      folder,
      feeds: feedsByFolder[folder.id] || [],
    }));

    return [
      ...groups,
      {
        id: null,
        name: '未分组',
        feeds: feedsByFolder.__root__ || [],
      },
    ];
  }, [feeds, folders]);

  /**
   * 打开添加订阅弹窗，并预设订阅源要放入的分组。
   */
  const openAddFeed = (folderId: string | null) => {
    setAddFeedFolderId(folderId);
    setAddFeedOpen(true);
  };

  /**
   * 打开新增分组弹窗，并重置分组名称输入。
   */
  const openAddFolderDialog = () => {
    setNewFolderName('');
    setAddFolderOpen(true);
  };

  /**
   * 展开或收起指定订阅分组。
   */
  const toggleGroupExpanded = (groupKey: string) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  /**
   * 将订阅源切换到内联编辑状态。
   */
  const startEditFeed = (feed: Feed) => {
    setEditingFeedId(feed.id);
    setEditTitle(feed.title);
    setEditUrl(feed.url);
    setEditFolder(feed.folderId);
  };

  /**
   * 退出订阅源编辑状态并清空临时表单。
   */
  const cancelEditFeed = () => {
    setEditingFeedId(null);
    setEditTitle('');
    setEditUrl('');
    setEditFolder(null);
  };

  /**
   * 保存订阅源名称、链接和所属分组。
   */
  const saveEditFeed = async () => {
    if (!editingFeedId || !editUrl.trim()) return;
    await updateFeed(editingFeedId, {
      title: editTitle.trim() || '未命名',
      url: editUrl.trim(),
      folderId: editFolder,
    });
    cancelEditFeed();
  };

  /**
   * 删除订阅源，并关闭确认弹窗。
   */
  const handleDeleteFeed = async (feed: Feed) => {
    await deleteFeed(feed.id);
    setConfirmDeleteFeed(null);
  };

  /**
   * 将分组切换到内联重命名状态。
   */
  const startEditFolder = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
  };

  /**
   * 退出分组编辑状态并清空临时表单。
   */
  const cancelEditFolder = () => {
    setEditingFolderId(null);
    setEditFolderName('');
  };

  /**
   * 保存分组名称。
   */
  const saveEditFolder = async () => {
    if (!editingFolderId || !editFolderName.trim()) return;
    await updateFolder(editingFolderId, { name: editFolderName.trim() });
    cancelEditFolder();
  };

  /**
   * 删除分组，并让组内订阅源回到未分组。
   */
  const handleDeleteFolder = async (folder: Folder) => {
    await deleteFolder(folder.id);
    setConfirmDeleteFolder(null);
  };

  /**
   * 新建订阅分组，并在完成后关闭弹窗。
   */
  const handleAddFolder = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!newFolderName.trim()) return;
    await addFolder(newFolderName.trim());
    setNewFolderName('');
    setAddFolderOpen(false);
  };

  /**
   * 进入分组排序模式，并以当前分组顺序作为草稿。
   */
  const startSortingFolders = () => {
    setSortingFolders(true);
    setSortFolderIds(folders.map((folder) => folder.id));
    setDraggingFolderId(null);
  };

  /**
   * 放弃分组排序草稿，回到普通分组列表。
   */
  const cancelSortingFolders = () => {
    setSortingFolders(false);
    setSortFolderIds([]);
    setDraggingFolderId(null);
  };

  /**
   * 保存分组排序草稿。
   */
  const saveFolderOrder = async () => {
    await reorderFolders(sortFolderIds);
    cancelSortingFolders();
  };

  /**
   * 开始拖拽指定分组。
   */
  const handleSortDragStart = (folderId: string) => {
    setDraggingFolderId(folderId);
  };

  /**
   * 拖拽经过目标分组时，同步调整排序草稿。
   */
  const handleSortDragOver = (event: DragEvent<HTMLDivElement>, targetFolderId: string) => {
    event.preventDefault();
    if (!draggingFolderId || draggingFolderId === targetFolderId) return;

    setSortFolderIds((current) => {
      const fromIndex = current.indexOf(draggingFolderId);
      const targetIndex = current.indexOf(targetFolderId);
      if (fromIndex === -1 || targetIndex === -1) return current;

      const next = [...current];
      next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, draggingFolderId);
      return next;
    });
  };

  /**
   * 结束当前拖拽操作。
   */
  const handleSortDragEnd = () => {
    setDraggingFolderId(null);
  };

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">订阅管理</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{folders.length} 个分组</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>{feeds.length} 个订阅源</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={startSortingFolders}
            disabled={folders.length < 2 || sortingFolders}
          >
            <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
            排序分组
          </Button>
          <Button variant="outline" size="sm" onClick={openAddFolderDialog}>
            <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
            新建分组
          </Button>
          <Button size="sm" onClick={() => openAddFeed(null)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加订阅
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
          {sortingFolders ? (
            <FolderSortPanel
              folders={folders}
              sortFolderIds={sortFolderIds}
              draggingFolderId={draggingFolderId}
              onDragStart={handleSortDragStart}
              onDragOver={handleSortDragOver}
              onDragEnd={handleSortDragEnd}
              onCancel={cancelSortingFolders}
              onConfirm={saveFolderOrder}
            />
          ) : feeds.length === 0 && folders.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              暂无订阅源
            </div>
          ) : (
            <div className="space-y-4">
              {groupedFeeds.map((group) => {
                const groupKey = group.id || '__root__';
                const isExpanded = expandedGroupIds.has(groupKey);

                return (
                  <section key={groupKey} className="overflow-hidden rounded-md border">
                    <GroupHeader
                      group={group}
                      groupKey={groupKey}
                      isExpanded={isExpanded}
                      isEditing={!!group.folder && editingFolderId === group.folder.id}
                      editFolderName={editFolderName}
                      onEditFolderNameChange={setEditFolderName}
                      onToggleExpanded={toggleGroupExpanded}
                      onStartEditFolder={startEditFolder}
                      onCancelEditFolder={cancelEditFolder}
                      onSaveEditFolder={saveEditFolder}
                      onDeleteFolder={setConfirmDeleteFolder}
                      onAddFeed={openAddFeed}
                    />

                    {isExpanded && (
                      group.feeds.length === 0 ? (
                        <div className="border-t px-4 py-5 text-sm text-muted-foreground">
                          暂无订阅源
                        </div>
                      ) : (
                        <div className="divide-y">
                          {group.feeds.map((feed) => (
                            <FeedRow
                              key={feed.id}
                              feed={feed}
                              folders={folders}
                              isEditing={editingFeedId === feed.id}
                              editTitle={editTitle}
                              editUrl={editUrl}
                              editFolder={editFolder}
                              loading={loading}
                              onEditTitleChange={setEditTitle}
                              onEditUrlChange={setEditUrl}
                              onEditFolderChange={setEditFolder}
                              onStartEdit={startEditFeed}
                              onCancelEdit={cancelEditFeed}
                              onSaveEdit={saveEditFeed}
                              onDelete={setConfirmDeleteFeed}
                            />
                          ))}
                        </div>
                      )
                    )}
                  </section>
                );
              })}
            </div>
          )}

          <div className="h-6" />
        </div>
      </ScrollArea>

      <Dialog
        open={addFolderOpen}
        onOpenChange={(open) => {
          setAddFolderOpen(open);
          if (!open) {
            setNewFolderName('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
            <DialogDescription>创建一个新的订阅分组。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddFolder} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">分组名称</Label>
              <Input
                id="folder-name"
                placeholder="例如：技术博客"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddFolderOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={!newFolderName.trim()}>
                新建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
            ? `确定要删除分组「${confirmDeleteFolder.name}」吗？其中的订阅会移到未分组。`
            : ''
        }
        confirmText="删除"
        variant="destructive"
        onConfirm={() => confirmDeleteFolder && handleDeleteFolder(confirmDeleteFolder)}
      />
    </div>
  );
}

interface FolderSortPanelProps {
  folders: Folder[];
  sortFolderIds: string[];
  draggingFolderId: string | null;
  onDragStart: (folderId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, targetFolderId: string) => void;
  onDragEnd: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 渲染独立的分组排序面板，确认前只修改本地排序草稿。
 */
function FolderSortPanel({
  folders,
  sortFolderIds,
  draggingFolderId,
  onDragStart,
  onDragOver,
  onDragEnd,
  onCancel,
  onConfirm,
}: FolderSortPanelProps) {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const orderedFolders = sortFolderIds
    .map((folderId) => folderMap.get(folderId))
    .filter((folder): folder is Folder => Boolean(folder));

  return (
    <section className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b bg-secondary/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold">排序分组</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button size="sm" onClick={onConfirm}>
            确认
          </Button>
        </div>
      </div>

      <div className="divide-y">
        {orderedFolders.map((folder, index) => (
          <div
            key={folder.id}
            draggable
            onDragStart={() => onDragStart(folder.id)}
            onDragOver={(event) => onDragOver(event, folder.id)}
            onDragEnd={onDragEnd}
            className={cn(
              'flex cursor-grab items-center gap-3 bg-background px-4 py-3 transition-colors active:cursor-grabbing',
              draggingFolderId === folder.id && 'bg-accent/40'
            )}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {folder.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface GroupHeaderProps {
  group: FeedGroup;
  groupKey: string;
  isExpanded: boolean;
  isEditing: boolean;
  editFolderName: string;
  onEditFolderNameChange: (value: string) => void;
  onToggleExpanded: (groupKey: string) => void;
  onStartEditFolder: (folder: Folder) => void;
  onCancelEditFolder: () => void;
  onSaveEditFolder: () => void;
  onDeleteFolder: (folder: Folder) => void;
  onAddFeed: (folderId: string | null) => void;
}

/**
 * 渲染分组标题、分组编辑操作和该分组的订阅入口。
 */
function GroupHeader({
  group,
  groupKey,
  isExpanded,
  isEditing,
  editFolderName,
  onEditFolderNameChange,
  onToggleExpanded,
  onStartEditFolder,
  onCancelEditFolder,
  onSaveEditFolder,
  onDeleteFolder,
  onAddFeed,
}: GroupHeaderProps) {
  return (
    <div className="flex min-h-12 items-center gap-2 bg-secondary/70 px-4 py-2">
      {isEditing && group.folder ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={isExpanded ? '收起分组' : '展开分组'}
            title={isExpanded ? '收起分组' : '展开分组'}
            onClick={() => onToggleExpanded(groupKey)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <Input
            value={editFolderName}
            onChange={(event) => onEditFolderNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSaveEditFolder();
              if (event.key === 'Escape') onCancelEditFolder();
            }}
            className="h-8 flex-1 bg-background"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="保存分组"
            title="保存分组"
            onClick={onSaveEditFolder}
            disabled={!editFolderName.trim()}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="取消编辑分组"
            title="取消编辑分组"
            onClick={onCancelEditFolder}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={isExpanded ? '收起分组' : '展开分组'}
            title={isExpanded ? '收起分组' : '展开分组'}
            onClick={() => onToggleExpanded(groupKey)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => onToggleExpanded(groupKey)}
          >
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{group.name}</h2>
              <Badge variant="secondary" className="shrink-0 px-2 py-0 text-[11px]">
                {group.feeds.length}
              </Badge>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`添加订阅到${group.name}`}
            title={`添加订阅到${group.name}`}
            onClick={() => onAddFeed(group.id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {group.folder && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="重命名分组"
                title="重命名分组"
                onClick={() => onStartEditFolder(group.folder!)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="删除分组"
                title="删除分组"
                onClick={() => onDeleteFolder(group.folder!)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface FeedRowProps {
  feed: Feed;
  folders: Folder[];
  isEditing: boolean;
  editTitle: string;
  editUrl: string;
  editFolder: string | null;
  loading: boolean;
  onEditTitleChange: (value: string) => void;
  onEditUrlChange: (value: string) => void;
  onEditFolderChange: (value: string | null) => void;
  onStartEdit: (feed: Feed) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (feed: Feed) => void;
}

/**
 * 渲染单个订阅源的展示行和内联编辑表单。
 */
function FeedRow({
  feed,
  folders,
  isEditing,
  editTitle,
  editUrl,
  editFolder,
  loading,
  onEditTitleChange,
  onEditUrlChange,
  onEditFolderChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: FeedRowProps) {
  if (isEditing) {
    return (
      <div className="bg-accent/25 px-4 py-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(160px,1fr)_minmax(240px,1.4fr)_180px_auto] lg:items-center">
          <Input
            value={editTitle}
            onChange={(event) => onEditTitleChange(event.target.value)}
            placeholder="订阅名称"
            className="h-8 bg-background"
            autoFocus
          />
          <Input
            value={editUrl}
            onChange={(event) => onEditUrlChange(event.target.value)}
            placeholder="RSS 链接"
            className="h-8 bg-background"
          />
          <select
            value={editFolder || ''}
            onChange={(event) => onEditFolderChange(event.target.value || null)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
            aria-label="所属分组"
          >
            <option value="">未分组</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="保存订阅"
              title="保存订阅"
              onClick={onSaveEdit}
              disabled={!editUrl.trim()}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="取消编辑订阅"
              title="取消编辑订阅"
              onClick={onCancelEdit}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        {feed.favicon ? (
          <img src={feed.favicon} alt="" className="h-5 w-5" />
        ) : (
          <Rss className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium">{feed.title}</span>
          {feed.unreadCount > 0 && (
            <Badge variant="secondary" className="shrink-0 px-2 py-0 text-[11px]">
              {feed.unreadCount}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">{feed.url}</span>
          {feed.siteUrl && (
            <a
              href={feed.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="shrink-0 hover:text-foreground"
              aria-label="打开网站"
              title="打开网站"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label="编辑订阅"
        title="编辑订阅"
        onClick={() => onStartEdit(feed)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive')}
        aria-label="删除订阅"
        title="删除订阅"
        onClick={() => onDelete(feed)}
        disabled={loading}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
