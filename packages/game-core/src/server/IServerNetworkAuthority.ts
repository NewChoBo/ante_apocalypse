import {
  HitEventData,
  RequestHitData,
  UpgradePickPayload,
  PlayerState as NetworkPlayerState,
  Vector3 as NetworkVector3,
} from '@ante/common';
import { INetworkAuthority } from '../network/INetworkAuthority.js';

export interface IServerNetworkAuthority extends INetworkAuthority {
  // Connection / Status
  getSocketId(): string | undefined;
  isMasterClient(): boolean;
  createGameRoom(name?: string, mapId?: string): Promise<void>;
  joinGameRoom(name: string): Promise<void>;
  registerAllActors(): void;

  // Event Broadcasting
  sendEvent(code: number, data: unknown, reliable?: boolean): void;
  broadcastState(
    enemyStates?: {
      id: string;
      position: NetworkVector3;
      rotation: NetworkVector3;
      health: number;
      isDead: boolean;
    }[]
  ): void;
  broadcastHit(hitData: HitEventData, code?: number): void;
  broadcastDeath(
    targetId: string,
    attackerId: string,
    respawnDelaySeconds?: number,
    canRespawn?: boolean,
    gameMode?: string
  ): void;
  broadcastRespawn(playerId: string, position: NetworkVector3): void;
  broadcastReload(playerId: string, weaponId: string): void;

  // State Queries
  getPlayerState(id: string): NetworkPlayerState | undefined;
  getCurrentRoomProperty<T = unknown>(key: string): T | undefined;

  // Callbacks (Setters)
  onPlayerJoin?: (id: string, name: string) => void;
  onPlayerLeave?: (id: string) => void;
  onPlayerMove?: (id: string, pos: NetworkVector3, rot: NetworkVector3) => void;
  onFireRequest?: (
    id: string,
    origin: NetworkVector3,
    dir: NetworkVector3,
    weaponId?: string
  ) => void;
  onReloadRequest?: (playerId: string, weaponId: string) => void;
  onHitRequest?: (shooterId: string, data: RequestHitData) => void;
  onSyncWeaponRequest?: (playerId: string, weaponId: string) => void;
  onUpgradePickRequest?: (playerId: string, data: UpgradePickPayload) => void;
}
