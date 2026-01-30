import { Logger } from '@ante/common';
import { ServerNetworkManager } from './ServerNetworkManager';
import { ServerApi } from './ServerApi';
import { ServerGameInstance } from './ServerGameInstance';

const logger = new Logger('ServerApp');

export class ServerApp {
  private networkManager: ServerNetworkManager;
  private api: ServerApi;
  private gameInstance: ServerGameInstance;

  constructor() {
    this.networkManager = new ServerNetworkManager();
    this.api = new ServerApi(this.networkManager);
    this.gameInstance = new ServerGameInstance(this.networkManager);
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
