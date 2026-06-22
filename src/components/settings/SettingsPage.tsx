import { useUIStore } from '@/stores/uiStore';
import { useFeedStore } from '@/stores/feedStore';
import { useNotificationStore } from '@/stores/notificationStore';
import logoImg from '@/assets/logo.png';
import packageJson from '../../../package.json';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { PasswordInput } from '@/components/common/PasswordInput';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { exportToOPML, importFromOPML } from '@/lib/opml';
import {
  exportToWebDAV,
  importFromWebDAV,
  testWebDAVConnection,
  listWebDAVBackups,
  deleteWebDAVBackup,
} from '@/lib/sync/webdav';
import { AIModelManager } from './AIModelManager';
import {
  Download,
  Upload,
  Cloud,
  Settings as SettingsIcon,
  ArrowUpDown,
  CloudCog,
  Trash2,
  Brain,
  Info,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsSection = 'general' | 'opml' | 'sync' | 'ai' | 'about';

const sections: { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: 'general', label: '通用', icon: <SettingsIcon className="h-4 w-4" /> },
  { id: 'opml', label: '导入 / 导出', icon: <ArrowUpDown className="h-4 w-4" /> },
  { id: 'sync', label: 'WebDAV 同步', icon: <CloudCog className="h-4 w-4" /> },
  { id: 'ai', label: 'AI 服务', icon: <Brain className="h-4 w-4" /> },
  { id: 'about', label: '关于', icon: <Info className="h-4 w-4" /> },
];

