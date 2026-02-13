import {
  LogicalServer,
  IServerNetworkAuthority,
  TickManager,
  WorldEntityManager as CoreWorldEntityManager,
} from '@ante/game-core';
import { BrowserAssetLoader } from './BrowserAssetLoader';
import { Logger } from '@ante/common';
import { ClientHostNetworkAdapter } from './ClientHostNetworkAdapter';
import type { NetworkManager } from '../systems/NetworkManager';

import { LevelData } from '@ante/game-core';

import trainingGroundData from '@ante/assets/levels/training_ground.json';
import combatZoneData from '@ante/assets/levels/combat_zone.json';

const LEVELS: Record<string, LevelData> = {
  training_ground: trainingGroundData as LevelData,
  combat_zone: combatZoneData as LevelData,
};

const logger = new Logger('LocalServerManager');

export class LocalServerManager {
  private logicalServer: LogicalServer | null = null;
  private networkAuthority: ClientHostNetworkAdapter | IServerNetworkAuthority | null = null;
  private isRunning = false;

  constructor() {}

  public async takeover(networkManager: NetworkManager, roomName: string): Promise<void> {
    if (this.isRunning) {
      logger.warn('Local Server is already running (Takeover ignored).');
      return;
    }

    logger.info(`Taking over Host Duties for Room: ${roomName}`);

    // Pass 'true' to skip Room Creation and just Join
    await this.internalStart(networkManager, roomName, true);
  }

  public async startSession(
    networkManager: NetworkManager,
    roomName: string,
    mapId: string,
    gameMode: string
  ): Promise<void> {
    await this.internalStart(networkManager, roomName, false, mapId, gameMode);
  }

  private async internalStart(
    networkManager: NetworkManager,
    roomName: string,
    isTakeover: boolean,
    mapId?: string,
    gameMode?: string
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn('Local Server is already running.');
      return;
    }

    logger.info(`Starting Local Server Session... Room: ${roomName} (Takeover: ${isTakeover})`);

    try {
      // 1. Initialize Network Authority (using Host connection)
      // server-side logic which is separate.
      const serverTickManager = new TickManager();
      const serverEntityManager = new CoreWorldEntityManager(serverTickManager);

      this.networkAuthority = new ClientHostNetworkAdapter(networkManager, serverEntityManager);

      // Note: We don't need to connect or create room, as Host Client already did it.
      // But we might need to register existing actors if we are late-starting?
      // The Adapter handles 'onPlayerJoin' via NetworkManager listeners.

      // 3. Initialize Logical Server
      const assetLoader = new BrowserAssetLoader();
      this.logicalServer = new LogicalServer(this.networkAuthority, assetLoader, {
        isTakeover,
        gameMode,
        tickManager: serverTickManager,
        worldManager: serverEntityManager,
      });

      // 3.5 Load Level Data
      const roomMapId = this.networkAuthority.getCurrentRoomProperty<string>('mapId');
      const currentMapId = mapId ?? roomMapId ?? 'training_ground';
      const levelData = LEVELS[currentMapId];
      if (levelData) {
        this.logicalServer.loadLevel(levelData);
      } else {
        logger.warn(`Level data not found for mapId: ${currentMapId}. Hits might fail.`);
      }

      // 4. Start Simulation
      this.logicalServer.start();

      // 5. Register Existing Actors (Crucial for Host visibility)
      // Since Host joined room BEFORE starting LocalServer, we must manually inject them now.
      this.networkAuthority.registerAllActors();

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
    }
    if (this.networkAuthority) {
      if (this.networkAuthority instanceof ClientHostNetworkAdapter) {
        this.networkAuthority.dispose();
      }
      if (
        'disconnect' in this.networkAuthority &&
        typeof this.networkAuthority.disconnect === 'function'
      ) {
        this.networkAuthority.disconnect();
      }
      this.networkAuthority = null;
    }
    this.isRunning = false;
    logger.info('Local Server Session Stopped.');
  }

  public getLogicalServer(): LogicalServer | null {
    return this.logicalServer;
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }
}
