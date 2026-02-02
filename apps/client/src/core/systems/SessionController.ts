import { Scene, Vector3, ShadowGenerator, UniversalCamera, Observer } from '@babylonjs/core';
import { LevelData, WorldSimulation, WaveSurvivalRule } from '@ante/game-core';
import { EventCode, InitialStatePayload, SpawnTargetPayload, Logger } from '@ante/common';

import { PlayerPawn } from '../PlayerPawn';
import { PlayerController } from '../controllers/PlayerController';
import { CombatComponent } from '../components/CombatComponent';
import { HUD } from '../../ui/HUD';
import { InventoryUI } from '../../ui/inventory/InventoryUI';
import { InventoryManager } from '../inventory/InventoryManager';
import { GlobalInputManager } from './GlobalInputManager';
import { PickupManager } from './PickupManager';
import { TargetSpawnerComponent } from '../components/TargetSpawnerComponent';
import { EnemyManager } from './EnemyManager';
import { WorldEntityManager } from './WorldEntityManager';
import { GameObservables } from '../events/GameObservables';
import { GameAssets } from '../GameAssets';
import { playerHealthStore, inventoryStore } from '../store/GameStore';

import { ISessionNetworkService } from '../interfaces/ISessionNetworkService';
import {
  SessionStateMachine,
  SessionState,
  StateTransitionEvent,
  StateTransitionError,
} from './SessionStateMachine';
import { SessionEvents, sessionEvents } from '../events/SessionEvents';

// Lazy imports to avoid circular dependencies
import type { MultiplayerSystem } from './MultiplayerSystem';

const logger = new Logger('SessionController');

/**
 * 네트워크 에러 헨들러 타입
 */
type ErrorHandler = (error: Error, context: string) => void;

/**
 * SessionControllerOptions
 * 의존성 주입을 위한 옵션 인터페이스
 */
export interface SessionControllerOptions {
  /** 네트워크 서비스 인스턴스 */
  networkService?: ISessionNetworkService;
  /** 커스텀 에러 핸들러 */
  onError?: ErrorHandler;
  /** 디버그 모드 */
  debug?: boolean;
}

/**
 * 개선된 SessionController
 * - 의존성 주입 지원
 * - 상태 머신 통합
 * - 이벤트 기반 아키텍처
 * - 포괄적인 에러 핸들링
 */
export class SessionController {
  // Core Dependencies
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private shadowGenerator: ShadowGenerator;

  // Injected Services
  private networkService: ISessionNetworkService;
  private errorHandler: ErrorHandler;
  private debug: boolean;

  // State Management
  private stateMachine: SessionStateMachine;
  private events: SessionEvents;

  // Game Objects
  private playerPawn: PlayerPawn | null = null;
  private playerController: PlayerController | null = null;
  private multiplayerSystem: MultiplayerSystem | null = null;
  private hud: HUD | null = null;
  private inventoryUI: InventoryUI | null = null;
  private enemyManager: EnemyManager | null = null;
  private targetSpawner: TargetSpawnerComponent | null = null;
  private simulation: WorldSimulation | null = null;

  // Observers & Subscriptions
  private healthUnsub: (() => void) | null = null;
  private _initialStateObserver: Observer<InitialStatePayload> | null = null;
  private _spectatorCleanup: (() => void) | null = null;
  // @ts-expect-error - Observer stored for potential future cleanup
  private _stateChangeObserver: Observer<StateTransitionEvent> | null = null;
  // @ts-expect-error - Observer stored for potential future cleanup
  private _errorObserver: Observer<StateTransitionError> | null = null;

  // Spectator State
  private isSpectating: boolean = false;
  private spectateMode: 'FREE' | 'FOLLOW' = 'FREE';
  private spectateTargetIndex: number = -1;

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    shadowGenerator: ShadowGenerator,
    options: SessionControllerOptions = {}
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.shadowGenerator = shadowGenerator;

    // 의존성 주입
    this.networkService = options.networkService ?? this.getDefaultNetworkService();
    this.errorHandler = options.onError ?? this.defaultErrorHandler.bind(this);
    this.debug = options.debug ?? false;

    // 상태 머신 및 이벤트 초기화
    this.stateMachine = new SessionStateMachine();
    this.events = sessionEvents;

    // 상태 변경 구독
    this._stateChangeObserver = this.stateMachine.onStateChanged.add((event) => {
      this.events.onStateChanged.notifyObservers(event);
      this.handleStateChange(event);
    });

