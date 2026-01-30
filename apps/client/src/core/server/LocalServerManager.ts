import { LogicalServer, ServerNetworkAuthority } from '@ante/game-core';
import { BrowserAssetLoader } from './BrowserAssetLoader';
import { Logger } from '@ante/common';

const logger = new Logger('LocalServerManager');

export class LocalServerManager {
  private static instance: LocalServerManager;
  private logicalServer: LogicalServer | null = null;
  private networkAuthority: ServerNetworkAuthority | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): LocalServerManager {
    if (!LocalServerManager.instance) {
      LocalServerManager.instance = new LocalServerManager();
    }
    return LocalServerManager.instance;
  }

  public async startSession(roomName: string, mapId: string): Promise<void> {
    if (this.isRunning) {
      logger.warn('Local Server is already running.');
      return;
    }

    logger.info(`Starting Local Server Session... Room: ${roomName}`);

    try {
      // 1. Initialize Network Authority (Server Connection)
      const appId = import.meta.env.VITE_PHOTON_APP_ID;
      const appVersion = import.meta.env.VITE_PHOTON_APP_VERSION;

      if (!appId || !appVersion) {
        throw new Error('Missing Photon App ID or Version in environment variables.');
      }

      this.networkAuthority = new ServerNetworkAuthority(appId, appVersion);
      await this.networkAuthority.connect();

      // 2. Create Room (Authoritative Create)
      await this.networkAuthority.createGameRoom(roomName, mapId);

      // 3. Initialize Logical Server
      const assetLoader = new BrowserAssetLoader();
      this.logicalServer = new LogicalServer(this.networkAuthority, assetLoader);

      // 4. Start Simulation
      this.logicalServer.start();

      this.isRunning = true;
      logger.info('Local Server Session Started.');
    } catch (e) {
      logger.error('Failed to start Local Server Session:', e);
      this.stopSession();
      throw e;
    }
  }

  public stopSession(): void {
    if (this.logicalServer) {
      this.logicalServer.stop();
      this.logicalServer = null;
    }
    if (this.networkAuthority) {
      this.networkAuthority.disconnect();
      this.networkAuthority = null;
    }
    this.isRunning = false;
    logger.info('Local Server Session Stopped.');
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }
}