export function SettingsPage() {
  const { settings, loadSettings, updateSettings, theme, setTheme } = useUIStore();
  const { loadFeeds, loadFolders } = useFeedStore();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string>('');
  const appVersion = packageJson.version;

  useEffect(() => {
    if (!settings) {
      loadSettings();
    }
  }, [settings, loadSettings]);

  /**
   * 使用全局提示展示设置保存结果。
   */
  const notifySettingsSaved = (message = '设置已保存') => {
    showNotification({
      type: 'success',
      message,
      duration: 1800,
    });
  };

  /**
   * 保存设置并显示全局提示。
   */
  const handleUpdateSettings = async (
    updates: Parameters<typeof updateSettings>[0],
    message?: string
  ) => {
    await updateSettings(updates);
    notifySettingsSaved(message);
  };

  /**
   * 切换主题并显示全局提示。
   */
  const handleSetTheme = async (nextTheme: 'light' | 'dark' | 'system') => {
    await setTheme(nextTheme);
    notifySettingsSaved('主题已更新');
  };

  /**
   * 导入外部数据后刷新依赖本地库的页面状态。
   */
  const reloadImportedLibraryState = async (includeSettings = false) => {
    await Promise.all([
      loadFeeds(),
      loadFolders(),
      ...(includeSettings ? [loadSettings()] : []),
    ]);
  };

  const handleExportOPML = async () => {
    try {
      const opml = await exportToOPML();
      const blob = new Blob([opml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zrss-subscriptions-${new Date().toISOString().slice(0, 10)}.opml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification({ type: 'success', message: 'OPML 导出成功' });
    } catch (err) {
      showNotification({ type: 'error', message: `OPML 导出失败：${err}` });
    }
  };

  const handleImportOPML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importFromOPML(text);
      await reloadImportedLibraryState();
      showNotification({
        message: `已导入 ${result.added} 个订阅` +
          (result.errors.length > 0 ? `，${result.errors.length} 个错误` : ''),
        type: result.errors.length > 0 ? 'warning' : 'success',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      showNotification({ type: 'error', message: `OPML 导入失败：${err}` });
    }
  };

  if (!settings) return null;

  return (
    <div className="flex h-full w-full">
      {/* 左侧菜单 */}
      <div className="w-48 shrink-0 border-r bg-muted/20">
        <div className="px-4 py-4">
          <h2 className="text-[15px] font-semibold text-muted-foreground">设置</h2>
        </div>
        <nav className="space-y-0.5 px-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                setBackupFiles([]);
                setShowBackupDialog(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-[15px] transition-colors',
                activeSection === section.id
                  ? 'bg-brand-soft font-medium text-brand dark:bg-brand-soft/45'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 overflow-hidden">
        {activeSection === 'ai' ? (
          /* AI 服务 - 特殊布局 */
          <div className="h-full p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">AI 服务</h2>
              <p className="text-sm text-muted-foreground">
                管理 AI 供应商配置，选择当前使用的模型
              </p>
            </div>
            <AIModelManager />
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="mx-auto w-full max-w-xl space-y-6 p-6">
              {activeSection === 'general' && (
                <>
                  {/* Theme */}
                  <section className="space-y-3">
                    <Label>主题</Label>
                    <div className="flex gap-2">
                      {(['light', 'dark', 'system'] as const).map((t) => (
                        <Button
                          key={t}
                          variant={theme === t ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleSetTheme(t)}
                          className="capitalize"
                        >
                          {t === 'light' ? '浅色' : t === 'dark' ? '深色' : '跟随系统'}
                        </Button>
                      ))}
                    </div>
                  </section>

                  {/* Refresh interval */}
                  <section className="space-y-2">
                    <Label htmlFor="refresh-interval">刷新间隔（分钟）</Label>
                    <Input
                      id="refresh-interval"
                      type="number"
                      min={1}
                      max={120}
                      value={settings.refreshInterval}
                      onChange={(e) =>
                        handleUpdateSettings({
                          refreshInterval: Number(e.target.value) || 15,
                        }, '刷新间隔已保存')
                      }
                    />
                  </section>

                  {/* Auto mark read */}
                  <section className="flex items-center justify-between">
                    <div>
                      <Label>自动标记为已读</Label>
                      <p className="text-xs text-muted-foreground">
                        打开文章时自动标记为已读
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoMarkRead}
                      onCheckedChange={(checked) =>
                        handleUpdateSettings({ autoMarkRead: checked }, '自动标记已读设置已保存')
                      }
                    />
                  </section>

                  {/* AI summary feature */}
                  <section className="flex items-center justify-between">
                    <div>
                      <Label>AI 摘要功能</Label>
                      <p className="text-xs text-muted-foreground">
                        启用后可对文章生成摘要和翻译（需先在 AI 服务中配置供应商）
                      </p>
                    </div>
                    <Switch
                      checked={settings.aiEnabled}
                      onCheckedChange={(checked) =>
                        handleUpdateSettings({ aiEnabled: checked }, 'AI 摘要功能设置已保存')
                      }
                    />
                  </section>

                  {/* AI auto summarize */}
                  <section className="flex items-center justify-between">
                    <div>
                      <Label>自动 AI 摘要</Label>
                      <p className="text-xs text-muted-foreground">
                        打开文章时自动生成摘要，关闭后需手动点击按钮
                      </p>
                    </div>
                    <Switch
                      checked={settings.aiAutoSummarize}
                      onCheckedChange={(checked) =>
                        handleUpdateSettings({ aiAutoSummarize: checked }, '自动 AI 摘要设置已保存')
                      }
                      disabled={!settings.aiEnabled}
                    />
                  </section>

                  {/* Max articles per feed */}
                  <section className="space-y-2">
                    <Label htmlFor="max-articles">每个订阅最大文章数</Label>
                    <Input
                      id="max-articles"
                      type="number"
                      min={50}
                      max={5000}
                      value={settings.maxArticlesPerFeed}
                      onChange={(e) =>
                        handleUpdateSettings({
                          maxArticlesPerFeed: Number(e.target.value) || 500,
                        }, '文章保留数量已保存')
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      星标文章永远不会被删除。
                    </p>
                  </section>
                </>
              )}

              {activeSection === 'opml' && (
                <>
                  <section className="space-y-3">
                    <Label className="text-base font-semibold">OPML 导入 / 导出</Label>
                    <p className="text-sm text-muted-foreground">
                      将订阅导出为 OPML 格式，或从其他阅读器导入订阅。
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportOPML}>
                        <Download className="mr-2 h-4 w-4" />
                        导出 OPML
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        导入 OPML
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".opml,.xml"
                        className="hidden"
                        onChange={handleImportOPML}
                      />
                    </div>
                  </section>
                </>
              )}

              {activeSection === 'sync' && (
                <>
                  <section className="space-y-3">
                    <Label className="text-base font-semibold">WebDAV 同步</Label>
                    <p className="text-sm text-muted-foreground">
                      通过 WebDAV 同步订阅源（含分组）与扩展设置到云端。WebDAV 自身凭据不会被同步。
                    </p>
                    <div className="space-y-2">
                      <Input
                        placeholder="WebDAV 链接"
                        value={settings.webdavUrl}
                        onChange={(e) =>
                          handleUpdateSettings({ webdavUrl: e.target.value }, 'WebDAV 链接已保存')
                        }
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="用户名"
                          value={settings.webdavUser}
                          onChange={(e) =>
                            handleUpdateSettings({ webdavUser: e.target.value }, 'WebDAV 用户名已保存')
                          }
                          className="flex-1"
                        />
                        <PasswordInput
                          placeholder="密码"
                          value={settings.webdavPass}
                          onChange={(e) =>
                            handleUpdateSettings({ webdavPass: e.target.value }, 'WebDAV 密码已保存')
                          }
                          className="flex-1"
                        />
                      </div>
                      <Input
                        placeholder="保存目录 (留空使用 WebDAV 根目录，例如 zrss)"
                        value={settings.webdavPath}
                        onChange={(e) =>
                          handleUpdateSettings({ webdavPath: e.target.value }, 'WebDAV 保存目录已保存')
                        }
                      />
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const result = await testWebDAVConnection();
                            showNotification({
                              message: result.message,
                              type: result.success ? 'success' : 'error',
                            });
                          }}
                        >
                          <Cloud className="mr-2 h-4 w-4" />
                          测试连接
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const result = await exportToWebDAV();
                            showNotification({
                              message: result.message,
                              type: result.success ? 'success' : 'error',
                            });
                          }}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          上传同步
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const result = await listWebDAVBackups();
                            if (result.success) {
                              setBackupFiles(result.files);
                              setShowBackupDialog(true);
                              showNotification({ message: result.message, type: 'success' });
                            } else {
                              showNotification({ message: result.message, type: 'error' });
                            }
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          下载同步
                        </Button>
                      </div>
                      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>选择备份文件</DialogTitle>
                            <DialogDescription>
                              共找到 {backupFiles.length} 个备份，点击导入或右侧删除。
                            </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="max-h-80">
                            {backupFiles.length === 0 ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">
                                暂无备份文件
                              </div>
                            ) : (
                              <ul className="space-y-1">
                                {backupFiles.map((file) => (
                                  <li
                                    key={file}
                                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                                  >
                                    <span className="flex-1 truncate text-sm">{file}</span>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          const result = await importFromWebDAV(file);
                                          showNotification({
                                            message: result.message,
                                            type: result.success ? 'success' : 'error',
                                          });
                                          if (result.success) {
                                            await reloadImportedLibraryState(true);
                                            setShowBackupDialog(false);
                                          }
                                        }}
                                      >
                                        导入
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        disabled={deletingFile === file}
                                        onClick={async () => {
                                          if (!confirm(`确定删除备份 ${file}？`)) return;
                                          setDeletingFile(file);
                                          const result = await deleteWebDAVBackup(file);
                                          setDeletingFile('');
                                          if (result.success) {
                                            setBackupFiles((prev) => prev.filter((f) => f !== file));
                                            showNotification({ message: result.message, type: 'success' });
                                          } else {
                                            showNotification({ message: result.message, type: 'error' });
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </section>
                </>
              )}

              {activeSection === 'about' && (
                <>
                  <section className="space-y-4">
                    <div className="space-y-3">
                      <img
                        src={logoImg}
                        alt="ZRSS"
                        className="h-14 w-14 rounded-xl border bg-background object-contain p-2"
                      />
                      <Label className="block pt-1 text-base font-semibold">关于 ZRSS</Label>
                      <p className="text-sm leading-6 text-muted-foreground">
                        ZRSS 是一款界面简洁的现代 RSS 阅读器浏览器扩展，帮助你集中订阅、阅读和管理信息源。
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between border-b py-2">
                        <span className="text-muted-foreground">当前版本</span>
                        <span className="font-medium">{appVersion}</span>
                      </div>
                      <div className="flex items-center justify-between border-b py-2">
                        <span className="text-muted-foreground">GitHub</span>
                        <a
                          href="https://github.com/anghunk/zrss"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          anghunk/zrss
                        </a>
                      </div>
                    </div>
                  </section>
                </>
              )}

              <div className="h-6" />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
