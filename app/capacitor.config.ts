import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jhoelzl.sheetmusic',
  appName: 'Sheet Music',
  webDir: 'dist',
  server: {
    url: 'https://jhoelzl.github.io/sheet-music/'
  }
};

export default config;
