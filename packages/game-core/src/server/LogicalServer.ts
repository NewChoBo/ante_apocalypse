import { NullEngine, Scene, ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { ServerNetworkAuthority } from './ServerNetworkAuthority.js';
import { RequestHitData, Vector3 as commonVector3, Logger, EventCode } from '@ante/common';
import { WorldSimulation } from '../simulation/WorldSimulation.js';
import { IGameRule } from '../rules/IGameRule.js';
import { WaveSurvivalRule } from '../rules/WaveSurvivalRule.js';
import { ShootingRangeRule } from '../rules/ShootingRangeRule.js';
import { DeathmatchRule } from '../rules/DeathmatchRule.js';
import { HitRegistrationSystem } from '../systems/HitRegistrationSystem.js';

import { ServerEnemyManager } from './managers/ServerEnemyManager.js';
import { ServerPickupManager } from './managers/ServerPickupManager.js';
import { ServerTargetSpawner } from './managers/ServerTargetSpawner.js';
import { ServerPlayerPawn } from './pawns/ServerPlayerPawn.js';
import { IServerAssetLoader } from './IServerAssetLoader.js';
import { LevelData } from '../levels/LevelData.js';
import { ServerLevelLoader } from '../levels/ServerLevelLoader.js';

const logger = new Logger('LogicalServer');

/**
 * 게임 로직을 수행하는 핵심 서버 클래스.
 * Node.js(Dedicated Server)와 Browser(Client Host) 모두에서 동작할 수 있도록 설계됨.
 */
export interface LogicalServerOptions {
  /** If true, skip world initialization (used for host migration) */
  isTakeover?: boolean;
  /** Game mode ID: 'survival' | 'shooting_range' | 'deathmatch' */
  gameMode?: string;
}

export class LogicalServer {
  private networkManager: ServerNetworkAuthority;
  private assetLoader: IServerAssetLoader;
  private isRunning = false;
  private isTakeover: boolean;

  private engine: NullEngine;
  private scene: Scene;
  private simulation: WorldSimulation;
  private enemyManager: ServerEnemyManager;
  private targetSpawner: ServerTargetSpawner;

  // 플레이어 ID와 물리 메쉬(Hitbox) 매핑
  private playerPawns: Map<string, ServerPlayerPawn> = new Map();
  private levelLoader: ServerLevelLoader;

  constructor(
    networkManager: ServerNetworkAuthority,
    assetLoader: IServerAssetLoader,
    options?: LogicalServerOptions
  ) {
    this.networkManager = networkManager;
    this.assetLoader = assetLoader;
    this.isTakeover = options?.isTakeover ?? false;

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

    // 게임 룰(모드) 설정 - gameMode에 따라 선택
    const gameMode = options?.gameMode ?? 'survival';
    const gameRule = this.createGameRule(gameMode);
    this.simulation.setGameRule(gameRule);
    logger.info(`Game mode set to: ${gameMode}`);

    this.levelLoader = new ServerLevelLoader(this.scene);

    // 서버용 더미 카메라 생성
    // 서버는 화면을 그리지 않지만, 씬 구동을 위해 카메라가 필수입니다.
    const camera = new ArcRotateCamera('ServerCamera', 0, 0, 10, Vector3.Zero(), this.scene);
    logger.info('Camera was created...', camera);

    // 기본 바닥 생성 (LevelLoader에서 생성하므로 여기서는 제거하거나 중복 확인 필요)
    // this.levelLoader.loadLevelData(...) 호출 전까지는 충돌체가 없을 수 있음.

    // 네트워크 이벤트 연결
    this.setupNetworkEvents();

    // [Fix] Register all existing actors immediately (in case they joined before LogicalServer setup)
    this.networkManager.registerAllActors();

    logger.info('Physics World Initialized');
  }

  private setupNetworkEvents(): void {
    this.networkManager.onPlayerJoin = (id: string): void => {
      this.createPlayerPawn(id);
      // 첫 플레이어가 입장하면 게임 레이아웃 생성 (Takeover가 아닐 때만)
      if (!this.isTakeover && this.playerPawns.size === 1) {
        this.simulation.initializeRequest();
      }
    };
    this.networkManager.onPlayerLeave = (id: string): void => this.removePlayerPawn(id);
    this.networkManager.onPlayerMove = (id: string, pos: commonVector3, rot: commonVector3): void =>
      this.updatePlayerPawn(id, pos, rot);
    this.networkManager.onFireRequest = (
      id: string,
      origin: commonVector3,
      dir: commonVector3
    ): void => this.processFireEvent(id, origin, dir);

    // Register RELOAD callback
    this.networkManager.onReloadRequest = (playerId: string, weaponId: string): void => {
      const pawn = this.playerPawns.get(playerId);
      if (pawn) {
        pawn.reloadRequest();
        this.networkManager.broadcastReload(playerId, weaponId);
      }
    };

    this.networkManager.onHitRequest = (shooterId: string, data: RequestHitData): void =>
      this.processHitRequest(shooterId, data);

    this.networkManager.onPlayerDeath = (targetId: string, _attackerId: string): void => {
      if (this.simulation['gameRule']) {
        const decision = this.simulation['gameRule'].onPlayerDeath(this.simulation, targetId);
        if (decision.action === 'respawn') {
          const delayMs = decision.delay * 1000;
          logger.info(`Player ${targetId} will respawn in ${decision.delay}s`);

          setTimeout(() => {
            const spawnPos = decision.position || { x: 0, y: 1.75, z: 0 };
            this.networkManager.broadcastRespawn(targetId, spawnPos);
          }, delayMs);
        }
      }
    };
  }

  private createGameRule(mode: string): IGameRule {
    switch (mode) {
      case 'shooting_range':
        return new ShootingRangeRule();
      case 'deathmatch':
        return new DeathmatchRule();
      case 'survival':
      default:
        return new WaveSurvivalRule();
    }
  }

  public start(): void {
    if (this.isRunning) return;
    logger.info('Starting Game Simulation...');
    this.isRunning = true;

    let lastTickTime = performance.now();
    const tickInterval = 7.8; // 128Hz
    let lastClock = performance.now();

    this.engine.runRenderLoop(() => {
      if (!this.isRunning) return;

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastClock) / 1000;
      lastClock = currentTime;

      this.playerPawns.forEach((pawn) => pawn.tick(deltaTime));
      this.scene.render();

      if (currentTime - lastTickTime >= tickInterval) {
        const enemyStates = this.enemyManager.getEnemyStates();
        this.networkManager.broadcastState(enemyStates);
        lastTickTime = currentTime;
      }
    });
  }

  public loadLevel(data: LevelData): void {
    logger.info('Loading Level Data into LogicalServer...');
    this.levelLoader.loadLevelData(data);
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
    // 1. Get Player Pawn
    const pawn = this.playerPawns.get(playerId);
    if (!pawn) {
      logger.warn(`Fire event from unknown player: ${playerId}`);
      return;
    }

    // 2. Validate Fire
    const canFire = pawn.fireRequest();

    if (canFire) {
      // Broadcast Event
      // Re-construct event data to broadcast
      this.networkManager.sendEvent(EventCode.FIRE, {
        playerId,
        weaponId: weaponIdOverride || pawn.currentWeapon?.id || 'Unknown',
        muzzleTransform: { position: origin, direction: direction },
      });

      logger.debug(`[VALID] Fire from: ${playerId} (Ammo: ${pawn.currentWeapon?.currentAmmo})`);
    } else {
      logger.warn(`[REJECTED] Fire from: ${playerId} - Weapon not ready or out of ammo.`);
      // Optional: Send correction event to client? (e.g. force reload)
    }
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
          logger.info(`Verified Hit: ${data.targetId} (${hitPart})`);
        } else {
          logger.warn(`[Rejected] Hit too far: Distance=${validation.distance?.toFixed(3)}m`);
        }
      } else {
        // [New] Check if it's an environment hit (Wall, Prop)
        const environmentMesh = this.scene.getMeshByName(data.targetId);
        if (environmentMesh) {
          logger.debug(`[VALID] Environment Hit: ${data.targetId}`);
          isValidHit = true;
          hitPart = 'object';
        } else {
          logger.warn(`[Rejected] Target mesh not found: ${data.targetId}`);
        }
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
