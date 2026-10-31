/**
 * Centralized Davejoe Interiors Official Brand Configuration
 * Digital Operating System
 */

export const BRAND_ASSETS = {
  // Official full transparent wordmark logo (primary for desktop/mobile headers, login, splash)
  logoTransparent: '/brand/davejoe-logo-transparent.png',
  
  // Official white-background wordmark logo
  logoWhite: '/brand/davejoe-logo-white.png',
  
  // High-resolution square emblem icons (for compact sidebar, app tiles, notifications)
  emblem192: '/brand/pwa-192x192.png',
  emblem512: '/brand/pwa-512x512.png',
  emblemMaskable: '/brand/pwa-512x512-maskable.png',
  
  // Apple mobile home screen icon
  appleTouchIcon: '/brand/apple-touch-icon.png',
  
  // Browser tab favicons
  favicon16: '/brand/favicon-16x16.png',
  favicon32: '/brand/favicon-32x32.png',
  favicon48: '/brand/favicon-48x48.png',
  faviconIco: '/favicon.ico',
} as const;

export const BRAND_INFO = {
  companyName: 'Davejoe Interiors',
  shortName: 'Davejoe',
  productName: 'Digital Operating System',
  fullTitle: 'Davejoe Interiors — Digital Operating System',
  tagline: 'One centralized system for managing people, projects, operations and performance.',
  themeColor: '#01875F',
  backgroundColor: '#F8FAFB',
} as const;
