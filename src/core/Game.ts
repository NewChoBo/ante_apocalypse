import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Color3,
  CubeTexture,
  Color4,
  UniversalCamera,
} from '@babylonjs/core';
import { PlayerController } from './controllers/PlayerController';
import { PlayerPawn } from './PlayerPawn';
import { TargetSpawnerComponent } from './components/TargetSpawnerComponent';
import { TargetRegistry } from './systems/TargetRegistry';
import { HUD } from '../ui/HUD';
import { gameStateStore, playerHealthStore } from './store/GameStore.ts';
import { CombatComponent } from './components/CombatComponent';
import { TickManager } from './TickManager';
import { AssetLoader } from './AssetLoader';
import { PickupManager } from './systems/PickupManager';
import { InventoryUI } from '../ui/InventoryUI';
import { inventoryStore } from './store/GameStore';
import '@babylonjs/inspector'; // 인스펙터 기능 활성화
import { LevelLoader, LevelData } from './systems/LevelLoader';
import { EnemyManager } from './systems/EnemyManager';

import { CustomLoadingScreen } from '../ui/CustomLoadingScreen';

import trainingGroundData from '../assets/levels/training_ground.json';
import combatZoneData from '../assets/levels/combat_zone.json';
import studioEnvUrl from '../assets/environments/studio.env?url';

const LEVELS: Record<string, LevelData> = {
  training_ground: trainingGroundData as LevelData,
  combat_zone: combatZoneData as LevelData,
};

export class Game {
  private canvas!: HTMLCanvasElement;
  private engine!: Engine;
  private scene!: Scene;
  private shadowGenerator!: ShadowGenerator;
  private playerController: PlayerController | null = null;
  private playerPawn: PlayerPawn | null = null;
  private hud: HUD | null = null;
  private spawner: TargetSpawnerComponent | null = null;
  private enemyManager: EnemyManager | null = null;
  private inventoryUI: InventoryUI | null = null;
  private healthUnsub: (() => void) | null = null;

  private isRunning = false;
  private isPaused = false;

  private renderFunction: () => void;

  constructor(containerId: string) {
    this.renderFunction = () => {
      if (!this.isPaused && this.scene && this.scene.activeCamera) {
        const deltaTime = this.engine.getDeltaTime() / 1000;
        this.update(deltaTime);
        this.scene.render();
      }
    };

    this.initCanvas(containerId);
    this.initEngine();
    this.initMenuScene(); // Scene 생성
    this.setupGlobalInput(); // 입력 리스너 초기화 (1회)

    // 메뉴 화면 렌더링 시작
    this.engine.runRenderLoop(this.renderFunction);
  }

  private initCanvas(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'renderCanvas';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    container.insertBefore(this.canvas, container.firstChild);
  }

  private initEngine(): void {
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.engine.loadingScreen = new CustomLoadingScreen();

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  private async initMenuScene(): Promise<void> {
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

    // PBR 환경 맵 로드 (Studio Lighting)
    const envTexture = CubeTexture.CreateFromPrefilteredData(studioEnvUrl, this.scene);
    this.scene.environmentTexture = envTexture;
    this.scene.environmentIntensity = 1.0; // 조명 강도 조절

    // 기본 조명 (HemisphericLight) - 보조광으로 유지하되 강도 조절
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.5; // PBR 환경광이 주가 되므로 강도 낮춤
    light.groundColor = new Color3(0.2, 0.2, 0.25);

    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.5), this.scene);
    sun.position = new Vector3(20, 40, 20);
    sun.intensity = 0.8;

    // 그림자 생성
    this.shadowGenerator = new ShadowGenerator(2048, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    // 레벨 로더 초기화
    const levelLoader = new LevelLoader(this.scene, this.shadowGenerator);
    await levelLoader.loadLevelData(LEVELS['training_ground']);

    // 메뉴 카메라 (배경 조망용)
    const menuCamera = new UniversalCamera('menuCamera', new Vector3(0, 2, -10), this.scene);
    menuCamera.setTarget(Vector3.Zero());
    menuCamera.attachControl(this.canvas, true);
  }

