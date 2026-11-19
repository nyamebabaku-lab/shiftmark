import { Capacitor } from '@capacitor/core';

export const IS_NATIVE = Capacitor.isNativePlatform();
export const PLATFORM = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
/** Android/iOS builds are either the worker app or the admin app. The web app serves both. */
export const APP_ROLE = import.meta.env.VITE_ROLE || '';
export const DEMO = import.meta.env.VITE_DEMO === '1' || !import.meta.env.VITE_SUPABASE_URL;
export const PHONE_DOMAIN = 'phone.shiftmark.app';
export const STORE_KEY = DEMO ? 'shiftmark-demo' : 'shiftmark-live';
export const APK_URL = 'https://github.com/nyamebabaku-lab/shiftmark/releases/latest/download/ShiftMark.apk';
