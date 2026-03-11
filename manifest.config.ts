import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  description: 'Chrome Extension AI Agent - 用自然语言驱动浏览器 API 操作',
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: [
    'storage',
    'scripting',
    'activeTab',
    'tabs',
    'sidePanel',
  ],
  host_permissions: [
    'https://*/*',
    'http://*/*',
  ],
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['https://*/*', 'http://*/*'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