    // 에러 구독
    this._errorObserver = this.stateMachine.onError.add((error) => {
      this.errorHandler(error, 'StateMachine');
      this.events.emitSessionError('STATE', error.message, error, false);
    });

    logger.info('SessionController initialized');
  }

  /**
   * 기본 네트워크 서비스 가져오기
   * (backward compatibility)
   */
  private getDefaultNetworkService(): ISessionNetworkService {
    // Lazy load to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const networkModule = require('./NetworkManager');
    return networkModule.NetworkManager.getInstance();
  }

  /**
   * 기본 에러 핸들러
   */
  private defaultErrorHandler(error: Error, context: string): void {
    logger.error(`[${context}]`, error);
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.error(`SessionController Error [${context}]:`, error);
    }
  }

  /**
   * 세션 초기화
   */
  public async initialize(levelData: LevelData, playerName: string = 'Anonymous'): Promise<void> {
    try {
      this.stateMachine.transitionTo(SessionState.INITIALIZING);
      this.events.emitLifecycle('INIT', 'STARTED');

      await this.initializePlayer(levelData);
      await this.initializeSystems(levelData);
      this.setupCombat();
      this.setupInventory();
      this.setupInput();
      await this.initializeMultiplayer(playerName);
      this.setupSpectatorInput();

      this.stateMachine.transitionTo(SessionState.PLAYING);
      this.events.emitLifecycle('INIT', 'COMPLETED');
      this.events.emitInitialized();

      logger.info('Session initialized successfully');
    } catch (error) {
      this.handleInitializationError(error as Error);
      throw error;
    }
  }

  /**
   * 플레이어 초기화
   */
  private async initializePlayer(levelData: LevelData): Promise<void> {
    try {
      this.playerPawn = new PlayerPawn(this.scene);
      WorldEntityManager.getInstance().initialize();
      WorldEntityManager.getInstance().register(this.playerPawn);

      if (levelData.playerSpawn) {
        this.playerPawn.position = Vector3.FromArray(levelData.playerSpawn);
      } else {
        this.playerPawn.position = new Vector3(0, 1.75, -5);
      }

      this.playerController = new PlayerController('player1', this.canvas);
      this.playerController.possess(this.playerPawn);

      this.hud = new HUD();
    } catch (error) {
      throw new Error(`Failed to initialize player: ${(error as Error).message}`);
    }
  }

  /**
   * 시스템 초기화
   */
  private async initializeSystems(levelData: LevelData): Promise<void> {
    try {
      this.targetSpawner = new TargetSpawnerComponent(this.scene, this.shadowGenerator);

      if (levelData.enemySpawns && levelData.enemySpawns.length > 0) {
        this.enemyManager = new EnemyManager(this.scene, this.shadowGenerator);
      }

      PickupManager.getInstance().initialize(this.scene, this.playerPawn!);

      GameObservables.itemCollection.add((): void => {
        GameAssets.sounds.swipe?.play();
      });
    } catch (error) {
      throw new Error(`Failed to initialize systems: ${(error as Error).message}`);
    }
  }

  /**
   * 전투 시스템 설정
   */
  private setupCombat(): void {
    try {
      const combatComp = new CombatComponent(this.playerPawn!, this.scene);
      this.playerPawn!.addComponent(combatComp);

      this.healthUnsub = playerHealthStore.subscribe((health: number): void => {
        if (health <= 0) {
          GameObservables.playerDied.notifyObservers(null);
          this.transitionToSpectatorMode();
          this.hud?.showRespawnCountdown(3);
        }
      });

      combatComp.onWeaponChanged((newWeapon: { name: string }): void => {
        this.syncInventoryStore();
        this.syncWeaponWithNetwork(newWeapon.name);
      });
    } catch (error) {
      this.errorHandler(error as Error, 'CombatSetup');
      this.events.emitSystemError('Combat', 'setup', error as Error);
    }
  }

  /**
   * 네트워크에 무기 동기화
   */
  private syncWeaponWithNetwork(weaponName: string): void {
    try {
      this.networkService.syncWeapon(weaponName);
    } catch (error) {
      this.events.emitNetworkError(
        500,
        `Failed to sync weapon: ${(error as Error).message}`,
        false
      );
    }
  }

  /**
   * 관전 모드로 전환
   */
  private transitionToSpectatorMode(): void {
    this.isSpectating = true;
    this.spectateMode = 'FREE';
    this.stateMachine.transitionTo(SessionState.SPECTATING, { reason: 'player_death' });
  }

  /**
   * 인벤토리 설정
   */
  private setupInventory(): void {
    try {
      this.inventoryUI = new InventoryUI({
        onEquipWeapon: (slot: number, weaponId: string | null): void => {
          this.handleEquipWeapon(slot, weaponId);
        },
        onUseItem: (itemId: string): void => {
          this.handleUseItem(itemId);
        },
        onDropItem: (itemId: string): void => {
          this.handleDropItem(itemId);
        },
      });
      this.syncInventoryStore();
    } catch (error) {
      this.errorHandler(error as Error, 'InventorySetup');
      this.events.emitSystemError('Inventory', 'setup', error as Error);
    }
  }

  private handleEquipWeapon(slot: number, weaponId: string | null): void {
    try {
      const state = inventoryStore.get();
      const slots = [...state.weaponSlots];
      slots[slot] = weaponId;
      inventoryStore.setKey('weaponSlots', slots);

      if (weaponId) {
        const combat = this.playerPawn?.getComponent<CombatComponent>('CombatComponent');
        combat?.equipWeapon(weaponId);
      }
    } catch (error) {
      this.errorHandler(error as Error, 'EquipWeapon');
    }
  }

  private handleUseItem(itemId: string): void {
    try {
      if (this.playerPawn) {
        InventoryManager.useItem(itemId, this.playerPawn);
        this.syncInventoryStore();
      }
    } catch (error) {
      this.errorHandler(error as Error, 'UseItem');
    }
  }

  private handleDropItem(itemId: string): void {
    try {
      if (!this.playerPawn) return;
      const state = inventoryStore.get();
      const bag = [...state.bagItems];
      const itemIndex = bag.findIndex((i) => i.id === itemId);

      if (itemIndex !== -1) {
        const item = bag[itemIndex];
        if (item.count > 1) {
          bag[itemIndex] = { ...item, count: item.count - 1 };
        } else {
          bag.splice(itemIndex, 1);
        }
        inventoryStore.setKey('bagItems', bag);
      }
    } catch (error) {
      this.errorHandler(error as Error, 'DropItem');
    }
  }

  /**
   * 입력 설정
   */
  private setupInput(): void {
    try {
      GlobalInputManager.getInstance().initialize(
        this.scene,
        this.canvas,
        this.playerPawn!,
        this.playerController!,
        this.inventoryUI!
      );
    } catch (error) {
      this.errorHandler(error as Error, 'InputSetup');
      this.events.emitSystemError('Input', 'setup', error as Error);
    }
  }

  /**
   * 멀티플레이어 초기화
   */
  private async initializeMultiplayer(playerName: string): Promise<void> {
    try {
      this.stateMachine.transitionTo(SessionState.CONNECTING);
      this.events.emitLifecycle('CONNECT', 'STARTED');

      // Lazy load MultiplayerSystem to avoid circular dependency
      const { MultiplayerSystem } = await import('./MultiplayerSystem');

      this.multiplayerSystem = new MultiplayerSystem(
        this.scene,
        this.playerPawn!,
        this.shadowGenerator,
        playerName
      );

      await this.setupNetworkSimulation();
      this.setupNetworkListeners();

      this.stateMachine.transitionTo(SessionState.PLAYING);
      this.events.emitLifecycle('CONNECT', 'COMPLETED');
    } catch (error) {
      this.events.emitNetworkError(
        500,
        `Multiplayer initialization failed: ${(error as Error).message}`,
        false
      );
      throw error;
    }
  }

  /**
   * 네트워크 시뮬레이션 설정
   */
  private async setupNetworkSimulation(): Promise<void> {
    const { LocalServerManager } = await import('../server/LocalServerManager');
    const isLocalServerRunning = LocalServerManager.getInstance().isServerRunning();

    if (this.enemyManager && this.targetSpawner && !isLocalServerRunning) {
      // NetworkManager를 NetworkService로 캐스팅하여 사용
      this.simulation = new WorldSimulation(
        this.enemyManager,
        PickupManager.getInstance(),
        this.targetSpawner,
        this.networkService as unknown as import('@ante/game-core').INetworkAuthority
      );
      this.simulation.setGameRule(new WaveSurvivalRule());
    }

    if (this.networkService.isMasterClient()) {
      if (this.simulation) {
        this.simulation.initializeRequest();
      }
    } else {
      this.networkService.sendEvent(EventCode.REQ_INITIAL_STATE, {}, true);
    }
  }

  /**
   * 네트워크 리스너 설정
   */
  private setupNetworkListeners(): void {
    try {
      this._initialStateObserver = this.networkService.onInitialStateReceived.add(
        (data: InitialStatePayload): void => {
          this.handleInitialState(data);
        }
      );

      // 네트워크 연결 상태 모니터링
      this.networkService.onStateChanged.add((state) => {
        this.events.emitConnectionStatus(
          state.toString() === 'InRoom',
          `Network state changed to ${state}`
        );
      });

      // 플레이어 리스폰 처리
      this.networkService.onPlayerRespawn.add((data) => {
        if (data.playerId === this.networkService.getSocketId()) {
          this.handleLocalPlayerRespawn();
        }
      });
    } catch (error) {
      this.events.emitNetworkError(
        500,
        `Failed to setup network listeners: ${(error as Error).message}`,
        false
      );
    }
  }

  /**
   * 초기 상태 처리
   */
  private handleInitialState(data: InitialStatePayload): void {
    try {
      if (this.enemyManager) {
        this.enemyManager.applyEnemyStates(data.enemies);
      }
      if (this.multiplayerSystem) {
        this.multiplayerSystem.applyPlayerStates(data.players);
      }
      if (data.targets && this.targetSpawner) {
        data.targets.forEach((t: SpawnTargetPayload): void => {
          this.targetSpawner!.spawnTarget(
            new Vector3(t.position.x, t.position.y, t.position.z),
            t.isMoving,
            t.id,
            t.type
          );
        });
      }
    } catch (error) {
      this.events.emitSystemError('Network', 'handleInitialState', error as Error);
    }
  }

  /**
   * 로컬 플레이어 리스폰 처리
   */
  private handleLocalPlayerRespawn(): void {
    this.isSpectating = false;
    this.spectateMode = 'FREE';
    this.hud?.hideRespawnMessage();

    if (this.stateMachine.state === SessionState.SPECTATING) {
      this.stateMachine.transitionTo(SessionState.PLAYING);
    }
  }

  /**
   * 초기화 에러 처리
   */
  private handleInitializationError(error: Error): void {
    logger.error('Session initialization failed:', error);
    this.stateMachine.transitionToError(error.message);
    this.events.emitSessionError('SYSTEM', `Initialization failed: ${error.message}`, error, false);
    this.events.emitLifecycle('INIT', 'FAILED', { error: error.message });
  }

  /**
   * 상태 변경 핸들러
   */
  private handleStateChange(event: StateTransitionEvent): void {
    logger.debug(`State changed: ${event.from} -> ${event.to}`);

    switch (event.to) {
      case SessionState.ERROR:
        this.handleErrorState();
        break;
      case SessionState.SPECTATING:
        this.events.emitPlayerAction(this.networkService.getSocketId() || 'unknown', 'DEATH', {
          mode: this.spectateMode,
        });
        break;
    }
  }

  /**
   * 에러 상태 처리
   */
  private handleErrorState(): void {
    logger.error('Session entered error state');
    // 에러 상태에서 복구 시도 또는 정리
    this.dispose();
  }

  /**
   * 인벤토리 스토어 동기화
   */
  private syncInventoryStore(): void {
    try {
      if (!this.playerPawn) return;
      const combat = this.playerPawn.getComponent<CombatComponent>('CombatComponent');
      if (!combat) return;

      const weapons = combat.getWeapons();
      const slots: (string | null)[] = [null, null, null, null];
      weapons.forEach((w: { name: string }, i: number) => {
        if (i < 4) slots[i] = w.name;
      });

      const weaponBagItems = weapons.map((w) => ({
        id: w.name,
        name: w.name,
        type: 'weapon' as const,
        count: 1,
      }));

      const currentState = inventoryStore.get();
      const consumables = currentState.bagItems.filter((i) => i.type === 'consumable');

      inventoryStore.set({
        ...currentState,
        weaponSlots: slots,
        bagItems: [...weaponBagItems, ...consumables],
      });
    } catch (error) {
      this.errorHandler(error as Error, 'SyncInventory');
    }
  }

  /**
   * 세션 시작
   */
  public start(): void {
    try {
      if (!this.playerPawn) {
        throw new Error('Player pawn not initialized');
      }
      this.playerPawn.initialize();
      this.syncInventoryStore();
      this.events.emitLifecycle('PLAY', 'STARTED');
      logger.info('Session started');
    } catch (error) {
      this.errorHandler(error as Error, 'Start');
      this.events.emitSessionError('SYSTEM', 'Failed to start session', error as Error, false);
    }
  }

  /**
   * 플레이어 칼라 반환
   */
  public getPlayerCamera(): UniversalCamera | null {
    return this.playerPawn?.camera || null;
  }

  /**
   * 입력 차단 설정
   */
  public setInputBlocked(blocked: boolean): void {
    this.playerController?.setInputBlocked(blocked);
  }

  /**
   * 업데이트 루프
   */
  public update(deltaTime: number): void {
    try {
      if (this.multiplayerSystem) {
        this.multiplayerSystem.update();
      }
      if (this.enemyManager) {
        this.enemyManager.update(deltaTime);
      }

      if (this.isSpectating && this.spectateMode === 'FOLLOW') {
        this.updateSpectatorFollow();
      }
    } catch (error) {
      this.errorHandler(error as Error, 'Update');
    }
  }

  /**
   * 관전자 추적 업데이트
   */
  private updateSpectatorFollow(): void {
    if (!this.multiplayerSystem || !this.playerPawn) return;
    const players = this.multiplayerSystem.getRemotePlayers();
    if (players.length === 0) {
      this.spectateMode = 'FREE';
      return;
    }

    if (this.spectateTargetIndex < 0 || this.spectateTargetIndex >= players.length) {
      this.spectateTargetIndex = 0;
    }

    const target = players[this.spectateTargetIndex];
    if (target && target.mesh) {
      const targetPos = target.mesh.position;
      const followOffset = new Vector3(0, 2.0, -3.0);
      const desiredPos = targetPos.add(followOffset);
      this.playerPawn.mesh.position.copyFrom(desiredPos);
      this.playerPawn.camera.setTarget(targetPos);
    }
  }

  /**
   * 관전자 입력 설정
   */
  private setupSpectatorInput(): void {
    const onMouseDown = (e: MouseEvent): void => {
      if (!this.isSpectating) return;
      if (!document.pointerLockElement) return;

      if (e.button === 0) {
        this.cycleSpectateTarget(1);
      } else if (e.button === 2) {
        this.cycleSpectateTarget(-1);
      }
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (!this.isSpectating) return;
      if (e.code === 'Space' && !e.repeat) {
        this.spectateMode = this.spectateMode === 'FREE' ? 'FOLLOW' : 'FREE';
        if (this.spectateMode === 'FOLLOW') {
          this.cycleSpectateTarget(0);
        }
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);

    this._spectatorCleanup = (): void => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }

  /**
   * 관전 대상 순환
   */
  private cycleSpectateTarget(dir: number): void {
    if (!this.multiplayerSystem) return;
    const players = this.multiplayerSystem.getRemotePlayers();
    if (players.length === 0) {
      this.spectateMode = 'FREE';
      return;
    }

    this.spectateMode = 'FOLLOW';
    this.spectateTargetIndex = (this.spectateTargetIndex + dir + players.length) % players.length;
  }

  /**
   * 세션 정리
   */
  public dispose(): void {
    try {
      this.stateMachine.transitionTo(SessionState.DISCONNECTING);
      this.events.emitLifecycle('DISPOSE', 'STARTED');

      // 구독 해제
      this.healthUnsub?.();
      this._spectatorCleanup?.();

      // 옵저버 제거
      if (this._initialStateObserver) {
        this.networkService.onInitialStateReceived.remove(this._initialStateObserver);
        this._initialStateObserver = null;
      }

      // 상태 머신 정리
      this.stateMachine.dispose();

      // 컴포넌트 정리
      this.playerController?.dispose();
      this.playerPawn?.dispose();
      this.hud?.dispose();
      this.inventoryUI?.dispose();
      this.multiplayerSystem?.dispose();
      this.enemyManager?.dispose();

      // 네트워크 정리
      this.networkService.clearObservers();

      this.stateMachine.transitionTo(SessionState.DISPOSED);
      this.events.emitLifecycle('DISPOSE', 'COMPLETED');
      this.events.emitDisposed();

      logger.info('Session disposed');
    } catch (error) {
      this.errorHandler(error as Error, 'Dispose');
      this.events.emitSessionError('SYSTEM', 'Error during dispose', error as Error, false);
    }
  }

  /**
   * 현재 세션 상태 반환
   */
  public getState(): SessionState {
    return this.stateMachine.state;
  }

  /**
   * 네트워크 서비스 반환 (DI 테스트용)
   */
  public getNetworkService(): ISessionNetworkService {
    return this.networkService;
  }
}
