import {
  NullEngine,
  Scene,
  MeshBuilder,
  ArcRotateCamera,
  Vector3,
  AbstractMesh,
} from '@babylonjs/core';
import { ServerNetworkManager } from './ServerNetworkManager.ts';
import { ServerApi } from './ServerApi.ts';
import {
  WorldSimulation,
  BaseEnemyManager,
  BasePickupManager,
  BaseTargetSpawner,
} from '@ante/game-core';

// Server-side concrete implementations (can be simple wrappers or extensions if needed)
class ServerEnemyManager extends BaseEnemyManager {}
class ServerPickupManager extends BasePickupManager {}
class ServerTargetSpawner extends BaseTargetSpawner {}

export class ServerGameController {
  private networkManager: ServerNetworkManager;
  private api: ServerApi;
  private isRunning = false;

  private engine: NullEngine;
  private scene: Scene;
  private simulation: WorldSimulation;

  // [추가] 플레이어 ID와 물리 메쉬(Hitbox) 매핑
  private playerMeshes: Map<string, AbstractMesh> = new Map();

  constructor() {
    this.networkManager = new ServerNetworkManager();
    this.api = new ServerApi(this.networkManager);

    this.engine = new NullEngine();
    this.scene = new Scene(this.engine);

    // [신규] 시뮬레이션 엔진 초기화
    this.simulation = new WorldSimulation(
      new ServerEnemyManager(this.networkManager),
      new ServerPickupManager(this.networkManager),
      new ServerTargetSpawner(this.networkManager),
      this.networkManager
    );

    // [추가된 부분] 서버용 더미 카메라 생성
    // 서버는 화면을 그리지 않지만, 씬 구동을 위해 카메라가 필수입니다.
    const camera = new ArcRotateCamera('ServerCamera', 0, 0, 10, Vector3.Zero(), this.scene);
    console.log('Camera was created...', camera);

    // 기본 바닥 생성
    const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, this.scene);
    ground.position.y = 0;

    // [추가] 네트워크 이벤트 연결
    this.networkManager.onPlayerJoin = (id) => {
      this.createPlayerHitbox(id);
      // 첫 플레이어가 입장하면 게임 레이아웃 생성
      if (this.playerMeshes.size === 1) {
        this.simulation.targets.spawnInitialTargets();
        this.simulation.enemies.spawnEnemiesAt([
          [5, 0, 5],
          [-5, 0, 5],
        ]);
      }
    };
    this.networkManager.onPlayerLeave = (id) => this.removePlayerHitbox(id);
    this.networkManager.onPlayerMove = (id, pos, rot) => this.updatePlayerHitbox(id, pos, rot);
    this.networkManager.onFireRequest = (id, origin, dir) => this.processFireEvent(id, origin, dir);
    this.networkManager.onHitRequest = (shooterId, data) => {
      console.log(
        `[Server] Trusted Hit: ${shooterId} hit ${data.targetId} (${data.hitPart}) for ${data.damage} dmg`
      );
      this.networkManager.broadcastHit({
        targetId: data.targetId,
        damage: data.damage,
        attackerId: shooterId,
        hitPart: data.hitPart,
      });
    };

    console.log('[ServerGameController] Physics World Initialized');
  }

  public async start(): Promise<void> {
    console.log('[ServerGameController] Starting...');
    await this.networkManager.connect();
    this.api.start();
    this.isRunning = true;

    let lastTickTime = Date.now();
    const tickInterval = 100; // 10Hz (100ms마다 방송)

    // 3. 게임 루프: 렌더링 대신 씬 업데이트 수행
    this.engine.runRenderLoop(() => {
      if (!this.isRunning) return;

      // Babylon 물리/로직 업데이트
      this.scene.render();

      // 4. 네트워크 상태 전파 (TickRate 제절)
      const now = Date.now();
      if (now - lastTickTime >= tickInterval) {
        this.networkManager.broadcastState();
        lastTickTime = now;
      }
    });

    setTimeout(() => {
      console.log('=== [Server] Creating Fixed Room: TEST_ROOM ==='); // 이 로그가 떠야 함
      this.networkManager
        .createGameRoom('TEST_ROOM', 'training_ground')
        .catch((e) => console.error('Room creation failed:', e));
    }, 1000);
  }

  // [신규] 플레이어 캡슐 생성
  private createPlayerHitbox(id: string) {
    if (this.playerMeshes.has(id)) return;

    // 높이 2m, 지름 1m 캡슐 (일반적인 FPS 캐릭터 크기)
    const hitbox = MeshBuilder.CreateCapsule(
      'Player_' + id,
      { height: 2, radius: 0.5 },
      this.scene
    );
    hitbox.position.y = 1; // 발이 바닥에 닿게 보정
    hitbox.checkCollisions = true; // 충돌 처리 활성화

    // 사격 판정을 위한 메타데이터
    hitbox.metadata = { isPlayer: true, id: id };

    this.playerMeshes.set(id, hitbox);
    console.log(`[Server] Created Hitbox for Player: ${id}`);
  }

  // [신규] 플레이어 이동 동기화
  private updatePlayerHitbox(id: string, pos: any, rot: any) {
    const hitbox = this.playerMeshes.get(id);
    if (hitbox) {
      // 서버의 캡슐을 클라이언트 위치로 순간이동 (추후 보간 적용 가능)
      hitbox.position.set(pos.x, pos.y, pos.z);
      // 회전은 보통 Y축(Heading)만 중요
      if (rot) hitbox.rotation.set(rot.x, rot.y, rot.z);
    }
  }

  // [신규] 플레이어 퇴장 처리
  private removePlayerHitbox(id: string) {
    const hitbox = this.playerMeshes.get(id);
    if (hitbox) {
      hitbox.dispose();
      this.playerMeshes.delete(id);
      console.log(`[Server] Removed Hitbox for Player: ${id}`);
    }
  }

  public processFireEvent(
    playerId: string,
    _origin: any,
    _direction: any,
    _weaponIdOverride?: string
  ) {
    // 클라이언트 주도 방식에서는 서버에서 물리 연산(Raycast)을 수행하지 않습니다.
    // 단순히 발사 이벤트가 발생했음을 로그에 남기거나, 필요한 경우 비주얼 처리를 위해 브로드캐스트할 수 있습니다.
    console.log(`[Server] Fire Event: ${playerId}`);
  }

  public stop(): void {
    this.isRunning = false;
    this.engine.dispose();
    this.networkManager.disconnect();
  }
}
