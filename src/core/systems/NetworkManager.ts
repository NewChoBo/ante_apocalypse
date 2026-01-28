import { Observable, Vector3 } from '@babylonjs/core';
import { INetworkProvider } from '../network/INetworkProvider';
import { PhotonProvider } from '../network/providers/PhotonProvider';
import {
  RoomInfo,
  NetworkState,
  EventCode,
  PlayerState,
  FireEventData,
  HitEventData,
  DeathEventData,
} from '../network/NetworkProtocol';

export class NetworkManager {
  private static instance: NetworkManager;
  private provider: INetworkProvider;

  public onPlayersList = new Observable<PlayerState[]>();
  public onPlayerJoined = new Observable<PlayerState>();
  public onPlayerUpdated = new Observable<PlayerState>();
  public onPlayerLeft = new Observable<string>();
  public onPlayerFired = new Observable<FireEventData>();
  public onPlayerHit = new Observable<HitEventData>();
  public onPlayerDied = new Observable<DeathEventData>();

  // Enemy Synchronization
  public onEnemyUpdated = new Observable<{
    id: string;
    position: any;
    rotation: any;
    isMoving?: boolean;
  }>();
  public onEnemyHit = new Observable<{ id: string; damage: number }>();

  // State Synchronization
  public onInitialStateRequested = new Observable<{ senderId: string }>();
  public onInitialStateReceived = new Observable<{
    players: any[];
    enemies: any[];
    targets?: any[];
  }>();

  // New Observables for Lobby/State
  public onRoomListUpdated = new Observable<RoomInfo[]>();
  public onStateChanged = new Observable<NetworkState>();
  public onEvent = new Observable<{ code: number; data: any; senderId: string }>();

  // Target Observables
  public onTargetHit = new Observable<{ targetId: string; part: string; damage: number }>();
  public onTargetDestroy = new Observable<{ targetId: string }>();
  public onTargetSpawn = new Observable<{
    type: string;
    position: Vector3;
    id: string;
    isMoving: boolean;
  }>();

  private playerStates: Map<string, PlayerState> = new Map();
  private currentState: NetworkState = NetworkState.Disconnected;
  private lastRoomList: RoomInfo[] = [];

  private constructor() {
    this.provider = new PhotonProvider();
    this.setupProviderListeners();
  }

