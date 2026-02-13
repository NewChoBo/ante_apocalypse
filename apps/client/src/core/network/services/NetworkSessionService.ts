import { Logger } from '@ante/common';
import { LogicalServer } from '@ante/game-core';
import { RoomManager } from '../RoomManager';

const logger = new Logger('NetworkSessionService');

interface NetworkSessionServiceDeps {
  roomManager: RoomManager;
  setLocalServer: (server: LogicalServer | null) => void;
  isMasterClient: () => boolean;
  requestInitialState: () => void;
  clearSessionObservers: () => void;
  isLocalServerRunning: () => boolean;
  startLocalSession: (roomName: string, mapId: string, gameMode: string) => Promise<void>;
  takeoverLocalSession: (roomName: string) => Promise<void>;
  stopLocalSession: () => void;
  getLogicalServer: () => LogicalServer | null;
}

export class NetworkSessionService {
  constructor(private readonly deps: NetworkSessionServiceDeps) {}

  public async hostGame(
    roomName: string,
    mapId: string,
    gameMode: string = 'deathmatch'
  ): Promise<boolean> {
    const created = await this.deps.roomManager.createRoom(roomName, mapId);
    if (!created) return false;

    logger.info(`HostGame: Starting Local Server for ${roomName}`);
    await this.deps.startLocalSession(roomName, mapId, gameMode);
    this.deps.setLocalServer(this.deps.getLogicalServer());
    return true;
  }

  public async joinGame(roomName: string): Promise<boolean> {
    const joined = await this.deps.roomManager.joinRoom(roomName);
    if (!joined) return false;

    logger.info(`Requesting Initial State for room ${roomName}...`);
    this.deps.requestInitialState();

    if (this.deps.isMasterClient()) {
      await this.handleTakeover(roomName);
    }
    return true;
  }

  public leaveGame(): void {
    if (this.deps.isLocalServerRunning()) {
      logger.info('LeaveGame: Stopping Local Server...');
      this.deps.stopLocalSession();
      this.deps.setLocalServer(null);
    }

    this.deps.roomManager.leaveRoom();
    this.deps.clearSessionObservers();
  }

  public async handleTakeover(roomName: string | null): Promise<void> {
    if (!roomName) return;
    if (this.deps.isLocalServerRunning()) return;

    logger.info('HandleTakeover: Taking over host duties...');
    await this.deps.takeoverLocalSession(roomName);
    this.deps.setLocalServer(this.deps.getLogicalServer());
  }
}
