import { WebSocket } from 'ws';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as xhr2 from 'xhr2';

// Polyfills for Photon in Node.js environment
(global as any).WebSocket = WebSocket as any;
(global as any).XMLHttpRequest = (xhr2 as any).default || xhr2;

import { Logger } from '@ante/common';
import { ServerApp } from './ServerApp.ts';

const logger = new Logger('Server');

logger.info('Initializing Headless Game Server...');

const app = new ServerApp();
app.start().catch((e) => {
  logger.error('Fatal Error:', e);
  process.exit(1);
});
