import { NullEngine, Scene, MeshBuilder, ArcRotateCamera, Vector3, Ray } from '@babylonjs/core';
import { ServerNetworkManager } from './ServerNetworkManager.ts';
import { ServerApi } from './ServerApi.ts';
import { WeaponRegistry } from '@ante/common';
import {
  WorldSimulation,
  BaseEnemyManager,
  BasePickupManager,
  BaseTargetSpawner,
  HitboxSystem,
  HitboxPart,
  HitboxGroup,
} from '@ante/game-core';

interface PlayerStateLog {
  timestamp: number;
  position: Vector3;
  rotation: Vector3;
}

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
  private playerHitboxes: Map<string, HitboxGroup> = new Map();
  private stateHistory: Map<string, PlayerStateLog[]> = new Map();
  private readonly MAX_HISTORY_MS = 1000; // 1초간의 위치 기록 유지

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
      if (this.playerHitboxes.size === 1) {
        this.simulation.targets.spawnInitialTargets();
        this.simulation.enemies.spawnEnemiesAt([
          [5, 0, 5],
          [-5, 0, 5],
        ]);
      }
    };
    this.networkManager.onPlayerLeave = (id) => this.removePlayerHitbox(id);
    this.networkManager.onPlayerMove = (id, pos, rot) => this.updatePlayerHitbox(id, pos, rot);
    this.networkManager.onFireRequest = (id, origin, dir, weaponId, hitInfo, timestamp) =>
      this.processFireEvent(id, origin, dir, weaponId, hitInfo, timestamp);

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

  // [신규] 멀티 파트 히트박스 생성
  private createPlayerHitbox(id: string) {
    if (this.playerHitboxes.has(id)) return;

    const group = HitboxSystem.getInstance().createHitboxGroup(id, this.scene);
    this.playerHitboxes.set(id, group);
    this.stateHistory.set(id, []);

    console.log(`[Server] Created Multi-Part Hitbox for Player: ${id}`);
  }

  // [신규] 플레이어 이동 동기화 및 기록 저장
  private updatePlayerHitbox(id: string, pos: any, rot: any) {
    const group = this.playerHitboxes.get(id);
    if (group) {
      const position = new Vector3(pos.x, pos.y, pos.z);
      const rotation = rot ? new Vector3(rot.x, rot.y, rot.z) : Vector3.Zero();

      // 현재 히트박스 위치 업데이트
      group.root.position.copyFrom(position);
      group.root.rotation.copyFrom(rotation);

      // 위치 기록 추가 (지연 보상용)
      const history = this.stateHistory.get(id) || [];
      const now = Date.now(); // Photon ServerTime 대신 로컬 서버 시간 사용 (상대적 시간 동일)
      history.push({ timestamp: now, position, rotation });

      // 오래된 기록 삭제
      while (history.length > 0 && now - history[0].timestamp > this.MAX_HISTORY_MS) {
        history.shift();
      }
      this.stateHistory.set(id, history);
    }
  }

  // [신규] 플레이어 퇴장 처리
  private removePlayerHitbox(id: string) {
    const group = this.playerHitboxes.get(id);
    if (group) {
      HitboxSystem.getInstance().removeHitboxGroup(id);
      this.playerHitboxes.delete(id);
      this.stateHistory.delete(id);
      console.log(`[Server] Removed Multi-Part Hitbox for Player: ${id}`);
    }
  }

  // [핵심] 지연 보상 (Lag Compensation): 특정 시점으로 월드 되감기
  private rewindScene(clientTimestamp: number): Map<string, { pos: Vector3; rot: Vector3 }> {
    const originalStates: Map<string, { pos: Vector3; rot: Vector3 }> = new Map();

    this.playerHitboxes.forEach((group, id) => {
      // 현재 상태 백업
      originalStates.set(id, {
        pos: group.root.position.clone(),
        rot: group.root.rotation.clone(),
      });

      // 히스토리에서 가장 가까운 시점 찾기
      const history = this.stateHistory.get(id) || [];
      if (history.length > 0) {
        let closest = history[0];
        let minDiff = Math.abs(clientTimestamp - closest.timestamp);

        for (const log of history) {
          const diff = Math.abs(clientTimestamp - log.timestamp);
          if (diff < minDiff) {
            minDiff = diff;
            closest = log;
          }
        }

        // 히트박스 되감기
        group.root.position.copyFrom(closest.position);
        group.root.rotation.copyFrom(closest.rotation);
      }
    });

    return originalStates;
  }

  private restoreScene(originalStates: Map<string, { pos: Vector3; rot: Vector3 }>) {
    originalStates.forEach((state, id) => {
      const group = this.playerHitboxes.get(id);
      if (group) {
        group.root.position.copyFrom(state.pos);
        group.root.rotation.copyFrom(state.rot);
      }
    });
  }

  // [Authoritative] 사격 판정 로직 (서버 최종 권한 + 지연 보상)
  public processFireEvent(
    playerId: string,
    origin: any,
    direction: any,
    weaponIdOverride?: string,
    _clientHitInfo?: any,
    timestamp?: number
  ) {
    const playerState = this.networkManager.getPlayerState(playerId);
    const weaponId = weaponIdOverride || playerState?.weaponId || 'Pistol';
    const weaponStats = WeaponRegistry[weaponId] || WeaponRegistry['Pistol'];

    const rayOrigin = new Vector3(origin.x, origin.y, origin.z);
    const rayDir = new Vector3(direction.x, direction.y, direction.z);

    // 1. 지연 보상 수행 (되감기)
    const shooterTime = timestamp || Date.now();
    const backup = this.rewindScene(shooterTime);

    // 2. 서버 측 레이캐스트 판정 (멀티 파트 히트박스 대상)
    const ray = new Ray(rayOrigin, rayDir, weaponStats.range);
    const pickInfo = HitboxSystem.getInstance().pickWithRay(ray, this.scene);

    // 3. 월드 복구
    this.restoreScene(backup);

    // 4. 결과 처리
    if (pickInfo?.hit && pickInfo.pickedMesh) {
      const meta = pickInfo.pickedMesh.metadata;

      if (meta && meta.type === 'hitbox') {
        const targetId = meta.targetId;
        const bodyPart = meta.bodyPart;

        if (targetId === playerId) return; // 자가 피해 방지

        console.log(
          `[Server] 🔥 Authoritative HIT! ${playerId} -> ${targetId} (${bodyPart}) at ${shooterTime}`
        );

        let damageMultiplier = 1.0;
        if (bodyPart === HitboxPart.HEAD) damageMultiplier = 2.0;
        else if (bodyPart === HitboxPart.LEG) damageMultiplier = 0.8;

        this.networkManager.broadcastHit({
          targetId: targetId,
          damage: Math.round(weaponStats.damage * damageMultiplier),
          attackerId: playerId,
        });
      }
    } else {
      console.log(`[Server] 💨 Miss by ${playerId} at ${shooterTime}`);
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.engine.dispose();
    this.networkManager.disconnect();
  }
}
