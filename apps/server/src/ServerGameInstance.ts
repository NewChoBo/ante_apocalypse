// Polyfill for Babylon.js Server-side
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
global.XMLHttpRequest = require('xhr2').XMLHttpRequest;

import {
  NullEngine,
  Scene,
  MeshBuilder,
  ArcRotateCamera,
  Vector3,
  AbstractMesh,
} from '@babylonjs/core';
import { ServerNetworkManager } from './ServerNetworkManager.ts';
import { RequestHitData, Vector3 as commonVector3, Logger, EventCode } from '@ante/common';
import {
  WorldSimulation,
  BaseEnemyManager,
  BasePickupManager,
  BaseTargetSpawner,
  HitRegistrationSystem,
  TickManager,
} from '@ante/game-core';
import { ServerEnemyPawn } from './core/ServerEnemyPawn.ts';
import { ServerTargetPawn } from './core/ServerTargetPawn.ts';
import { ServerPlayerPawn } from './core/ServerPlayerPawn.ts';

// Server-side concrete implementations
class ServerEnemyManager extends BaseEnemyManager {
  private enemyPawns: Map<string, ServerEnemyPawn> = new Map();
  private scene: Scene;

  constructor(
    authority: ServerNetworkManager,
    scene: Scene,
    private getPlayers: () => Map<string, ServerPlayerPawn>
  ) {
    super(authority);
    this.scene = scene;
  }

  public override requestSpawnEnemy(id: string, position: commonVector3): boolean {
    if (!super.requestSpawnEnemy(id, new Vector3(position.x, position.y, position.z))) return false;

    // Create server-side representation
    const pawn = new ServerEnemyPawn(
      id,
      this.scene,
      new Vector3(position.x, position.y, position.z)
    );
    this.enemyPawns.set(id, pawn);

    // [New] Register AI
    // Simple logic: Target the first available player
    const players = this.getPlayers();
    const target = players.values().next().value;
    this.onEnemySpawned(id, pawn, target);
    return true;
  }

  public getEnemyMesh(id: string): AbstractMesh | undefined {
    return this.enemyPawns.get(id)?.mesh;
  }

  protected getEnemyPawn(id: string): ServerEnemyPawn | undefined {
    return this.enemyPawns.get(id);
  }
}
class ServerPickupManager extends BasePickupManager {}

class ServerTargetSpawner extends BaseTargetSpawner {
  private targetPawns: Map<string, ServerTargetPawn> = new Map();
  private scene: Scene;

  constructor(authority: ServerNetworkManager, scene: Scene) {
    super(authority);
    this.scene = scene;
  }

  public override broadcastTargetSpawn(
    id: string,
    type: string,
    position: commonVector3,
    isMoving: boolean
  ): void {
    super.broadcastTargetSpawn(id, type, new Vector3(position.x, position.y, position.z), isMoving);

    // Create server-side mesh for raycast
    // Fix: Convert commonVector3 (interface) to Babylon Vector3 (class)
    const pawn = new ServerTargetPawn(
      id,
      this.scene,
      new Vector3(position.x, position.y, position.z)
    );
    this.targetPawns.set(id, pawn);
  }

  public override broadcastTargetDestroy(targetId: string): void {
    super.broadcastTargetDestroy(targetId);

    const pawn = this.targetPawns.get(targetId);
    if (pawn) {
      pawn.dispose();
      this.targetPawns.delete(targetId);
    }
  }

  public getTargetMesh(id: string): AbstractMesh | undefined {
    return this.targetPawns.get(id)?.mesh;
  }
}

const logger = new Logger('ServerGameInstance');

export class ServerGameInstance {
  private networkManager: ServerNetworkManager;
  // private api: ServerApi; // Moved to ServerApp
  private isRunning = false;

  private engine: NullEngine;
  private scene: Scene;
  private simulation: WorldSimulation;
  private enemyManager: ServerEnemyManager;
  private targetSpawner: ServerTargetSpawner;

  // [추가] 플레이어 ID와 물리 메쉬(Hitbox) 매핑
  private playerPawns: Map<string, ServerPlayerPawn> = new Map();

