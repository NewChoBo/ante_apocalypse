import { io, Socket } from 'socket.io-client';
import { Observable, Vector3 } from '@babylonjs/core';

export interface PlayerState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  weaponId: string;
  name: string;
  health: number;
}

export interface FireEventData {
  playerId: string;
  weaponId: string;
  muzzleTransform?: {
    position: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
  };
}

export interface HitEventData {
  playerId: string;
  damage: number;
  newHealth: number;
  attackerId: string;
}

export interface DeathEventData {
  playerId: string;
  attackerId: string;
}

export class NetworkManager {
  private static instance: NetworkManager;
  private socket: Socket | null = null;

  public onPlayersList = new Observable<PlayerState[]>();
  public onPlayerJoined = new Observable<PlayerState>();
  public onPlayerUpdated = new Observable<PlayerState>();
  public onPlayerLeft = new Observable<string>();
  public onPlayerFired = new Observable<FireEventData>();
  public onPlayerHit = new Observable<HitEventData>();
  public onPlayerDied = new Observable<DeathEventData>();

  private constructor() {}

  public clearObservers(): void {
    this.onPlayersList.clear();
    this.onPlayerJoined.clear();
    this.onPlayerUpdated.clear();
    this.onPlayerLeft.clear();
    this.onPlayerFired.clear();
    this.onPlayerHit.clear();
    this.onPlayerDied.clear();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  public connect(url: string = 'http://localhost:3000'): void {
    if (this.socket) return;

    this.socket = io(url);

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('playersList', (players: PlayerState[]) => {
      this.onPlayersList.notifyObservers(players);
    });

    this.socket.on('playerJoined', (player: PlayerState) => {
      this.onPlayerJoined.notifyObservers(player);
    });

    this.socket.on('playerUpdated', (player: PlayerState) => {
      this.onPlayerUpdated.notifyObservers(player);
    });

    this.socket.on('playerLeft', (id: string) => {
      this.onPlayerLeft.notifyObservers(id);
    });

    this.socket.on('playerFired', (data: FireEventData) => {
      this.onPlayerFired.notifyObservers(data);
    });

    this.socket.on('playerHit', (data: HitEventData) => {
      this.onPlayerHit.notifyObservers(data);
    });

    this.socket.on('playerDied', (data: DeathEventData) => {
      this.onPlayerDied.notifyObservers(data);
    });
  }

  public join(data: {
    position: Vector3;
    rotation: Vector3;
    weaponId: string;
    name: string;
  }): void {
    this.socket?.emit('join', {
      position: { x: data.position.x, y: data.position.y, z: data.position.z },
      rotation: { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z },
      weaponId: data.weaponId,
      name: data.name,
    });
  }

  public updateState(data: { position: Vector3; rotation: Vector3; weaponId: string }): void {
    this.socket?.emit('updateState', {
      position: { x: data.position.x, y: data.position.y, z: data.position.z },
      rotation: { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z },
      weaponId: data.weaponId,
    });
  }

  public fire(fireData: {
    weaponId: string;
    muzzleTransform?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    };
  }): void {
    // Sanitize Vector3 if present
    const sanitizedData = {
      weaponId: fireData.weaponId,
      muzzleTransform: fireData.muzzleTransform
        ? {
            position: {
              x: fireData.muzzleTransform.position.x,
              y: fireData.muzzleTransform.position.y,
              z: fireData.muzzleTransform.position.z,
            },
            direction: {
              x: fireData.muzzleTransform.direction.x,
              y: fireData.muzzleTransform.direction.y,
              z: fireData.muzzleTransform.direction.z,
            },
          }
        : undefined,
    };
    this.socket?.emit('fire', sanitizedData);
  }

  public hit(hitData: { targetId: string; damage: number }): void {
    this.socket?.emit('hit', hitData);
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }
}
