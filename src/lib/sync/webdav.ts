import { db } from '../db';
import { getSettings, saveSettings } from '../db';
import type { Feed, Folder, Settings } from '@/types';

interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  path: string;
}

function buildBasePath(config: WebDAVConfig): string {
  const baseUrl = config.url.replace(/\/+$/, '');
  if (!config.path) return baseUrl;
  const subPath = config.path.replace(/^\/+|\/+$/g, '');
  if (!subPath) return baseUrl;
  // 如果 URL 已经以该目录结尾，不再重复拼接
  if (baseUrl.endsWith('/' + subPath)) return baseUrl;
  return `${baseUrl}/${subPath}`;
}

// 导出数据到 WebDAV
export async function exportToWebDAV(): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await getSettings();
    if (!settings.webdavUrl || !settings.webdavUser || !settings.webdavPass) {
      return { success: false, message: 'WebDAV 配置不完整' };
    }

    const config: WebDAVConfig = {
      url: settings.webdavUrl,
      username: settings.webdavUser,
      password: settings.webdavPass,
      path: settings.webdavPath || '',
    };

    // 收集所有数据
    const feeds = await db.feeds.toArray();
    const folders = await db.folders.toArray();

    // 同步扩展设置时剔除 WebDAV 自身凭据，避免覆盖目标设备配置
    const {
      webdavUrl: _u,
      webdavUser: _us,
      webdavPass: _p,
      webdavPath: _pa,
      ...syncableSettings
    } = settings;

    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      feeds,
      folders,
      settings: syncableSettings,
    };

    const json = JSON.stringify(exportData, null, 2);
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `zrss-backup-${timestamp}.json`;
    const baseUrl = buildBasePath(config);
    const filePath = `${baseUrl}/${fileName}`;
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);

    // 确保目录存在（409 时尝试 MKCOL 创建）
    const ensureDir = async (url: string) => {
      const res = await fetch(url, {
        method: 'MKCOL',
        headers: { 'Authorization': authHeader },
      });
      // 201 创建成功，405 已存在，都算成功
      if (!res.ok && res.status !== 405) return false;
      return true;
    };

    // 上传到 WebDAV
    let response = await fetch(filePath, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: json,
    });

    // 409 Conflict：父目录不存在，尝试逐级创建
    if (response.status === 409) {
      const parts = new URL(baseUrl).pathname.split('/').filter(Boolean);
      const origin = new URL(baseUrl).origin;
      let path = '';
      for (const part of parts) {
        path += '/' + part;
        await ensureDir(origin + path);
      }
      // 重试上传
      response = await fetch(filePath, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: json,
      });
    }

    if (!response.ok) {
      throw new Error(`WebDAV 上传失败: ${response.status} ${response.statusText}`);
    }

    return { success: true, message: `已导出 ${feeds.length} 个订阅、${folders.length} 个分组和扩展设置到 ${fileName}` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : '未知错误',
    };
  }
}

// 获取 WebDAV 备份文件列表
export async function listWebDAVBackups(): Promise<{ success: boolean; files: string[]; message: string }> {
  try {
    const settings = await getSettings();
    if (!settings.webdavUrl || !settings.webdavUser || !settings.webdavPass) {
      return { success: false, files: [], message: 'WebDAV 配置不完整' };
    }

    const config: WebDAVConfig = {
      url: settings.webdavUrl,
      username: settings.webdavUser,
      password: settings.webdavPass,
      path: settings.webdavPath || '',
    };

    const baseUrl = buildBasePath(config);
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);

    // 使用 PROPFIND 列出目录内容
    const response = await fetch(baseUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Depth': '1',
      },
    });

    if (!response.ok) {
      return { success: false, files: [], message: `列出文件失败: ${response.status}` };
    }

    const xml = await response.text();
    // 解析 XML 提取文件名
    const files: string[] = [];
    const hrefRegex = /<d:href>([^<]+)<\/d:href>/g;
    let match;
    while ((match = hrefRegex.exec(xml)) !== null) {
      const href = match[1];
      // 提取文件名
      const fileName = decodeURIComponent(href.split('/').pop() || '');
      // 只包含 .json 备份文件
      if (fileName.startsWith('zrss-backup') && fileName.endsWith('.json')) {
        files.push(fileName);
      }
    }

    // 按时间戳倒序排列（最新的在前）
    files.sort().reverse();

    return { success: true, files, message: `找到 ${files.length} 个备份` };
  } catch (err) {
    return {
      success: false,
      files: [],
      message: err instanceof Error ? err.message : '未知错误',
    };
  }
}

