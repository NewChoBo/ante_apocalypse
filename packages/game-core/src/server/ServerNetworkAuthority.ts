// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Photon from 'photon-realtime';
import {
  EventCode,
  PlayerState,
  FireEventData,
  HitEventData,
  DeathEventData,
  RequestHitData,
  Vector3,
  MovePayload,
  InitialStatePayload,
  SyncWeaponPayload,
} from '@ante/common';
import { INetworkAuthority } from '../network/INetworkAuthority.js';
import { WorldEntityManager } from '../simulation/WorldEntityManager.js';
import { NetworkDispatcher } from '../network/NetworkDispatcher.js';
import { Logger } from '@ante/common';

const logger = new Logger('ServerNetworkAuthority');

export class ServerNetworkAuthority implements INetworkAuthority {
  private client: any; // Photon.LoadBalancing.LoadBalancingClient
  private appId: string;
  private appVersion: string;

  private entityManager: WorldEntityManager = WorldEntityManager.getInstance();
  private dispatcher: NetworkDispatcher = new NetworkDispatcher();

  // [추가] 연결 대기용 Promise Resolver
  private connectionResolver: (() => void) | null = null;

  // [추가] 외부로 내보낼 콜백 함수들
  public onPlayerJoin?: (id: string) => void;
  public onPlayerLeave?: (id: string) => void;
  public onPlayerMove?: (id: string, pos: Vector3, rot: Vector3) => void;
  public onFireRequest?: (id: string, origin: Vector3, dir: Vector3, weaponId?: string) => void;
  public onHitRequest?: (shooterId: string, data: RequestHitData) => void;

  public getPlayerState(id: string): PlayerState | undefined {
    return this.entityManager.getEntity(id) as unknown as PlayerState;
  }

  public isMasterClient(): boolean {
    return true; // The server is always the authority
  }

  public getSocketId(): string | undefined {
    return 'server';
  }

  public sendEvent(code: number, data: unknown, _reliable: boolean = true): void {
    this.client.raiseEvent(code, data, {
      receivers: (Photon as any).LoadBalancing.Constants.ReceiverGroup.All,
    });
  }

  constructor(appId: string, appVersion: string) {
    this.appId = appId;
    this.appVersion = appVersion;

    // LoadBalancingClient 생성
    this.client = new (Photon as any).LoadBalancing.LoadBalancingClient(
      (Photon as any).ConnectionProtocol.Wss,
      this.appId,
      this.appVersion
    );

    this.setupDispatcher();
    this.setupListeners();
  }

  private setupDispatcher(): void {
    this.dispatcher.register(EventCode.REQ_INITIAL_STATE, (_data: unknown, senderId: string) => {
      this.sendInitialState(senderId);
    });

    this.dispatcher.register(EventCode.MOVE, (data: MovePayload, senderId: string) => {
      if (senderId === this.client.myActor().actorNr.toString()) return;

      let entity = this.entityManager.getEntity(senderId) as unknown as PlayerState;
      if (!entity) {
        if (this.onPlayerJoin) this.onPlayerJoin(senderId);

        const actor = this.client.myRoom().actors[parseInt(senderId)];
        const name = actor?.name || 'Unknown';

        entity = {
          id: senderId,
          name: name,
          position: data.position,
          rotation: data.rotation,
          weaponId: 'Pistol',
          health: 100,
        };
        (entity as unknown as { type: string }).type = 'remote_player'; // IWorldEntity type
        this.entityManager.register(entity as any);
      } else {
        entity.position = data.position;
        entity.rotation = data.rotation;
      }

      if (this.onPlayerMove) {
        this.onPlayerMove(senderId, data.position, data.rotation);
      }
    });

    this.dispatcher.register(EventCode.SYNC_WEAPON, (data: SyncWeaponPayload, senderId: string) => {
      const state = this.getPlayerState(senderId);
      if (state) {
        state.weaponId = data.weaponId;
      }
    });

    this.dispatcher.register(EventCode.FIRE, (data: FireEventData, senderId: string) => {
      if (this.onFireRequest && data.muzzleTransform) {
        this.onFireRequest(
          senderId,
          data.muzzleTransform.position,
          data.muzzleTransform.direction,
          data.weaponId
        );
      }
    });

    this.dispatcher.register(EventCode.REQUEST_HIT, (data: RequestHitData, senderId: string) => {
      if (this.onHitRequest) {
        this.onHitRequest(senderId, data);
      }
    });
  }

