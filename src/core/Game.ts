import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Color3,
  Color4,
} from '@babylonjs/core';
import { PlayerController } from './controllers/PlayerController';
import { PlayerPawn } from './PlayerPawn';
import { ShootingRange } from '../world/ShootingRange';
import { TargetManager } from '../targets/TargetManager';
import { HUD } from '../ui/HUD';
import { gameStateStore } from './store/GameStore.ts';
import { CombatComponent } from './components/CombatComponent';
import { TickManager } from './TickManager';

export class Game {
  private canvas!: HTMLCanvasElement;
  private engine!: Engine;
  private scene!: Scene;
  private shadowGenerator!: ShadowGenerator;

  private isRunning = false;
  private isPaused = false;

  constructor(containerId: string) {
    this.initCanvas(containerId);
    this.initEngine();
    this.initScene();
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

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  private initScene(): void {
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

    // 월드 생성
    const shootingRange = new ShootingRange(this.scene, this.shadowGenerator);
    shootingRange.create();

    // 하이브리드 아키텍처 시스템 초기화
    const playerPawn = new PlayerPawn(this.scene);
    const playerController = new PlayerController('player1', this.canvas);
    playerController.possess(playerPawn);

    // HUD를 다른 시스템보다 먼저 초기화하여 초기 이벤트를 수신할 수 있게 합니다.
    new HUD();

    // 타겟 매니저
    const targetManager = new TargetManager(this.scene, this.shadowGenerator);
    targetManager.spawnInitialTargets();

    // 무기 시스템 (이제 Pawn의 CombatComponent가 소유)
    const combatComp = new CombatComponent(playerPawn, this.scene, targetManager);
    playerPawn.addComponent(combatComp);
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    gameStateStore.set('PLAYING');

    // 오버레이 숨기기
    document.getElementById('start-overlay')!.style.display = 'none';
    document.getElementById('hud')!.style.display = 'block';

    // 포인터 잠금
    this.canvas.requestPointerLock();

    // 렌더 루프 시작
    this.engine.runRenderLoop(() => {
      if (!this.isPaused) {
        const deltaTime = this.engine.getDeltaTime() / 1000;
        this.update(deltaTime);
        this.scene.render();
      }
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
}
