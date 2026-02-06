import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import { ServerNetworkAuthority } from '@ante/game-core';
import { WeaponRegistry } from '@ante/game-core';
import { Logger, getErrorMessage } from '@ante/common';

const logger = new Logger('ServerApi');

export class ServerApi {
  private app: express.Application;
  private port = 3000;
  private server: Server | null = null;
  private networkManager: ServerNetworkAuthority;

  constructor(networkManager: ServerNetworkAuthority) {
    this.networkManager = networkManager;
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post('/create-room', async (req, res): Promise<void> => {
      const { mapId, playerName } = req.body;
      const roomName = `SQUAD_${playerName?.toUpperCase() || 'UNKNOWN'}_${Math.floor(Math.random() * 1000)}`;

      logger.info(`Room creation requested: ${roomName} (${mapId})`);

      try {
        await this.networkManager.createGameRoom(roomName, mapId);

        res.json({
          success: true,
          roomName: roomName,
        });
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    });

    this.app.get('/status', (_req, res) => {
      res.json({
        status: 'running',
        room: this.networkManager.getRoomName() || 'Lobby',
      });
    });

    this.app.get('/weapon-config', (_req, res) => {
      res.json(WeaponRegistry);
    });
  }

  public start(): void {
    this.server = this.app.listen(this.port, () => {
      logger.info(`Listening on port ${this.port}`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      logger.info('ServerApi stopped.');
    }
  }
}
