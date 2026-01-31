import { NullEngine, Scene, MeshBuilder, ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { ServerNetworkAuthority } from './ServerNetworkAuthority.js';
import { RequestHitData, Vector3 as commonVector3, Logger, EventCode } from '@ante/common';
import { WorldSimulation } from '../simulation/WorldSimulation.js';
import { WaveSurvivalRule } from '../rules/WaveSurvivalRule.js';
import { HitRegistrationSystem } from '../systems/HitRegistrationSystem.js';

import { ServerEnemyManager } from './managers/ServerEnemyManager.js';
import { ServerPickupManager } from './managers/ServerPickupManager.js';
import { ServerTargetSpawner } from './managers/ServerTargetSpawner.js';
import { ServerPlayerPawn } from './pawns/ServerPlayerPawn.js';
import { IServerAssetLoader } from './IServerAssetLoader.js';

const logger = new Logger('LogicalServer');

/**
 * 게임 로직을 수행하는 핵심 서버 클래스.
 * Node.js(Dedicated Server)와 Browser(Client Host) 모두에서 동작할 수 있도록 설계됨.
 */
export class LogicalServer {
  private networkManager: ServerNetworkAuthority;
  private assetLoader: IServerAssetLoader;
  private isRunning = false;

  private engine: NullEngine;
  private scene: Scene;
  private simulation: WorldSimulation;
  private enemyManager: ServerEnemyManager;
  private targetSpawner: ServerTargetSpawner;

  // 플레이어 ID와 물리 메쉬(Hitbox) 매핑
  private playerPawns: Map<string, ServerPlayerPawn> = new Map();

  constructor(networkManager: ServerNetworkAuthority, assetLoader: IServerAssetLoader) {
    this.networkManager = networkManager;
    this.assetLoader = assetLoader;

    this.engine = new NullEngine();
    this.scene = new Scene(this.engine);

    // 시뮬레이션 엔진 초기화
    this.enemyManager = new ServerEnemyManager(
      this.networkManager,
      this.scene,
      () => this.playerPawns
    );
    this.targetSpawner = new ServerTargetSpawner(this.networkManager, this.scene);

    this.simulation = new WorldSimulation(
      this.enemyManager,
      new ServerPickupManager(this.networkManager),
      this.targetSpawner,
      this.networkManager
    );

    // 게임 룰(모드) 설정
    this.simulation.setGameRule(new WaveSurvivalRule());

    // 서버용 더미 카메라 생성
    // 서버는 화면을 그리지 않지만, 씬 구동을 위해 카메라가 필수입니다.
    const camera = new ArcRotateCamera('ServerCamera', 0, 0, 10, Vector3.Zero(), this.scene);
    logger.info('Camera was created...', camera);

    // 기본 바닥 생성
    const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, this.scene);
    ground.position.y = 0;

    // 네트워크 이벤트 연결
    this.setupNetworkEvents();

    logger.info('Physics World Initialized');
  }

  private setupNetworkEvents(): void {
    this.networkManager.onPlayerJoin = (id) => {
      this.createPlayerPawn(id);
      // 첫 플레이어가 입장하면 게임 레이아웃 생성
      if (this.playerPawns.size === 1) {
        this.simulation.initializeRequest();
      }
    };
    this.networkManager.onPlayerLeave = (id: string) => this.removePlayerPawn(id);
    this.networkManager.onPlayerMove = (id: string, pos: commonVector3, rot: commonVector3) =>
      this.updatePlayerPawn(id, pos, rot);
    this.networkManager.onFireRequest = (id, origin: commonVector3, dir: commonVector3) =>
      this.processFireEvent(id, origin, dir);
    this.networkManager.onHitRequest = (shooterId: string, data: RequestHitData) =>
      this.processHitRequest(shooterId, data);
  }

  public start(): void {
    if (this.isRunning) return;
    logger.info('Starting Game Simulation...');
    this.isRunning = true;

    let lastTickTime = performance.now();
    const tickInterval = 7.8; // 128Hz

    // 게임 루프: 렌더링 대신 씬 업데이트 수행
    this.engine.runRenderLoop(() => {
      if (!this.isRunning) return;

      const currentTime = performance.now();

      // NOTE: TickManager.tick() is intentionally NOT called here.
      // When client hosts locally, TickManager is a singleton shared with client.
      // Calling it here would double-tick player movement.
      // Server only needs to update its own scene and simulation.

      // 1. Babylon 물리/로직 업데이트
      this.scene.render();

      // 3. 네트워크 상태 전파 (TickRate 조절)
      if (currentTime - lastTickTime >= tickInterval) {
        const enemyStates = this.enemyManager.getEnemyStates();
        this.networkManager.broadcastState(enemyStates);
        lastTickTime = currentTime;
      }
    });
  }

  private createPlayerPawn(id: string): void {
    if (this.playerPawns.has(id)) return;

    // Use ServerPlayerPawn which loads the mesh via AssetLoader
    const pawn = new ServerPlayerPawn(id, this.scene, new Vector3(0, 1.75, 0), this.assetLoader);
    this.playerPawns.set(id, pawn);
  }

  public updatePlayerPawn(id: string, pos: commonVector3, rot: commonVector3): void {
    const pawn = this.playerPawns.get(id);
    if (pawn && pawn.mesh) {
      // 서버의 캡슐을 클라이언트 위치로 순간이동
      pawn.mesh.position.set(pos.x, pos.y, pos.z);

      // 회전은 보통 Y축(Heading)만 중요
      if (rot) pawn.mesh.rotation.set(rot.x, rot.y, rot.z);
    }

    // Also update entityManager so broadcastState sends correct positions
    const state = this.networkManager.getPlayerState(id);
    if (state) {
      state.position = { x: pos.x, y: pos.y, z: pos.z };
      state.rotation = { x: rot.x, y: rot.y, z: rot.z };
    }
  }

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
    origin: commonVector3,
    direction: commonVector3,
    weaponIdOverride?: string
  ): void {
    logger.debug(
      `Fire Event from: ${playerId} at ${origin.x}, ${origin.y}, ${origin.z} (dir: ${direction.x}, ${direction.y}, ${direction.z}, weapon: ${weaponIdOverride || 'default'})`
    );
  }

  public processSyncWeapon(playerId: string, weaponId: string): void {
    const state = this.networkManager.getPlayerState(playerId);
    if (state) {
      // Short-circuit: only update if state exists
      state.weaponId = weaponId;
    }
  }

  public processHitRequest(shooterId: string, data: RequestHitData): void {
    // 1. Validate Hit using Server Raycast
    let isValidHit = false;
    const finalDamage = data.damage;
    let hitPart = data.part || 'body';

    logger.info(`Validating Hit from ${shooterId} on ${data.targetId}`);

    // Ignore ground hits or undefined targets for now
    if (!data.targetId || data.targetId === 'ground') {
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
  }

  public stop(): void {
    this.isRunning = false;
    this.engine.dispose();
  }
}
