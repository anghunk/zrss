import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'ZRSS - RSS Reader',
    description: 'A modern RSS reader with clean interface',
    permissions: ['storage', 'alarms', 'tabs', 'scripting', 'activeTab'],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': '/icon-16.png',
      '48': '/icon-48.png',
      '128': '/icon-128.png',
    },
  },
  vite: () => ({
    define: {
      // Fix React Fast Refresh in extension context
      'import.meta.hot': undefined,
    },
  }),
});