  public clearObservers(): void {
    this.onPlayersList.clear();
    this.onPlayerJoined.clear();
    this.onPlayerUpdated.clear();
    this.onPlayerLeft.clear();
    this.onPlayerFired.clear();
    this.onPlayerHit.clear();
    this.onPlayerDied.clear();
    this.onRoomListUpdated.clear();
    this.onStateChanged.clear();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private setupProviderListeners(): void {
    this.provider.onStateChanged = (state) => {
      this.currentState = state;
      this.onStateChanged.notifyObservers(state);
    };

    this.provider.onRoomListUpdated = (rooms) => {
      this.lastRoomList = rooms;
      this.onRoomListUpdated.notifyObservers(rooms);
    };

    this.provider.onPlayerJoined = (user) => {
      const newState: PlayerState = {
        id: user.userId,
        name: user.name || 'Anonymous',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        weaponId: 'Pistol',
        health: 100,
      };
      this.playerStates.set(user.userId, newState);
      this.onPlayerJoined.notifyObservers(newState);
    };

    this.provider.onPlayerLeft = (id) => {
      this.playerStates.delete(id);
      this.onPlayerLeft.notifyObservers(id);
    };

    this.provider.onEvent = (code, data, senderId) => {
      this.onEvent.notifyObservers({ code, data, senderId });

      switch (code) {
        case EventCode.MOVE:
          if (this.playerStates.has(senderId)) {
            const state = this.playerStates.get(senderId)!;
            state.position = data.position;
            state.rotation = data.rotation;
            this.onPlayerUpdated.notifyObservers(state);
          }
          break;
        case EventCode.FIRE:
          this.onPlayerFired.notifyObservers({
            playerId: senderId,
            weaponId: data.weaponId,
            muzzleTransform: data.muzzleTransform,
          });
          break;
        case EventCode.HIT:
          this.onPlayerHit.notifyObservers({
            playerId: data.targetId,
            damage: data.damage,
            newHealth: data.newHealth || 0,
            attackerId: senderId,
          });
          break;
        case EventCode.SYNC_WEAPON:
          if (this.playerStates.has(senderId)) {
            const state = this.playerStates.get(senderId)!;
            state.weaponId = data.weaponId;
            this.onPlayerUpdated.notifyObservers(state);
          }
          break;
        case EventCode.MOVE:
          // 기존: if (this.playerStates.has(senderId)) ...

          // 변경: 내 아이디(localPlayerId)라도 서버가 보낸 정보라면 위치를 보정해야 함 (Reconciliation)
          // 단, 렉을 줄이기 위해 '거리 차이가 클 때'만 강제 보정하는 로직이 필요.

          if (this.playerStates.has(senderId)) {
            const state = this.playerStates.get(senderId)!;

            // 만약 senderId가 '나(LocalPlayer)'라면?
            const isMe = senderId === this.getSocketId();

            if (isMe) {
              // 서버 위치와 내 클라이언트 위치가 너무 차이나면(예: 2미터 이상) 서버 위치로 강제 이동 (Lag/Hack 방지)
              const dist = Vector3.Distance(
                new Vector3(state.position.x, state.position.y, state.position.z),
                new Vector3(data.position.x, data.position.y, data.position.z)
              );
              if (dist > 2.0) {
                console.warn('서버와의 위치 불일치 감지! 위치 보정됨.');
                // 여기서 플레이어의 실제 위치를 강제로 덮어씌우는 이벤트 발생 필요
              }
            } else {
              // 다른 플레이어는 그대로 업데이트 (보간 적용 권장)
              state.position = data.position;
              state.rotation = data.rotation;
              this.onPlayerUpdated.notifyObservers(state);
            }
          }
          break;
        case EventCode.ENEMY_HIT:
          this.onEnemyHit.notifyObservers({
            id: data.id,
            damage: data.damage,
          });
          break;
        case EventCode.TARGET_HIT:
          this.onTargetHit.notifyObservers({
            targetId: data.targetId,
            part: data.part,
            damage: data.damage,
          });
          break;
        case EventCode.PLAYER_DEATH:
          this.onPlayerDied.notifyObservers({
            playerId: data.playerId,
            attackerId: data.attackerId,
          });
          break;
        case EventCode.TARGET_DESTROY:
          this.onTargetDestroy.notifyObservers({
            targetId: data.targetId,
          });
          break;
        case EventCode.SPAWN_TARGET:
          this.onTargetSpawn.notifyObservers({
            type: data.type,
            position: new Vector3(data.position.x, data.position.y, data.position.z),
            id: data.id,
            isMoving: data.isMoving,
          });
          break;
        case EventCode.REQ_INITIAL_STATE:
          this.onInitialStateRequested.notifyObservers({ senderId });
          break;
        case EventCode.INITIAL_STATE:
          // Update internal state with received players
          if (data.players && Array.isArray(data.players)) {
            data.players.forEach((p: PlayerState) => {
              this.playerStates.set(p.id, p);
            });
            console.log(
              `[NetworkManager] Synced ${data.players.length} players from Initial State`
            );
          }

          this.onInitialStateReceived.notifyObservers({
            players: data.players,
            enemies: data.enemies,
            targets: data.targets,
          });
          break;
      }
    };
  }

  public connect(userId: string): void {
    // Prevent redundant connection attempts using internal state
    if (
      this.currentState !== NetworkState.Disconnected &&
      this.currentState !== NetworkState.Error
    ) {
      return;
    }

    this.provider.connect(userId).catch((e) => {
      console.error('[NetworkManager] Connect failed:', e);
    });
  }

  public async joinRoom(name: string): Promise<boolean> {
    return this.provider.joinRoom(name);
  }

  public leaveRoom(): void {
    this.provider.disconnect();
  }

  public isMasterClient(): boolean {
    return this.provider.isMasterClient();
  }

  public getActors(): Map<string, { id: string; name: string }> {
    return this.provider.getActors();
  }

  public getMapId(): string | null {
    return this.provider.getCurrentRoomProperty('mapId');
  }

  public join(data: {
    position: Vector3;
    rotation: Vector3;
    weaponId: string;
    name: string;
  }): void {
    const myId = this.getSocketId();
    if (myId) {
      const myState: PlayerState = {
        id: myId,
        name: data.name,
        position: { x: data.position.x, y: data.position.y, z: data.position.z },
        rotation: { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z },
        weaponId: data.weaponId,
        health: 100,
      };
      this.playerStates.set(myId, myState);
    }
    this.updateState(data);
  }

  public updateState(data: { position: Vector3; rotation: Vector3; weaponId: string }): void {
    const myId = this.getSocketId();
    if (myId && this.playerStates.has(myId)) {
      const state = this.playerStates.get(myId)!;
      state.position = { x: data.position.x, y: data.position.y, z: data.position.z };
      state.rotation = { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z };
      state.weaponId = data.weaponId;
    }

    this.provider.sendEvent(
      EventCode.MOVE,
      {
        position: { x: data.position.x, y: data.position.y, z: data.position.z },
        rotation: { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z },
      },
      false
    );
  }

  public fire(fireData: {
    weaponId: string;
    muzzleTransform?: {
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    };
  }): void {
    this.provider.sendEvent(EventCode.FIRE, fireData, true);
  }

  public syncWeapon(weaponId: string): void {
    this.provider.sendEvent(EventCode.SYNC_WEAPON, { weaponId }, true);
  }

  public sendEvent(code: number, data: any, reliable: boolean = true): void {
    this.provider.sendEvent(code, data, reliable);
  }

  public getSocketId(): string | undefined {
    return this.provider.getLocalPlayerId() || undefined;
  }

  public getServerTime(): number {
    return this.provider.getServerTime();
  }

  public refreshRoomList(): void {
    console.log('[NetworkManager] Requesting room list refresh...');
    this.provider.refreshRoomList?.();
  }

  public getRoomList(): RoomInfo[] {
    return this.lastRoomList;
  }

  public getAllPlayerStates(): PlayerState[] {
    return Array.from(this.playerStates.values());
  }
}