  private setupListeners(): void {
    this.client.onStateChange = (state: number) => {
      logger.info(`State Changed: ${state}`);
      const States = (Photon as any).LoadBalancing.LoadBalancingClient.State;

      // [핵심] 마스터 서버 연결 혹은 로비 진입 시점에 Promise 해결(Resolve)
      if (state === States.JoinedLobby || state === States.ConnectedToMaster) {
        if (this.connectionResolver) {
          logger.info('Connected & Ready.');
          this.connectionResolver();
          this.connectionResolver = null;
        }
      }
    };

    this.client.onEvent = (code: number, content: unknown, actorNr: number) => {
      this.dispatcher.dispatch(code, content, actorNr.toString());
    };

    this.client.onActorJoin = (actor: any) => {
      const id = actor.actorNr.toString();
      const name = actor.name || 'Anonymous';

      // [서버 본인 제외] 서버(방장 더미)는 플레이어 목록 및 히트박스 생성에서 제외
      if (actor.actorNr === this.client.myActor().actorNr) {
        return;
      }

      logger.info(`Player Joined: ${id} (${name})`);

      if (!this.entityManager.getEntity(id)) {
        const state: PlayerState = {
          id: id,
          name: name,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          weaponId: 'Pistol',
          health: 100,
        };
        (state as unknown as { type: string }).type = 'remote_player';
        this.entityManager.register(state as any);
      }

      // [연결] 컨트롤러에게 알림
      if (this.onPlayerJoin) this.onPlayerJoin(id);
    };

    this.client.onActorLeave = (actor: any) => {
      const id = actor.actorNr.toString();
      logger.info(`Player Left: ${id}`);
      this.entityManager.unregister(id);
      if (this.onPlayerLeave) this.onPlayerLeave(id);
    };
  }

  // [수정] 연결이 완료될 때까지 기다리는 Promise 반환
  public connect(region: string = 'kr'): Promise<void> {
    logger.info('Connecting to Photon...');
    this.client.connectToRegionMaster(region);

    return new Promise((resolve) => {
      this.connectionResolver = resolve;
    });
  }

  public async createGameRoom(name?: string, mapId?: string): Promise<void> {
    // 안전장치: 연결 끊김 상태 확인
    if (!this.client.isConnectedToMaster() && !this.client.isInLobby()) {
      logger.error('Cannot create room: Not connected.');
      throw new Error('Server disconnected from Photon.');
    }

    const roomName = name || 'TrainingGround_Server';
    const roomOptions = {
      isVisible: true,
      isOpen: true,
      maxPlayers: 20,
      customGameProperties: { mapId: mapId || 'training_ground' },
      propsListedInLobby: ['mapId'],
    };

    logger.info(`Creating Room: ${roomName} (Map: ${mapId})`);
    this.client.createRoom(roomName, roomOptions);
  }

  private sendInitialState(targetId: string): void {
    logger.info(`Sending Initial State to ${targetId}`);
    const players = this.entityManager.getAllEntities() as unknown as PlayerState[];
    const payload: InitialStatePayload = {
      players,
      enemies: [],
      targets: [],
    };

    this.client.raiseEvent(EventCode.INITIAL_STATE, payload, {
      targetActors: [parseInt(targetId)],
    });
  }

  public broadcastState(): void {
    const players = this.entityManager.getAllEntities() as unknown as PlayerState[];
    if (players.length === 0) return;

    const payload: InitialStatePayload = {
      players: players,
      enemies: [],
      targets: [],
      // weaponConfigs: WeaponRegistry,
    };

    this.client.raiseEvent(EventCode.INITIAL_STATE, payload, {
      receivers: (Photon as any).LoadBalancing.Constants.ReceiverGroup.All,
    });
  }

  // [신규] 피격 결과 방송 (Broadcasting)
  public broadcastHit(hitData: HitEventData, code: number = EventCode.HIT): void {
    // 서버측 상태 업데이트
    const targetState = this.getPlayerState(hitData.targetId);
    if (targetState) {
      targetState.health = hitData.newHealth;
      logger.info(
        `Player ${hitData.targetId} Health: ${targetState.health} (Part: ${hitData.part})`
      );

      // 피격 정보 방송 (상대 코드 사용)
      this.client.raiseEvent(code, hitData, {
        receivers: (Photon as any).LoadBalancing.Constants.ReceiverGroup.All,
      });

      // 사망 처리
      if (targetState.health <= 0) {
        this.broadcastDeath(hitData.targetId, hitData.attackerId);
      }
    } else {
      // [신규] 플레이어가 아닌 대상(에너미, 타겟 등)에 대한 히트도 브로드캐스트
      logger.info(`Non-player Hit Broadcasted: ${hitData.targetId} with Code ${code}`);
      this.client.raiseEvent(code, hitData, {
        receivers: (Photon as any).LoadBalancing.Constants.ReceiverGroup.All,
      });
    }
  }

  public broadcastDeath(targetId: string, attackerId: string): void {
    logger.info(`💀 Player ${targetId} was killed by ${attackerId}`);
    const payload: DeathEventData = {
      targetId,
      attackerId,
    };
    this.client.raiseEvent(EventCode.PLAYER_DEATH, payload, {
      receivers: (Photon as any).LoadBalancing.Constants.ReceiverGroup.All,
    });
  }

  public disconnect(): void {
    this.client.disconnect();
  }
}
