// Two Android apps from one project: APP=worker (default) → ShiftMark, APP=admin → ShiftMark Admin.
import type { CapacitorConfig } from '@capacitor/cli';

const APP = (process.env.APP || 'worker') as 'worker' | 'admin';
const META = {
  worker: { id: 'com.shiftmark.worker', name: 'ShiftMark' },
  admin: { id: 'com.shiftmark.admin', name: 'ShiftMark Admin' },
}[APP];

const config: CapacitorConfig = {
  appId: META.id,
  appName: META.name,
  webDir: `build/${APP}`,
  // Keeps location updates flowing when the app is in the background (background-geolocation plugin).
  android: { path: `android-${APP}`, backgroundColor: '#0f172a', useLegacyBridge: true },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: '#0f172a', showSpinner: false },
    StatusBar: { backgroundColor: '#0f172a', style: 'DARK' },
    LocalNotifications: { smallIcon: 'ic_stat_shiftmark', iconColor: '#06b6d4' },
  },
};

export default config;