// 从 WebDAV 导入数据
export async function importFromWebDAV(fileName: string): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await getSettings();
    if (!settings.webdavUrl || !settings.webdavUser || !settings.webdavPass) {
      return { success: false, message: 'WebDAV 配置不完整' };
    }

    const config: WebDAVConfig = {
      url: settings.webdavUrl,
      username: settings.webdavUser,
      password: settings.webdavPass,
      path: settings.webdavPath || '',
    };

    const baseUrl = buildBasePath(config);
    const filePath = `${baseUrl}/${fileName}`;

    // 下载文件
    const response = await fetch(filePath, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, message: 'WebDAV 上未找到备份文件' };
      }
      throw new Error(`WebDAV 下载失败: ${response.status} ${response.statusText}`);
    }

    const json = await response.text();
    const importData = JSON.parse(json);

    if (!importData.feeds || !Array.isArray(importData.feeds)) {
      throw new Error('备份文件格式无效');
    }

    // 导入数据
    const existingFeeds = await db.feeds.toArray();
    const existingUrls = new Set(existingFeeds.map(f => f.url));

    let addedCount = 0;
    const feedsToImport = importData.feeds as Feed[];

    for (const feed of feedsToImport) {
      if (!existingUrls.has(feed.url)) {
        await db.feeds.add(feed);
        addedCount++;
      }
    }

    // 导入文件夹
    if (importData.folders && Array.isArray(importData.folders)) {
      const existingFolders = await db.folders.toArray();
      const existingFolderNames = new Set(existingFolders.map(f => f.name));

      const foldersToImport = importData.folders as Folder[];
      for (const folder of foldersToImport) {
        if (!existingFolderNames.has(folder.name)) {
          await db.folders.add(folder);
        }
      }
    }

    // 导入扩展设置（version 2 起包含）
    let settingsImported = false;
    if (importData.settings && typeof importData.settings === 'object') {
      // 再次确保不包含 WebDAV 凭据
      const {
        webdavUrl: _u,
        webdavUser: _us,
        webdavPass: _p,
        webdavPath: _pa,
        ...rest
      } = importData.settings as Record<string, unknown>;
      await saveSettings(rest as Partial<Settings>);
      settingsImported = true;
    }

    const parts: string[] = [`${addedCount} 个订阅 (跳过 ${feedsToImport.length - addedCount} 个重复)`];
    if (settingsImported) parts.push('扩展设置');

    return {
      success: true,
      message: `从 ${fileName} 导入${parts.join('、')}`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : '未知错误',
    };
  }
}

// 删除 WebDAV 备份文件
export async function deleteWebDAVBackup(fileName: string): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await getSettings();
    if (!settings.webdavUrl || !settings.webdavUser || !settings.webdavPass) {
      return { success: false, message: 'WebDAV 配置不完整' };
    }

    const config: WebDAVConfig = {
      url: settings.webdavUrl,
      username: settings.webdavUser,
      password: settings.webdavPass,
      path: settings.webdavPath || '',
    };

    const baseUrl = buildBasePath(config);
    const filePath = `${baseUrl}/${fileName}`;

    const response = await fetch(filePath, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
      },
    });

    if (!response.ok) {
      throw new Error(`删除失败: ${response.status} ${response.statusText}`);
    }

    return { success: true, message: `已删除 ${fileName}` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : '未知错误',
    };
  }
}

// 检查 WebDAV 连接
export async function testWebDAVConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await getSettings();
    if (!settings.webdavUrl || !settings.webdavUser || !settings.webdavPass) {
      return { success: false, message: 'WebDAV 配置不完整' };
    }

    const config: WebDAVConfig = {
      url: settings.webdavUrl,
      username: settings.webdavUser,
      password: settings.webdavPass,
      path: settings.webdavPath || '',
    };

    // 测试连接只验证 WebDAV 服务器本身，不携带子目录
    const baseUrl = config.url.replace(/\/+$/, '');
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);

    // 尝试 PROPFIND
    let response = await fetch(baseUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Depth': '0',
      },
    });

    // PROPFIND 失败时尝试 HEAD
    if (!response.ok) {
      response = await fetch(baseUrl, {
        method: 'HEAD',
        headers: { 'Authorization': authHeader },
      });
    }

    // 都失败时尝试 MKCOL 创建目录（目录可能还不存在）
    if (!response.ok) {
      response = await fetch(baseUrl, {
        method: 'MKCOL',
        headers: { 'Authorization': authHeader },
      });
      // MKCOL: 201 创建成功，405 目录已存在，都算通过
      if (response.ok || response.status === 405) {
        return { success: true, message: '连接成功' };
      }
    }

    if (!response.ok) {
      throw new Error(`连接失败: ${response.status} ${response.statusText}`);
    }

    return { success: true, message: '连接成功' };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : '未知错误',
    };
  }
}