  private async initGameSession(levelData: LevelData): Promise<void> {
    // 하이브리드 아키텍처 시스템 초기화
    this.playerPawn = new PlayerPawn(this.scene);

    // 플레이어 스폰 위치 설정
    if (levelData.playerSpawn) {
      this.playerPawn.position = Vector3.FromArray(levelData.playerSpawn);
    } else {
      this.playerPawn.position = new Vector3(0, 1.75, -5);
    }

    this.playerController = new PlayerController('player1', this.canvas);
    this.playerController.possess(this.playerPawn);

    // HUD 초기화
    this.hud = new HUD();

    // 적 스폰 시스템 (TargetSpawner는 사격장용, EnemyManager는Combat용)
    // 두 맵의 성격에 따라 다르게 로드할 수도 있지만, 일단 둘 다 존재 가능하게 처리
    this.spawner = new TargetSpawnerComponent(this.scene, this.shadowGenerator);
    this.spawner.spawnInitialTargets();

    // 적 AI 매니저 (데이터가 있을 경우에만)
    if (levelData.enemySpawns && levelData.enemySpawns.length > 0) {
      this.enemyManager = new EnemyManager(this.scene, this.shadowGenerator);
      this.enemyManager.spawnEnemies(levelData.enemySpawns, this.playerPawn);
    }

    // 무기 시스템
    const combatComp = new CombatComponent(this.playerPawn, this.scene);
    this.playerPawn.addComponent(combatComp);

    // 체력 구독 (사망 판정)
    if (this.healthUnsub) this.healthUnsub();
    this.healthUnsub = playerHealthStore.subscribe((health) => {
      if (health <= 0 && this.isRunning && !this.isPaused) {
        this.gameOver();
      }
    });

    // 아이템 드랍 시스템 초기화
    PickupManager.getInstance().initialize(this.scene, this.playerPawn);

    const combat = this.playerPawn.getComponent(CombatComponent);
    if (combat instanceof CombatComponent) {
      combat.onWeaponChanged(() => {
        this.syncInventoryStore();
      });
    }

    // 인벤토리 UI 초기화
    this.inventoryUI = new InventoryUI({
      onEquipWeapon: (slot, weaponId) => {
        const state = inventoryStore.get();
        const slots = [...state.weaponSlots];
        slots[slot] = weaponId;
        inventoryStore.setKey('weaponSlots', slots);

        if (weaponId) {
          const combat = this.playerPawn?.getComponent(CombatComponent);
          if (combat instanceof CombatComponent) {
            combat.equipWeapon(weaponId);
          }
        }
      },
      onUseItem: (itemId) => {
        if (!this.playerPawn) return;
        const state = inventoryStore.get();
        const bag = [...state.bagItems];
        const itemIndex = bag.findIndex((i) => i.id === itemId);

        if (itemIndex !== -1) {
          const item = bag[itemIndex];
          if (item.id === 'health') {
            this.playerPawn.addHealth(30);
          } else if (item.id === 'ammo') {
            this.playerPawn.addAmmo(50);
          }

          if (item.count > 1) {
            const newItem = { ...item, count: item.count - 1 };
            bag[itemIndex] = newItem;
          } else {
            bag.splice(itemIndex, 1);
          }
          inventoryStore.setKey('bagItems', bag);
        }
      },
      onDropItem: (itemId) => {
        if (!this.playerPawn) return;
        const state = inventoryStore.get();
        const bag = [...state.bagItems];
        const itemIndex = bag.findIndex((i) => i.id === itemId);

        if (itemIndex !== -1) {
          const item = bag[itemIndex];
          // 소모 처리 (버리기)
          if (item.count > 1) {
            bag[itemIndex] = { ...item, count: item.count - 1 };
          } else {
            bag.splice(itemIndex, 1);
          }
          inventoryStore.setKey('bagItems', bag);

          // 월드에 드랍 (플레이어 위치)
          const dropPos = this.playerPawn.mesh.position.clone();
          dropPos.y += 0.5; // 약간 위에서 떨어뜨림
          PickupManager.getInstance().spawnPickup(dropPos, item.id as any);
          console.log(`[Game] Dropped ${item.id} in world`);
        }
      },
    });
    this.syncInventoryStore();
  }

  private gameOver(): void {
    this.isPaused = true;
    gameStateStore.set('GAME_OVER');

    // 게임 오버 UI 표시 (간단히 pause-overlay 재활용하거나 새로 만듦)
    const pauseTitle = document.querySelector('#pause-overlay h1');
    if (pauseTitle) pauseTitle.textContent = 'GAME OVER';

    const resumeBtn = document.getElementById('resume-button');
    if (resumeBtn) resumeBtn.style.display = 'none'; // 사망 시 계속하기 불가

    document.getElementById('pause-overlay')!.style.display = 'flex';
    document.exitPointerLock();
  }

