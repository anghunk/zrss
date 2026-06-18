import { useState } from 'react';
import { useArticleStore } from '@/stores/articleStore';
import { useUIStore } from '@/stores/uiStore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Menu, Search } from 'lucide-react';
import type { FilterType } from '@/types';

export function TopBar() {
  const { filter, setFilter, searchQuery, setSearchQuery } = useArticleStore();
  const { toggleSidebar, currentPage } = useUIStore();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex h-12 items-center gap-3 border-b bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={toggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {currentPage === 'reader' && (
        <>
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            {searchOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  placeholder="搜索文章..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8"
                  onBlur={() => !searchQuery && setSearchOpen(false)}
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-muted-foreground"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
                <span>搜索...</span>
              </Button>
            )}
          </div>

          {/* Filter tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3 h-7">全部</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs px-3 h-7">未读</TabsTrigger>
              <TabsTrigger value="starred" className="text-xs px-3 h-7">星标</TabsTrigger>
            </TabsList>
          </Tabs>
        </>
      )}
    </div>
  );
}
