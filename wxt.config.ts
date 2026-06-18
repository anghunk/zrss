import { defineConfig } from 'wxt';
import packageJson from './package.json';

export default defineConfig({
	modules: ['@wxt-dev/module-react'],
	srcDir: 'src',
	manifest: {
		name: 'ZRSS',
		version: packageJson.version,
		description: '界面简洁的现代 RSS 阅读器',
		permissions: ['alarms', 'scripting', 'activeTab'],
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