  private async initPreloading(): Promise<void> {
    try {
      await AssetLoader.getInstance().load(this.scene);
    } catch (e) {
      console.error('Failed to load assets:', e);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    // 1. 선택된 맵 URL 가져오기
    const select = document.getElementById('map-select') as HTMLSelectElement;
    // 1. 선택된 맵 URL 가져오기

    const levelKey = select ? select.value : 'training_ground';

    // 2. 현재 메뉴 씬 폐기
    this.engine.stopRenderLoop(this.renderFunction);
    this.scene.dispose();

    // 3. 게임 씬 생성 및 기본 설정 (initScene 로직 일부 재사용)
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

    // 조명/그림자 설정 (공통 함수로 뺄 수 있음)
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.4;
    ambient.groundColor = new Color3(0.2, 0.2, 0.25);
    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.5), this.scene);
    sun.position = new Vector3(20, 40, 20);
    sun.intensity = 0.8;
    this.shadowGenerator = new ShadowGenerator(2048, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    // 4. 레벨 로드 (로딩 화면 표시)
    this.engine.displayLoadingUI();

    const levelLoader = new LevelLoader(this.scene, this.shadowGenerator);

    const data = LEVELS[levelKey];
    if (data) {
      await levelLoader.loadLevelData(data);
    } else {
      console.error(`Level data for key "${levelKey}" not found.`);
    }

    // LevelData is already loaded (it's JSON), but we need to pass it to initGameSession.
    // However, LevelLoader.loadLevelData returns void.
    // We can just use the 'data' variable.
    const levelData = data;

    // 4.5 필수 에셋 프리로딩 (게임 세션 시작 전 완료 필수)
    await this.initPreloading();
    this.engine.hideLoadingUI();

    // 5. 게임 세션 초기화
    if (levelData) {
      await this.initGameSession(levelData);
    } else {
      console.error('Failed to load level data');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    gameStateStore.set('PLAYING');

    // 오버레이 숨기기
    document.getElementById('start-overlay')!.style.display = 'none';
    document.getElementById('hud')!.style.display = 'block';

    // 전체 화면 요청
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    // 포인터 잠금
    this.canvas.requestPointerLock();

    // 실험적 기능: 키보드 잠금 (Supported in Chrome/Edge Desktop)
    if ('keyboard' in navigator && 'lock' in (navigator as any).keyboard) {
      // Ctrl+W, Ctrl+S, Ctrl+D 등을 브라우저가 아닌 게임이 처리하도록 잠금 요청
      (navigator as any).keyboard
        .lock(['ControlLeft', 'ControlRight', 'KeyW', 'KeyS', 'KeyD', 'KeyA', 'Escape', 'KeyI'])
        .catch(() => {
          // Keyboard lock failed silently
        });
    }

    // 디버그 레이어/아이템 스폰/인벤토리 리스너는 생성자의 setupGlobalInput에서 통합 관리됨

    // 디버그 레이어 (인스펙터) 및 인벤토리 토글 로직은 setupGlobalInput에서 처리

    // 오디오 엔진 언락
    const audioEngine = AssetLoader.getInstance().getAudioEngine();
    if (audioEngine) {
      audioEngine.resumeAsync().catch((e) => console.error('Failed to resume AudioEngine:', e));
    }

    // 렌더 루프 시작 (이미 돌아가고 있을 수 있으므로 확인 필요하지 않음, Engine handles it)
    // 단, renderFunction 내에서 scene.activeCamera 확인하므로 안전함.
    // 하지만 만약 기존에 메뉴 렌더링 중이었다면 중복 실행 방지 필요?
    // Engine.runRenderLoop는 콜백을 추가함. 여러번 호출하면 여러번 실행됨.
    // 따라서 기존 루프를 멈추고 다시 시작하거나, 하나의 루프에서 상태를 분기해야 함.
    // 현재 구조: this.renderFunction은 하나임.
    // 생성자에서 initMenuScene 호출 -> 루프 시작 안 함?
    // 아, 생성자에는 runRenderLoop 호출이 없음.
    // 기존 코드: start()에서 runRenderLoop 호출.
    // 그러면 메뉴 화면은 렌더링 안 되고 있었나? (확인 필요)
    // 생성자 수정 필요: 메뉴 화면도 렌더링 되어야 함.

    this.engine.stopRenderLoop(this.renderFunction); // 혹시 모를 중복 방지
    this.engine.runRenderLoop(this.renderFunction);
  }

  private setupGlobalInput(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning) return;

      // 1. 디버그용 아이템 스폰 (H: Health, J: Ammo)
      if (!this.isPaused) {
        if (e.code === 'KeyH') {
          PickupManager.getInstance().spawnPickup(this.playerPawn!.mesh.position, 'health');
          console.log('[DEBUG] Spawned Health Pickup');
        }
        if (e.code === 'KeyJ') {
          PickupManager.getInstance().spawnPickup(this.playerPawn!.mesh.position, 'ammo');
          console.log('[DEBUG] Spawned Ammo Pickup');
        }
      }

      // 2. 인스펙터 토글 (I)
      if (e.code === 'KeyI' && !e.repeat) {
        if (this.scene.debugLayer.isVisible()) {
          this.scene.debugLayer.hide();
          if (!this.isPaused) this.canvas.requestPointerLock();
        } else {
          this.scene.debugLayer.show();
          document.exitPointerLock();
        }
      }

      // 3. 인벤토리 토글 (Tab)
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.inventoryUI && this.playerController) {
          const isOpen = this.inventoryUI.toggle();
          this.playerController.setInputBlocked(isOpen);

          if (!isOpen && !this.isPaused) {
            this.canvas.requestPointerLock();
          }
        }
      }
    });
  }

  private syncInventoryStore(): void {
    if (!this.playerPawn) return;
    const combat = this.playerPawn.getComponent(CombatComponent);
    if (!(combat instanceof CombatComponent)) return;

    const weapons = combat.getWeapons();
    const slots: (string | null)[] = [null, null, null, null];

    // 1. 슬롯 초기화 (처음 4개 무기 배치)
    weapons.forEach((w, i) => {
      if (i < 4) slots[i] = w.name;
    });

    // 2. 모든 보유 무기를 가방(Storage)에도 표시하여 재배치 가능하게 함
    const weaponBagItems = weapons.map((w) => ({
      id: w.name,
      name: w.name,
      type: 'weapon' as const,
      count: 1,
    }));

    // 기존 소모품 유지 (있다면)
    const currentState = inventoryStore.get();
    const consumables = currentState.bagItems.filter((i) => i.type === 'consumable');

    inventoryStore.set({
      ...currentState,
      weaponSlots: slots,
      bagItems: [...weaponBagItems, ...consumables],
    });
  }

  private update(deltaTime: number): void {
    TickManager.getInstance().tick(deltaTime);
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused) return;

    this.isPaused = true;
    gameStateStore.set('PAUSED');
    document.getElementById('pause-overlay')!.style.display = 'flex';
    document.exitPointerLock();
  }

  public resume(): void {
    if (!this.isPaused) return;

    this.isPaused = false;
    gameStateStore.set('PLAYING');
    document.getElementById('pause-overlay')!.style.display = 'none';
    this.canvas.requestPointerLock();
  }

  public togglePause(): void {
    if (!this.isRunning) return;

    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  public quitToMenu(): void {
    this.isPaused = false;
    this.isRunning = false;

    // UI 정리
    document.getElementById('pause-overlay')!.style.display = 'none';
    document.getElementById('hud')!.style.display = 'none';
    document.getElementById('start-overlay')!.style.display = 'flex';

    // 포인터 잠금 해제
    document.exitPointerLock();

    // 렌더링 중지 (일시적)
    this.engine.stopRenderLoop(this.renderFunction);

    // 게임 세션 정리
    if (this.playerController) {
      this.playerController.dispose();
      this.playerController = null;
    }
    if (this.playerPawn) {
      this.playerPawn.dispose();
      this.playerPawn = null;
    }
    if (this.hud) {
      this.hud.dispose();
      this.hud = null;
    }
    if (this.spawner) {
      this.spawner.dispose();
      this.spawner = null;
    }

    if (this.enemyManager) {
      this.enemyManager.dispose();
      this.enemyManager = null;
    }

    // 싱글톤 상태 초기화
    TickManager.getInstance().clear();
    TargetRegistry.getInstance().clear();
    PickupManager.getInstance().clear();
    AssetLoader.getInstance().clear(); // 추가: 씬이 바뀔 때 에셋 캐시도 정리하여 다음 게임에서 정상 로드되도록 함.

    if (this.healthUnsub) {
      this.healthUnsub();
      this.healthUnsub = null;
    }

    // UI 복구
    const pauseTitle = document.querySelector('#pause-overlay h1');
    if (pauseTitle) pauseTitle.textContent = 'PAUSED';
    const resumeBtn = document.getElementById('resume-button');
    if (resumeBtn) resumeBtn.style.display = 'block';

    // 씬 폐기 (Bullet holes, decals 등 청소)
    this.scene.dispose();

    // 메뉴 씬 재초기화 (배경 복구)
    this.initMenuScene();

    // 렌더 루프 재시작 (메뉴 화면 렌더링)
    this.engine.runRenderLoop(this.renderFunction);
  }
}
