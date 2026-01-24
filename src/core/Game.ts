import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Color3,
  Color4,
  UniversalCamera,
} from '@babylonjs/core';
import { PlayerController } from './controllers/PlayerController';
import { PlayerPawn } from './PlayerPawn';
import { TargetSpawnerComponent } from './components/TargetSpawnerComponent';
import { TargetRegistry } from './systems/TargetRegistry';
import { HUD } from '../ui/HUD';
import { gameStateStore } from './store/GameStore.ts';
import { CombatComponent } from './components/CombatComponent';
import { TickManager } from './TickManager';
import { AssetLoader } from './AssetLoader';
import '@babylonjs/inspector'; // 인스펙터 기능 활성화
import { LevelLoader, LevelData } from './systems/LevelLoader';
import { EnemyManager } from './systems/EnemyManager';
import { CustomLoadingScreen } from '../ui/CustomLoadingScreen';

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

    // 조명 설정
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.4;
    ambient.groundColor = new Color3(0.2, 0.2, 0.25);

    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.5), this.scene);
    sun.position = new Vector3(20, 40, 20);
    sun.intensity = 0.8;

    // 그림자 생성
    this.shadowGenerator = new ShadowGenerator(2048, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    // 레벨 로더 초기화
    const levelLoader = new LevelLoader(this.scene, this.shadowGenerator);
    await levelLoader.loadLevel('/levels/training_ground.json');

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
      this.enemyManager = new EnemyManager(this.scene);
      this.enemyManager.spawnEnemies(levelData.enemySpawns, this.playerPawn);
    }

    // 무기 시스템
    const combatComp = new CombatComponent(this.playerPawn, this.scene);
    this.playerPawn.addComponent(combatComp);

    // 에셋 프리로딩
    await this.initPreloading();
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
    const levelUrl = select ? select.value : '/levels/training_ground.json';

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
    const levelData = await levelLoader.loadLevel(levelUrl);
    this.engine.hideLoadingUI();

    // 5. 게임 세션 초기화 (지연 로딩)
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

    // 디버그 레이어 (인스펙터) 토글
    window.addEventListener('keydown', (e) => {
      // Shift+I 또는 그냥 I (게임 중에는 채팅이 없으므로 단순 키 할당)
      if (e.code === 'KeyI' && !e.repeat) {
        if (this.scene.debugLayer.isVisible()) {
          this.scene.debugLayer.hide();
          // 인스펙터 닫으면 포인터 잠금 재요청 (게임으로 복귀)
          if (!this.isPaused) this.canvas.requestPointerLock();
        } else {
          this.scene.debugLayer.show();
          // 인스펙터 열면 포인터 잠금 해제 (마우스 사용)
          document.exitPointerLock();
        }
      }
    });

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

    // 일단 start에서는 호출하지 않고, 생성자에서 한 번만 호출하도록 변경하는 것이 좋음.
    // 하지만 안전하게 가기 위해: 기존 루프 사용.
    this.engine.stopRenderLoop(this.renderFunction); // 혹시 모를 중복 방지
    this.engine.runRenderLoop(this.renderFunction);
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

    // 씬 폐기 (Bullet holes, decals 등 청소)
    this.scene.dispose();

    // 메뉴 씬 재초기화 (배경 복구)
    this.initMenuScene();

    // 렌더 루프 재시작 (메뉴 화면 렌더링)
    this.engine.runRenderLoop(this.renderFunction);
  }
}
