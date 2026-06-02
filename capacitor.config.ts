import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aetherhub.yugioh',
  appName: 'AetherHub',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