  constructor(networkManager: ServerNetworkManager) {
    this.networkManager = networkManager;
    // this.api = new ServerApi(this.networkManager); // Moved to ServerApp

    this.engine = new NullEngine();
    this.scene = new Scene(this.engine);

    // [신규] 시뮬레이션 엔진 초기화
    this.enemyManager = new ServerEnemyManager(
      this.networkManager,
      this.scene,
      () => this.playerPawns
    );
    this.targetSpawner = new ServerTargetSpawner(this.networkManager, this.scene); // Store ref

    this.simulation = new WorldSimulation(
      this.enemyManager,
      new ServerPickupManager(this.networkManager),
      this.targetSpawner,
      this.networkManager
    );

    // [추가된 부분] 서버용 더미 카메라 생성
    // 서버는 화면을 그리지 않지만, 씬 구동을 위해 카메라가 필수입니다.
    const camera = new ArcRotateCamera('ServerCamera', 0, 0, 10, Vector3.Zero(), this.scene);
    logger.info('Camera was created...', camera);

    // 기본 바닥 생성
    const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, this.scene);
    ground.position.y = 0;

    // [추가] 네트워크 이벤트 연결
    this.networkManager.onPlayerJoin = (id) => {
      this.createPlayerPawn(id);
      // 첫 플레이어가 입장하면 게임 레이아웃 생성
      if (this.playerPawns.size === 1) {
        this.simulation.targets.spawnInitialTargets();
        this.simulation.enemies.spawnEnemiesAt([
          [5, 0, 5],
          [-5, 0, 5],
        ]);
      }
    };
    this.networkManager.onPlayerLeave = (id: string) => this.removePlayerPawn(id);
    this.networkManager.onPlayerMove = (id: string, pos: commonVector3, rot: commonVector3) =>
      this.updatePlayerPawn(id, pos, rot);
    this.networkManager.onFireRequest = (id, origin: commonVector3, dir: commonVector3) =>
      this.processFireEvent(id, origin, dir);
    this.networkManager.onHitRequest = (shooterId: string, data: RequestHitData) => {
      // 1. Validate Hit using Server Raycast
      let isValidHit = false;
      const finalDamage = data.damage;
      let hitPart = data.part || 'body';

      logger.info(`Validating Hit from ${shooterId} on ${data.targetId}`);

      // Ignore ground hits or undefined targets for now
      if (!data.targetId || data.targetId === 'ground') {
        // logger.debug('[Server] Ignoring hit on ground/undefined');
        return;
      }

      if (data.origin && data.direction) {
        const rayOrigin = new Vector3(data.origin.x, data.origin.y, data.origin.z);
        const rayDirection = new Vector3(data.direction.x, data.direction.y, data.direction.z);

        // 1. Find the target mesh
        const targetMesh =
          this.enemyManager.getEnemyMesh(data.targetId) ||
          this.targetSpawner.getTargetMesh(data.targetId) ||
          this.playerPawns.get(data.targetId)?.mesh;

        if (targetMesh) {
          // 2. Use common HitRegistrationSystem for validation
          const validation = HitRegistrationSystem.validateHit(
            this.scene,
            data.targetId,
            rayOrigin,
            rayDirection,
            targetMesh,
            0.8 // margin
          );

          isValidHit = validation.isValid;
          hitPart = validation.part;

          if (isValidHit) {
            logger.info(
              `[${validation.method.toUpperCase()}] Hit Verified: ${data.targetId} (${hitPart})`
            );
          } else {
            logger.warn(`[Rejected] Hit too far: Distance=${validation.distance?.toFixed(3)}m`);
          }
        } else {
          logger.warn(`[Rejected] Target mesh not found: ${data.targetId}`);
        }
      } else {
        // Fallback for missing ray data
        isValidHit = true;
      }

      if (isValidHit) {
        // Determine Event Code based on target type
        const isPlayer = this.playerPawns.has(data.targetId);
        const eventCode = isPlayer ? EventCode.HIT : EventCode.TARGET_HIT;

        // Calculate new health based on server state
        const targetState = this.networkManager.getPlayerState(data.targetId);
        let newHealth = 0;
        if (targetState) {
          newHealth = Math.max(0, targetState.health - finalDamage);
        }

        logger.info(
          `Processing Hit: ${shooterId} hit ${data.targetId} (${data.part}) for ${finalDamage} dmg. NewHealth: ${newHealth} (Type: ${isPlayer ? 'Player' : 'Target'})`
        );

        this.networkManager.broadcastHit(
          {
            targetId: data.targetId,
            damage: finalDamage,
            attackerId: shooterId,
            part: data.part,
            newHealth: newHealth,
          },
          eventCode
        );
      }
    };

