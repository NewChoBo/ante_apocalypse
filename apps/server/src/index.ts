import XMLHttpRequest from 'xhr2';

// Polyfills for Photon in Node.js environment
interface PhotonNodeGlobal {
  WebSocket: typeof WebSocket;
  XMLHttpRequest: typeof XMLHttpRequest;
}

const photonGlobal = globalThis as unknown as PhotonNodeGlobal;
photonGlobal.WebSocket = WebSocket;
photonGlobal.XMLHttpRequest = XMLHttpRequest;

import { Logger } from '@ante/common';
import { ServerApp } from './ServerApp.ts';

const logger = new Logger('Server');

logger.info('Initializing Headless Game Server...');

const app = new ServerApp();
app.start().catch((e) => {
  logger.error('Fatal Error:', e);
  process.exit(1);
});
