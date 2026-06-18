import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import {
  AlibabaCloud,
  Anthropic,
  DeepSeek,
  Ollama,
  OpenAI,
} from '@lobehub/icons';
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
import { getSettings, saveSettings } from '@/lib/db';
import { fetchModels, generateProviderId } from '@/lib/ai/models';
import { chatSimple, AIError } from '@/lib/ai/client';
import { AI_PROVIDER_PRESETS } from '@/types/ai';
import type { AIApiFormat, AIProviderPreset } from '@/types/ai';
import type { Settings } from '@/types';

type ProviderConfig = Settings['aiProviders'][string];

interface ProviderNameInputProps {
  provider: ProviderConfig;
  onSave: (name: string) => Promise<void>;
}

/**
 * 供应商名称输入框，使用本地草稿避免中文输入法组词时被异步保存打断。
 */
function ProviderNameInput({ provider, onSave }: ProviderNameInputProps) {
  const [draftName, setDraftName] = useState(provider.name);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftName(provider.name);
  }, [provider.id, provider.name]);

  /**
   * 保存非空名称，空名称会回退到已保存值。
   */
  const commitName = async () => {
    const nextName = draftName.trim();
    if (!nextName) {
      setDraftName(provider.name);
      return;
    }
    if (nextName === provider.name || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(nextName);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Input
      placeholder="供应商名称"
      value={draftName}
      onChange={(e) => setDraftName(e.target.value)}
      onBlur={commitName}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.currentTarget.blur();
        }
      }}
      disabled={isSaving}
    />
  );
}

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (provider: ProviderConfig) => void;
  existingProviders: Record<string, ProviderConfig>;
}

/**
 * 根据预设类型渲染供应商图标。
 */
function PresetIcon({ preset }: { preset: AIProviderPreset }) {
  const iconProps = { size: 24 };

  switch (preset.icon) {
    case 'openai':
      return <OpenAI.Avatar {...iconProps} />;
    case 'deepseek':
      return <DeepSeek.Avatar {...iconProps} />;
    case 'aliyun':
      return <AlibabaCloud.Avatar {...iconProps} />;
    case 'ollama':
    case 'ollama-cloud':
      return <Ollama.Avatar {...iconProps} />;
    case 'anthropic':
      return <Anthropic.Avatar {...iconProps} />;
    default:
      return <OpenAI.Avatar {...iconProps} />;
  }
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
      <DialogContent className="max-w-2xl">
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
              <ScrollArea className="h-[360px]">
                <div className="grid grid-cols-3 gap-2 pr-3">
                  {AI_PROVIDER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className={`flex min-h-[84px] flex-col items-start justify-between rounded-md border p-3 text-left transition-colors ${
                        selectedPresetId === preset.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input hover:bg-muted'
                      }`}
                      onClick={() => setSelectedPresetId(preset.id)}
                      title={preset.description}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <PresetIcon preset={preset} />
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {preset.apiFormat === 'ollama'
                            ? 'Ollama'
                            : preset.apiFormat === 'anthropic'
                              ? 'Claude'
                              : 'OpenAI'}
                        </span>
                      </div>
                      <span className="mt-3 text-sm font-medium text-foreground">
                        {preset.name}
                      </span>
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
                  <option value="ollama">Ollama 原生</option>
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

  /**
   * 通过列表右侧开关切换当前启用的供应商。
   */
  const handleToggleActiveProvider = async (id: string, checked: boolean) => {
    setSelectedProviderId(id);
    const newSettings = await saveSettings({
      activeProviderId: checked ? id : null,
    });
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
                    className={`flex items-center justify-between gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-accent' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedProviderId(id)}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        isActive ? 'font-medium' : ''
                      }`}
                      title={p.name}
                    >
                      {p.name}
                    </span>
                    <Switch
                      checked={isActive}
                      aria-label={isActive ? '停用此供应商' : '启用此供应商'}
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onCheckedChange={(checked) =>
                        handleToggleActiveProvider(id, checked)
                      }
                    />
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
              <div>
                <h3 className="font-medium">供应商配置</h3>
                {settings.activeProviderId === selectedProvider.id && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    当前使用中
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`确定删除供应商 "${selectedProvider.name}"？`)) {
                      handleDeleteProvider(selectedProvider.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>

            {/* 名称 */}
            <div className="space-y-2">
              <Label>名称</Label>
              <ProviderNameInput
                provider={selectedProvider}
                onSave={(name) =>
                  updateProvider(selectedProvider.id, { name })
                }
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label>API Key</Label>
              <PasswordInput
                placeholder="sk-..."
                value={selectedProvider.apiKey}
                onChange={(e) =>
                  updateProvider(selectedProvider.id, { apiKey: e.target.value })
                }
                toggleLabel="查看 API Key"
              />
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
                <option value="ollama">Ollama 原生</option>
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