    logger.info('Physics World Initialized');
  }

  public start(): void {
    if (this.isRunning) return;
    logger.info('Starting Game Simulation...');
    // Network connection and API start moved to ServerApp
    this.isRunning = true;

    let lastTickTime = performance.now();
    let lastFrameTime = performance.now();
    const tickInterval = 7.8; // 128Hz for extremely smooth and responsive high-performance update

    // 3. 게임 루프: 렌더링 대신 씬 업데이트 수행
    this.engine.runRenderLoop(() => {
      if (!this.isRunning) return;

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastFrameTime) / 1000;
      lastFrameTime = currentTime;

      // 1. 공통 로직 틱 (TickManager에 등록된 폰 등 업데이트)
      TickManager.getInstance().tick(deltaTime);

      // 2. Babylon 물리/로직 업데이트
      this.scene.render();

      // 4. 네트워크 상태 전파 (TickRate 조절)
      if (currentTime - lastTickTime >= tickInterval) {
        this.networkManager.broadcastState();
        lastTickTime = currentTime;
      }
    });

    // Room creation moved to ServerApp
  }

  // [신규] 플레이어 폰 생성 (Mesh Load)
  private createPlayerPawn(id: string): void {
    if (this.playerPawns.has(id)) return;

    // Use ServerPlayerPawn which loads the mesh
    const pawn = new ServerPlayerPawn(id, this.scene, new Vector3(0, 1.75, 0));
    this.playerPawns.set(id, pawn);
  }

  // [신규] 플레이어 이동 동기화
  private updatePlayerPawn(id: string, pos: commonVector3, rot: commonVector3): void {
    const pawn = this.playerPawns.get(id);
    if (pawn && pawn.mesh) {
      // 서버의 캡슐을 클라이언트 위치로 순간이동
      // Client sends Head Position (Y=1.75).
      // ServerPlayerPawn Root is at Head Level (1.75).
      // Visual is offset by -1.75 inside ServerPlayerPawn.
      // So we DO NOT need to subtract 0.75 anymore if we use the same structure!
      // If client says "I am at 1.75", and we set Root to 1.75:
      // Root is at 1.75. Visual is at 0.0. Perfect.
      pawn.mesh.position.set(pos.x, pos.y, pos.z);

      // 회전은 보통 Y축(Heading)만 중요
      if (rot) pawn.mesh.rotation.set(rot.x, rot.y, rot.z);
    }
  }

  // [신규] 플레이어 퇴장 처리
  private removePlayerPawn(id: string): void {
    const pawn = this.playerPawns.get(id);
    if (pawn) {
      pawn.dispose();
      this.playerPawns.delete(id);
      logger.info(`Removed Pawn for Player: ${id}`);
    }
  }

  public processFireEvent(
    playerId: string,
    _origin: commonVector3,
    _direction: commonVector3,
    _weaponIdOverride?: string
  ): void {
    // 클라이언트 주도 방식에서는 서버에서 물리 연산(Raycast)을 수행하지 않습니다.
    // 단순히 발사 이벤트가 발생했음을 로그에 남기거나, 필요한 경우 비주얼 처리를 위해 브로드캐스트할 수 있습니다.
    logger.debug(`Fire Event from: ${playerId}`);
  }

  public stop(): void {
    this.isRunning = false;
    this.engine.dispose();
    // this.networkManager.disconnect(); // Managed by ServerApp
  }
}
