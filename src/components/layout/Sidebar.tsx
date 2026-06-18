import { useState, useMemo, useCallback, useRef } from 'react';
import { useFeedStore } from '@/stores/feedStore';
import { useArticleStore } from '@/stores/articleStore';
import { useUIStore } from '@/stores/uiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TooltipIconButton } from '@/components/common/TooltipIconButton';
import {
  Rss,
  Star,
  Newspaper,
  Plus,
  ChevronRight,
  RefreshCw,
  CheckCheck,
  Settings,
  List,
  FolderInput,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Feed, Folder as FolderType } from '@/types';
import logoImg from '@/assets/logo.png';

// ---- drag state ----
type DragItem =
  | { type: 'feed'; id: string }
  | { type: 'folder'; id: string };

type DropZone =
  | { kind: 'folder-inside'; folderId: string }
  | { kind: 'root' }
  | { kind: 'feed-edge'; feedId: string; position: 'before' | 'after' }
  | { kind: 'folder-edge'; folderId: string; position: 'before' | 'after' };

export function Sidebar() {
  const {
    feeds,
    folders,
    refreshingAll,
    refreshAll,
    moveFeed,
    reorderFeeds,
    reorderFolders,
  } = useFeedStore();
  const { selectedFeedId, setSelectedFeedId, markAllAsRead } = useArticleStore();
  const { setAddFeedOpen, setPage, currentPage } = useUIStore();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const [markAllConfirmOpen, setMarkAllConfirmOpen] = useState(false);
  // 记录哪些分组/根目录被用户手动拖拽重排过。
  // 未在集合中的分组默认按未读数降序排序；一旦用户拖拽过就按 sortOrder 排序。
  const [manuallySortedGroups, setManuallySortedGroups] = useState<Set<string>>(
    new Set()
  );

  const markGroupManual = (groupId: string) => {
    setManuallySortedGroups((prev) => {
      if (prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
  };

  const totalUnread = feeds.reduce((sum, f) => sum + f.unreadCount, 0);

  // 点击订阅源时切回阅读器并选中
  const selectFeed = (feedId: string | null) => {
    setPage('reader');
    setSelectedFeedId(feedId);
  };

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const feedsByFolder = useMemo(
    () => {
      const grouped = feeds.reduce(
        (acc, feed) => {
          const key = feed.folderId || '__root__';
          if (!acc[key]) acc[key] = [];
          acc[key].push(feed);
          return acc;
        },
        {} as Record<string, Feed[]>
      );

      // 对每个分组内的 feeds 进行排序
      Object.keys(grouped).forEach((groupId) => {
        const isManual = manuallySortedGroups.has(groupId);
        grouped[groupId].sort((a, b) => {
          if (isManual) {
            // 用户手动排序：按 sortOrder 升序
            return a.sortOrder - b.sortOrder;
          } else {
            // 默认排序：按未读数降序，未读数相同则按 sortOrder 升序
            if (b.unreadCount !== a.unreadCount) {
              return b.unreadCount - a.unreadCount;
            }
            return a.sortOrder - b.sortOrder;
          }
        });
      });

      return grouped;
    },
    [feeds, manuallySortedGroups]
  );

  const getFolderUnreadCount = (folderId: string) => {
    return feeds
      .filter((f) => f.folderId === folderId)
      .reduce((sum, f) => sum + f.unreadCount, 0);
  };

  // ---- drop handlers ----
  const handleDrop = useCallback(
    async (zone: DropZone) => {
      if (!dragItem) return;

      if (dragItem.type === 'feed') {
        const draggedFeed = feeds.find((f) => f.id === dragItem.id);
        if (!draggedFeed) return;

        if (zone.kind === 'root') {
          // 放到根目录
          await moveFeed(dragItem.id, null);
          markGroupManual('__root__');
        } else if (zone.kind === 'folder-inside') {
          // 放到分组内部末尾
          await moveFeed(dragItem.id, zone.folderId);
          markGroupManual(zone.folderId);
        } else if (zone.kind === 'feed-edge') {
          const targetFeed = feeds.find((f) => f.id === zone.feedId);
          if (!targetFeed) return;
          const targetFolderId = targetFeed.folderId || null;
          // 构造新的排序：在目标分组内，把被拖拽的 feed 插入到 target 的 before/after
          // 注意：这里要基于当前排序后的 siblings（可能是按未读数排序的）来计算位置
          const groupId = targetFolderId || '__root__';
          const currentSiblings = feedsByFolder[groupId] || [];
          const siblings = currentSiblings.filter((f) => f.id !== dragItem.id);
          const targetIndex = siblings.findIndex((f) => f.id === targetFeed.id);
          const insertIndex =
            zone.position === 'before' ? targetIndex : targetIndex + 1;
          siblings.splice(insertIndex, 0, draggedFeed);
          await reorderFeeds(
            siblings.map((f) => f.id),
            targetFolderId
          );
          markGroupManual(groupId);
          // 如果 feed 是从另一个分组拖过来的，那个分组也可能需要标记
          const sourceGroupId = draggedFeed.folderId || '__root__';
          if (sourceGroupId !== groupId) {
            markGroupManual(sourceGroupId);
          }
        }
      } else if (dragItem.type === 'folder') {
        if (zone.kind === 'folder-edge') {
          const newOrder = folders
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .filter((f) => f.id !== dragItem.id);
          const targetIndex = newOrder.findIndex((f) => f.id === zone.folderId);
          const insertIndex =
            zone.position === 'before' ? targetIndex : targetIndex + 1;
          newOrder.splice(insertIndex, 0, folders.find((f) => f.id === dragItem.id)!);
          await reorderFolders(newOrder.map((f) => f.id));
        }
      }

      setDragItem(null);
      setDropZone(null);
    },
    [dragItem, feeds, folders, feedsByFolder, moveFeed, reorderFeeds, reorderFolders]
  );

  const cancelDrag = () => {
    setDragItem(null);
    setDropZone(null);
  };

  /**
   * 刷新所有订阅源，全部完成后显示全局提示。
   */
  const handleRefreshAll = async () => {
    await refreshAll();
    showNotification({
      type: 'success',
      message: '订阅源已全部更新',
    });
  };

  const rootFeeds = feedsByFolder['__root__'] || [];
  const isReaderPage = currentPage === 'reader';

  return (
    <div
      className="flex h-full w-60 flex-col border-r bg-muted/30"
      onDragOver={(e) => {
        // 当拖拽的是 feed 并且鼠标在滚动区空白处 → 激活 root drop zone
        if (dragItem?.type === 'feed') {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        // 在容器空白处放下 → 移入根目录（仅当不是落在具体子项上）
        if (dragItem?.type === 'feed' && dropZone === null) {
          e.preventDefault();
          handleDrop({ kind: 'root' });
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 h-11">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="ZRSS" className="h-6 w-6" />
          <span className="font-semibold">ZRSS</span>
          {totalUnread > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {totalUnread}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <TooltipIconButton
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            ariaLabel={refreshingAll ? '正在刷新全部订阅源' : '一键刷新全部订阅源'}
            tooltip={refreshingAll ? '正在刷新全部订阅源' : '一键刷新全部订阅源'}
            tooltipAlign="end"
          >
            <RefreshCw className={cn('h-4 w-4', refreshingAll && 'animate-spin')} />
          </TooltipIconButton>
          <TooltipIconButton
            onClick={() => setMarkAllConfirmOpen(true)}
            ariaLabel="将全部未读文章标记为已读"
            tooltip="将全部未读文章标记为已读"
            tooltipAlign="end"
          >
            <CheckCheck className="h-4 w-4" />
          </TooltipIconButton>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Starred */}
          <SidebarItem
            icon={<Star className="h-4 w-4" />}
            label="星标"
            active={isReaderPage && selectedFeedId === '__starred__'}
            onClick={() => selectFeed('__starred__' as any)}
          />

          {/* All Articles */}
          <SidebarItem
            icon={<Newspaper className="h-4 w-4" />}
            label="全部文章"
            count={totalUnread}
            active={isReaderPage && selectedFeedId === null}
            onClick={() => selectFeed(null)}
          />

          {/* Separator */}
          <div className="my-2 border-t" />

          {/* Folders - 固定在最上方 */}
          {folders
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((folder) => {
              const folderFeeds = feedsByFolder[folder.id] || [];
              const collapsed = collapsedFolders.has(folder.id);
              const folderUnread = getFolderUnreadCount(folder.id);

              const isFolderDragging =
                dragItem?.type === 'folder' && dragItem.id === folder.id;
              const folderEdgeAbove =
                dragItem?.type === 'folder' &&
                dropZone?.kind === 'folder-edge' &&
                dropZone.folderId === folder.id &&
                dropZone.position === 'before';
              const folderEdgeBelow =
                dragItem?.type === 'folder' &&
                dropZone?.kind === 'folder-edge' &&
                dropZone.folderId === folder.id &&
                dropZone.position === 'after';
              const folderInsideActive =
                dragItem?.type === 'feed' &&
                dropZone?.kind === 'folder-inside' &&
                dropZone.folderId === folder.id;

              return (
                <div key={folder.id}>
                  {/* Folder reorder edge above */}
                  {dragItem?.type === 'folder' && folderEdgeAbove && (
                    <div className="h-0.5 mx-2 rounded-full bg-primary my-1" />
                  )}

                  <FolderHeader
                    folder={folder}
                    unreadCount={folderUnread}
                    collapsed={collapsed}
                    onToggle={() => toggleFolder(folder.id)}
                    isDragging={isFolderDragging}
                    insideActive={folderInsideActive}
                    onFolderDragStart={() =>
                      setDragItem({ type: 'folder', id: folder.id })
                    }
                    onFolderDragEnd={cancelDrag}
                    onFeedDragOver={() => {
                      if (dragItem?.type === 'feed') {
                        setDropZone({ kind: 'folder-inside', folderId: folder.id });
                      }
                    }}
                    onFeedDragLeave={() => {
                      if (
                        dropZone?.kind === 'folder-inside' &&
                        dropZone.folderId === folder.id
                      ) {
                        setDropZone(null);
                      }
                    }}
                    onFeedDrop={(e) => {
                      if (dragItem?.type === 'feed') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDrop({ kind: 'folder-inside', folderId: folder.id });
                      }
                    }}
                    onFolderDragOver={(position) => {
                      if (dragItem?.type === 'folder') {
                        setDropZone({
                          kind: 'folder-edge',
                          folderId: folder.id,
                          position,
                        });
                      }
                    }}
                    onFolderDragLeave={() => {
                      if (
                        dropZone?.kind === 'folder-edge' &&
                        dropZone.folderId === folder.id
                      ) {
                        setDropZone(null);
                      }
                    }}
                  />

                  <FolderFeedList collapsed={collapsed}>
                    {folderFeeds.map((feed) => {
                      const zoneActive =
                        dropZone?.kind === 'feed-edge' && dropZone.feedId === feed.id;
                      return (
                        <FeedItem
                          key={feed.id}
                          feed={feed}
                          active={isReaderPage && selectedFeedId === feed.id}
                          onClick={() => selectFeed(feed.id)}
                          indent
                          isDragging={
                            dragItem?.type === 'feed' && dragItem.id === feed.id
                          }
                          edgeAbove={
                            dragItem?.type === 'feed' &&
                            zoneActive &&
                            dropZone?.position === 'before'
                          }
                          edgeBelow={
                            dragItem?.type === 'feed' &&
                            zoneActive &&
                            dropZone?.position === 'after'
                          }
                          onDragStart={() =>
                            setDragItem({ type: 'feed', id: feed.id })
                          }
                          onDragEnd={cancelDrag}
                          onFeedDragOver={(position) => {
                            if (dragItem?.type === 'feed') {
                              setDropZone({
                                kind: 'feed-edge',
                                feedId: feed.id,
                                position,
                              });
                            }
                          }}
                          onFeedDragLeave={() => {
                            if (
                              dropZone?.kind === 'feed-edge' &&
                              dropZone.feedId === feed.id
                            ) {
                              setDropZone(null);
                            }
                          }}
                        />
                      );
                    })}
                  </FolderFeedList>

                  {/* Folder reorder edge below */}
                  {dragItem?.type === 'folder' && folderEdgeBelow && (
                    <div className="h-0.5 mx-2 rounded-full bg-primary my-1" />
                  )}
                </div>
              );
            })}

          {/* Feeds without folder - 按未读数排序 */}
          <div
            className={cn(
              'space-y-1',
              dragItem?.type === 'feed' && 'bg-primary/5 rounded-md p-1'
            )}
            onDragOver={(e) => {
              if (dragItem?.type === 'feed') {
                e.preventDefault();
                e.stopPropagation();
                setDropZone({ kind: 'root' });
              }
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              if (dropZone?.kind === 'root') setDropZone(null);
            }}
            onDrop={(e) => {
              if (dragItem?.type === 'feed') {
                e.preventDefault();
                e.stopPropagation();
                handleDrop({ kind: 'root' });
              }
            }}
          >
          {rootFeeds.map((feed) => {
            const zoneActive =
              dropZone?.kind === 'feed-edge' && dropZone.feedId === feed.id;
            return (
              <FeedItem
                key={feed.id}
                feed={feed}
                active={isReaderPage && selectedFeedId === feed.id}
                onClick={() => selectFeed(feed.id)}
                isDragging={dragItem?.type === 'feed' && dragItem.id === feed.id}
                edgeAbove={
                  dragItem?.type === 'feed' && zoneActive && dropZone?.position === 'before'
                }
                edgeBelow={
                  dragItem?.type === 'feed' && zoneActive && dropZone?.position === 'after'
                }
                onDragStart={() => setDragItem({ type: 'feed', id: feed.id })}
                onDragEnd={cancelDrag}
                onFeedDragOver={(position) => {
                  if (dragItem?.type === 'feed') {
                    setDropZone({ kind: 'feed-edge', feedId: feed.id, position });
                  }
                }}
                onFeedDragLeave={() => {
                  if (dropZone?.kind === 'feed-edge' && dropZone.feedId === feed.id) {
                    setDropZone(null);
                  }
                }}
              />
            );
          })}
          </div>
        </div>
      </ScrollArea>

      {/* Footer: add feed + navigation to management pages */}
      <div className="space-y-1 border-t p-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setAddFeedOpen(true)}
        >
          <Plus className="h-4 w-4" />
          添加订阅
        </Button>
        <SidebarItem
          icon={<List className="h-4 w-4" />}
          label="订阅管理"
          active={currentPage === 'subscriptions'}
          onClick={() => setPage('subscriptions')}
        />
        <SidebarItem
          icon={<Settings className="h-4 w-4" />}
          label="设置"
          active={currentPage === 'settings'}
          onClick={() => setPage('settings')}
        />
      </div>

      {/* 全部已读确认弹窗 */}
      <ConfirmDialog
        open={markAllConfirmOpen}
        onOpenChange={setMarkAllConfirmOpen}
        title="标记全部已读"
        description="确定将所有订阅源的未读文章都标记为已读吗？此操作无法撤销。"
        confirmText="全部已读"
        variant="destructive"
        onConfirm={() => {
          markAllAsRead();
          setMarkAllConfirmOpen(false);
        }}
      />
    </div>
  );
}

/**
 * 渲染分组下的订阅源列表，并为展开/收起提供高度与透明度过渡。
 */
function FolderFeedList({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={collapsed}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
        collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
      )}
    >
      <div
        className={cn(
          'min-h-0 overflow-hidden space-y-1',
          collapsed ? 'pointer-events-none' : 'pt-1'
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ---- 根目录拖拽区 ----
function RootDropZone({
  active,
  onDragOver,
  onDragLeave,
  onDrop,
  hasRootFeeds,
}: {
  active: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  hasRootFeeds: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors',
        hasRootFeeds ? 'py-0.5 mb-0.5' : 'py-1.5 mb-1',
        active
          ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30'
          : 'hover:bg-accent/30'
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="flex-1 truncate">根目录</span>
      {active && <FolderInput className="h-3 w-3" />}
    </div>
  );
}

// ---- 文件夹头 ----
function FolderHeader({
  folder,
  unreadCount,
  collapsed,
  onToggle,
  isDragging,
  insideActive,
  onFolderDragStart,
  onFolderDragEnd,
  onFeedDragOver,
  onFeedDragLeave,
  onFeedDrop,
  onFolderDragOver,
  onFolderDragLeave,
}: {
  folder: FolderType;
  unreadCount: number;
  collapsed: boolean;
  onToggle: () => void;
  isDragging: boolean;
  insideActive: boolean;
  onFolderDragStart: () => void;
  onFolderDragEnd: () => void;
  onFeedDragOver: () => void;
  onFeedDragLeave: () => void;
  onFeedDrop: (e: React.DragEvent) => void;
  onFolderDragOver: (position: 'before' | 'after') => void;
  onFolderDragLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `folder:${folder.id}`);
        onFolderDragStart();
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onFolderDragEnd();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const relY = (e.clientY - rect.top) / rect.height;

        // 同时触发 feed 和 folder 的回调，由外层根据 dragItem 类型决定是否处理
        onFeedDragOver();
        if (relY < 0.25) {
          onFolderDragOver('before');
        } else if (relY > 0.75) {
          onFolderDragOver('after');
        }
      }}
      onDragLeave={(e) => {
        // 仅在真正离开这个元素时触发（不计入子元素）
        const related = e.relatedTarget as Node | null;
        if (ref.current && related && ref.current.contains(related)) return;
        onFeedDragLeave();
        onFolderDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFeedDrop(e);
      }}
      onClick={(e) => {
        // 拖拽时不触发点击
        if (isDragging) {
          e.preventDefault();
          return;
        }
        onToggle();
      }}
      className={cn(
        'flex items-center gap-1 cursor-grab rounded px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 select-none transition-colors',
        isDragging && 'opacity-40',
        insideActive &&
          'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30'
      )}
      title="拖拽分组可调整顺序；将订阅源拖到分组上可移入该分组"
    >
      <ChevronRight
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out',
          !collapsed && 'rotate-90'
        )}
      />
      <span className="flex-1 truncate">{folder.name}</span>
      {unreadCount > 0 && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {unreadCount}
        </Badge>
      )}
    </div>
  );
}

// ---- Feed 列表项 ----
function FeedItem({
  feed,
  active,
  onClick,
  indent = false,
  isDragging = false,
  edgeAbove = false,
  edgeBelow = false,
  onDragStart,
  onDragEnd,
  onFeedDragOver,
  onFeedDragLeave,
}: {
  feed: { id: string; title: string; favicon: string; unreadCount: number };
  active: boolean;
  onClick: () => void;
  indent?: boolean;
  isDragging?: boolean;
  edgeAbove?: boolean;
  edgeBelow?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onFeedDragOver: (position: 'before' | 'after') => void;
  onFeedDragLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      {edgeAbove && (
        <div
          className={cn(
            'h-0.5 rounded-full bg-primary mx-2',
            indent ? 'ml-6' : 'ml-2'
          )}
        />
      )}
      <div
        ref={ref}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `feed:${feed.id}`);
          // 使用自定义拖拽图像
          if (ref.current) {
            e.dataTransfer.setDragImage(ref.current, 12, 12);
          }
          onDragStart();
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          onDragEnd();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          const relY = (e.clientY - rect.top) / rect.height;
          const position: 'before' | 'after' = relY < 0.5 ? 'before' : 'after';
          onFeedDragOver(position);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          onFeedDragLeave();
        }}
        onClick={(e) => {
          if (isDragging) {
            e.preventDefault();
            return;
          }
          onClick();
        }}
        className={cn(
          'group flex items-center gap-2 cursor-grab rounded-md px-2 py-1.5 text-sm transition-colors select-none',
          indent && 'ml-4',
          isDragging && 'opacity-40',
          !isDragging &&
            (active
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent/50')
        )}
        title="拖拽可移动到其他分组或根目录"
      >
        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
          {feed.favicon ? (
            <img src={feed.favicon} alt="" className="h-4 w-4 rounded-sm" />
          ) : (
            <Rss className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <span className="flex-1 truncate">{feed.title}</span>
        {feed.unreadCount > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 min-w-[1.25rem] justify-center"
          >
            {feed.unreadCount}
          </Badge>
        )}
      </div>
      {edgeBelow && (
        <div
          className={cn(
            'h-0.5 rounded-full bg-primary mx-2',
            indent ? 'ml-6' : 'ml-2'
          )}
        />
      )}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors',
        active ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/50'
      )}
      onClick={onClick}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {count}
        </Badge>
      )}
    </div>
  );
}
