import XMLHttpRequest from 'xhr2';

// Polyfills for Photon in Node.js environment
Object.defineProperty(globalThis, 'WebSocket', {
  value: (globalThis as Record<string, unknown>).WebSocket,
  writable: true,
});
Object.defineProperty(globalThis, 'XMLHttpRequest', { value: XMLHttpRequest, writable: true });

import { Logger } from '@ante/common';
import { ServerApp } from './ServerApp.ts';

const logger = new Logger('Server');

logger.info('Initializing Headless Game Server...');

const app = new ServerApp();
app.start().catch((e) => {
  logger.error('Fatal Error:', e);
  process.exit(1);
});
