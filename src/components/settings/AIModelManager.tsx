import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getSettings, saveSettings } from '@/lib/db';
import { fetchModels, generateProviderId } from '@/lib/ai/models';
import { chatSimple, AIError } from '@/lib/ai/client';
import { AI_PROVIDER_PRESETS } from '@/types/ai';
import type { AIApiFormat } from '@/types/ai';
import type { Settings } from '@/types';

type ProviderConfig = Settings['aiProviders'][string];

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (provider: ProviderConfig) => void;
  existingProviders: Record<string, ProviderConfig>;
}

function AddProviderDialog({
  open,
  onOpenChange,
  onAdd,
  existingProviders,
}: AddProviderDialogProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiFormat, setCustomApiFormat] = useState<AIApiFormat>('openai');

  const handleAdd = () => {
    const id = generateProviderId();

    if (mode === 'preset') {
      const preset = AI_PROVIDER_PRESETS.find((p) => p.id === selectedPresetId);
      if (!preset) return;

      const provider: ProviderConfig = {
        id,
        name: preset.name,
        baseUrl: preset.baseUrl,
        apiKey: '',
        apiFormat: preset.apiFormat,
        models: [...preset.suggestedModels],
        currentModel: preset.suggestedModels[0] || '',
      };
      onAdd(provider);
    } else {
      if (!customName.trim()) return;

      const provider: ProviderConfig = {
        id,
        name: customName.trim(),
        baseUrl: customBaseUrl.trim(),
        apiKey: '',
        apiFormat: customApiFormat,
        models: [],
        currentModel: '',
      };
      onAdd(provider);
    }

    // 重置表单
    setMode('preset');
    setSelectedPresetId('');
    setCustomName('');
    setCustomBaseUrl('');
    setCustomApiFormat('openai');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加 AI 供应商</DialogTitle>
          <DialogDescription>
            选择预设供应商或自定义配置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 模式选择 */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'preset' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('preset')}
            >
              选择预设
            </Button>
            <Button
              variant={mode === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('custom')}
            >
              自定义
            </Button>
          </div>

          {mode === 'preset' ? (
            <div className="space-y-2">
              <Label>选择供应商</Label>
              <ScrollArea className="h-[200px] rounded-md border p-2">
                <div className="space-y-1">
                  {AI_PROVIDER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`w-full text-left p-2 rounded-md transition-colors ${
                        selectedPresetId === preset.id
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedPresetId(preset.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{preset.name}</span>
                        {selectedPresetId === preset.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {preset.description}
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>供应商名称</Label>
                <Input
                  placeholder="例如：我的 API"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>API Base URL</Label>
                <Input
                  placeholder="https://api.example.com/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>API 格式</Label>
                <select
                  value={customApiFormat}
                  onChange={(e) => setCustomApiFormat(e.target.value as AIApiFormat)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="openai">OpenAI 兼容</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                mode === 'preset'
                  ? !selectedPresetId
                  : !customName.trim()
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              添加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AIModelManager() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [customModel, setCustomModel] = useState('');

  // 加载设置
  useEffect(() => {
    const load = async () => {
      const s = await getSettings();
      setSettings(s);

      // 默认选中第一个或活跃供应商
      const providerIds = Object.keys(s.aiProviders);
      if (s.activeProviderId && s.aiProviders[s.activeProviderId]) {
        setSelectedProviderId(s.activeProviderId);
      } else if (providerIds.length > 0) {
        setSelectedProviderId(providerIds[0]);
      }
    };
    load();
  }, []);

  if (!settings) return null;

  const providers = settings.aiProviders;
  const providerIds = Object.keys(providers);
  const selectedProvider = selectedProviderId ? providers[selectedProviderId] : null;

  // 更新供应商配置
  const updateProvider = async (id: string, updates: Partial<ProviderConfig>) => {
    const newProviders = {
      ...providers,
      [id]: { ...providers[id], ...updates },
    };
    const newSettings = await saveSettings({ aiProviders: newProviders });
    setSettings(newSettings);
  };

  // 添加供应商
  const handleAddProvider = async (provider: ProviderConfig) => {
    const newProviders = { ...providers, [provider.id]: provider };
    const isActive = !settings.activeProviderId; // 如果是第一个供应商，自动激活
    const newSettings = await saveSettings({
      aiProviders: newProviders,
      activeProviderId: isActive ? provider.id : settings.activeProviderId,
    });
    setSettings(newSettings);
    setSelectedProviderId(provider.id);
  };

  // 删除供应商
  const handleDeleteProvider = async (id: string) => {
    const newProviders = { ...providers };
    delete newProviders[id];

    let newActiveId = settings.activeProviderId;
    if (newActiveId === id) {
      // 如果删除的是活跃供应商，选择第一个或置空
      const remaining = Object.keys(newProviders);
      newActiveId = remaining.length > 0 ? remaining[0] : null;
    }

    const newSettings = await saveSettings({
      aiProviders: newProviders,
      activeProviderId: newActiveId,
    });
    setSettings(newSettings);

    if (selectedProviderId === id) {
      setSelectedProviderId(newActiveId);
    }
  };

  // 激活供应商
  const handleActivateProvider = async (id: string) => {
    setSelectedProviderId(id);
    const newSettings = await saveSettings({ activeProviderId: id });
    setSettings(newSettings);
  };

  // 获取模型列表
  const handleFetchModels = async () => {
    if (!selectedProvider) return;

    setFetchingModels(true);
    try {
      const models = await fetchModels(
        selectedProvider.baseUrl,
        selectedProvider.apiKey,
        selectedProvider.apiFormat
      );

      await updateProvider(selectedProvider.id, {
        models,
        modelsUpdatedAt: Date.now(),
        // 如果当前模型不在列表中，选择第一个
        currentModel:
          models.length > 0 && !models.includes(selectedProvider.currentModel)
            ? models[0]
            : selectedProvider.currentModel,
      });
    } catch (err) {
      console.error('获取模型列表失败:', err);
    } finally {
      setFetchingModels(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!selectedProvider) return;

    setTestingConnection(true);
    setTestResult(null);

    try {
      const config = {
        baseUrl: selectedProvider.baseUrl,
        apiKey: selectedProvider.apiKey,
        apiFormat: selectedProvider.apiFormat,
        currentModel: selectedProvider.currentModel,
      };

      await chatSimple(
        [{ role: 'user', content: '请回复"连接成功"' }],
        config as ProviderConfig
      );

      setTestResult({ success: true, message: '连接成功！' });
    } catch (err) {
      const message = err instanceof AIError ? err.message : '连接失败';
      setTestResult({ success: false, message });
    } finally {
      setTestingConnection(false);
    }
  };

  // 添加自定义模型
  const handleAddCustomModel = () => {
    if (!selectedProvider || !customModel.trim()) return;

    const model = customModel.trim();
    const models = [...selectedProvider.models];
    if (!models.includes(model)) {
      models.push(model);
    }

    updateProvider(selectedProvider.id, {
      models,
      currentModel: model,
    });
    setCustomModel('');
  };

  return (
    <div className="flex h-[500px] gap-4">
      {/* 左侧：供应商列表 */}
      <div className="w-[200px] flex flex-col border rounded-md">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium">供应商</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1">
            {providerIds.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                暂无供应商
                <br />
                点击上方 + 添加
              </div>
            ) : (
              providerIds.map((id) => {
                const p = providers[id];
                const isActive = settings.activeProviderId === id;
                const isSelected = selectedProviderId === id;

                return (
                  <div
                    key={id}
                    className={`flex items-center gap-1 p-2 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-accent' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedProviderId(id)}
                  >
                    <button
                      className={`flex-1 text-left text-sm truncate ${
                        isActive ? 'font-medium' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActivateProvider(id);
                      }}
                      title={isActive ? '当前使用中' : '点击启用'}
                    >
                      <div className="flex items-center gap-1">
                        {isActive && <Check className="h-3 w-3 text-green-500 shrink-0" />}
                        <span className="truncate">{p.name}</span>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确定删除供应商 "${p.name}"？`)) {
                          handleDeleteProvider(id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧：配置面板 */}
      <div className="flex-1 border rounded-md p-4 overflow-auto">
        {selectedProvider ? (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">供应商配置</h3>
              {settings.activeProviderId !== selectedProvider.id && (
                <Button
                  size="sm"
                  onClick={() => handleActivateProvider(selectedProvider.id)}
                >
                  启用此供应商
                </Button>
              )}
            </div>

            {/* 名称 */}
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                placeholder="供应商名称"
                value={selectedProvider.name}
                onChange={(e) =>
                  updateProvider(selectedProvider.id, { name: e.target.value })
                }
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={selectedProvider.apiKey}
                  onChange={(e) =>
                    updateProvider(selectedProvider.id, { apiKey: e.target.value })
                  }
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label>API Base URL</Label>
              <Input
                placeholder="https://api.example.com/v1"
                value={selectedProvider.baseUrl}
                onChange={(e) =>
                  updateProvider(selectedProvider.id, { baseUrl: e.target.value })
                }
              />
            </div>

            {/* API 格式 */}
            <div className="space-y-2">
              <Label>API 格式</Label>
              <select
                value={selectedProvider.apiFormat}
                onChange={(e) =>
                  updateProvider(selectedProvider.id, {
                    apiFormat: e.target.value as AIApiFormat,
                  })
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="openai">OpenAI 兼容</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            {/* 模型选择 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>模型</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={handleFetchModels}
                  disabled={fetchingModels || !selectedProvider.apiKey}
                >
                  {fetchingModels ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  获取列表
                </Button>
              </div>

              {selectedProvider.models.length > 0 ? (
                <select
                  value={selectedProvider.currentModel}
                  onChange={(e) =>
                    updateProvider(selectedProvider.id, {
                      currentModel: e.target.value,
                    })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {selectedProvider.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="输入模型名称，例如 gpt-4"
                  value={selectedProvider.currentModel}
                  onChange={(e) =>
                    updateProvider(selectedProvider.id, {
                      currentModel: e.target.value,
                    })
                  }
                />
              )}

              {/* 添加自定义模型 */}
              <div className="flex gap-2">
                <Input
                  placeholder="添加自定义模型"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomModel();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomModel}
                  disabled={!customModel.trim()}
                >
                  添加
                </Button>
              </div>
            </div>

            {/* 测试连接 */}
            <div className="space-y-2 pt-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={
                  testingConnection ||
                  !selectedProvider.apiKey ||
                  !selectedProvider.currentModel
                }
                className="gap-1"
              >
                {testingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                测试连接
              </Button>
              {testResult && (
                <div
                  className={`text-sm ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {providerIds.length === 0
              ? '请添加 AI 供应商'
              : '请选择一个供应商'}
          </div>
        )}
      </div>

      {/* 添加供应商对话框 */}
      <AddProviderDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddProvider}
        existingProviders={providers}
      />
    </div>
  );
}
