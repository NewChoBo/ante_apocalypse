import { LogicalServer, ServerNetworkAuthority } from '@ante/game-core';
import { BrowserAssetLoader } from './BrowserAssetLoader';
import { Logger } from '@ante/common';
import { NetworkManager } from '../systems/NetworkManager';

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

  public async takeover(roomName: string): Promise<void> {
    if (this.isRunning) {
      logger.warn('Local Server is already running (Takeover ignored).');
      return;
    }

    logger.info(`Taking over Host Duties for Room: ${roomName}`);

    // Pass 'true' to skip Room Creation and just Join
    await this.internalStart(roomName, true);
  }

  public async startSession(roomName: string, mapId: string): Promise<void> {
    await this.internalStart(roomName, false, mapId);
  }

  private async internalStart(
    roomName: string,
    isTakeover: boolean,
    mapId?: string
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn('Local Server is already running.');
      return;
    }

    logger.info(`Starting Local Server Session... Room: ${roomName} (Takeover: ${isTakeover})`);

    try {
      // 1. Initialize Network Authority (Server Connection)
      const appId = import.meta.env.VITE_PHOTON_APP_ID;
      const appVersion = import.meta.env.VITE_PHOTON_APP_VERSION;

      if (!appId || !appVersion) {
        throw new Error('Missing Photon App ID or Version in environment variables.');
      }

      this.networkAuthority = new ServerNetworkAuthority(appId, appVersion);
      await this.networkAuthority.connect();

      // 2. Create OR Join Room
      if (isTakeover) {
        // Just join the existing room as a Server Peer
        // Note: We might need to handle 'Server' naming collision if old server is ghosting.
        // ServerNetworkAuthority handles naming usually?
        await this.networkAuthority.joinGameRoom(roomName);
      } else {
        if (!mapId) throw new Error('MapID required for new session');
        await this.networkAuthority.createGameRoom(roomName, mapId);
      }

      // 3. Initialize Logical Server
      const assetLoader = new BrowserAssetLoader();
      this.logicalServer = new LogicalServer(this.networkAuthority, assetLoader, {
        isTakeover,
      });

      // 4. Start Simulation
      this.logicalServer.start();

      // [New] Register with NetworkManager for Short-circuiting
      NetworkManager.getInstance().setLocalServer(this.logicalServer);

      this.isRunning = true;
      logger.info('Local Server Session Started (Takeover Complete).');
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
      // [New] Unregister from NetworkManager
      NetworkManager.getInstance().setLocalServer(null);
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
