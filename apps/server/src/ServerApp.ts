import { Logger } from '@ante/common';
import {
  ServerNetworkAuthority,
  LogicalServer,
  TickManager,
  WorldEntityManager,
} from '@ante/game-core';
import { ServerApi } from './ServerApi.js';
import { NodeAssetLoader } from './NodeAssetLoader.js';

const logger = new Logger('ServerApp');

export class ServerApp {
  private networkManager: ServerNetworkAuthority;
  private api: ServerApi;
  private gameInstance: LogicalServer;
  private assetLoader: NodeAssetLoader;

  constructor() {
    const appId = process.env.VITE_PHOTON_APP_ID || '';
    const appVersion = process.env.VITE_PHOTON_APP_VERSION || '1.0.0';

    const tickManager = new TickManager();
    const worldManager = new WorldEntityManager(tickManager);

    this.networkManager = new ServerNetworkAuthority(appId, appVersion, worldManager);
    this.api = new ServerApi(this.networkManager);
    this.assetLoader = new NodeAssetLoader();
    this.gameInstance = new LogicalServer(this.networkManager, this.assetLoader, {
      tickManager,
      worldManager,
    });
  }

  public async start(): Promise<void> {
    try {
      logger.info('Starting Server App...');

      // 1. Connect to Network (Photon)
      await this.networkManager.connect();

      // 2. Start API Server
      this.api.start();

      // 3. Create Default Room
      await this.createDefaultRoom();

      // 4. Start Game Simulation
      this.gameInstance.start();

      logger.info('Server App is running.');
    } catch (e) {
      logger.error('Failed to start Server App:', e);
      throw e;
    }
  }

  private async createDefaultRoom(): Promise<void> {
    logger.info('=== Creating Fixed Room: TEST_ROOM ===');
    try {
      await this.networkManager.createGameRoom('TEST_ROOM', 'training_ground');
    } catch (e) {
      logger.error('Room creation failed:', e);
      // Decide if fatal or not. Usually fatal for a dedicated server that needs a room.
    }
  }

  public stop(): void {
    logger.info('Stopping Server App...');
    this.gameInstance.stop();
    this.api.stop(); // Assuming api has stop
    this.networkManager.disconnect();
  }
}
