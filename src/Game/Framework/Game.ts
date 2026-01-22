import '../../style.css';
import { Engine } from '../../Engine/Core/Engine';
import { Environment } from '../../Actors/Props/Environment';
import { Player } from '../../Actors/Player/Player';
import { CombatSystem } from '../../Systems/Combat/CombatSystem';
import { HUD } from '../UI/HUD';

export class Game {
  private engine: Engine;
  private player: Player | null = null;
  private environment: Environment | null = null;
  private combatSystem: CombatSystem;
  private hud: HUD;

  private score = 0;
  private hasStarted = false;
  private isPaused = false;

  constructor() {
    this.engine = new Engine('game-container', this.update.bind(this));
    this.combatSystem = new CombatSystem();
    this.hud = new HUD();
    this.initEvents();
  }

  private initEvents(): void {
    const startButton = document.getElementById('start-button');
    if (startButton) {
      startButton.addEventListener('click', () => this.startGame());
    }

    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));

    const resumeButton = document.getElementById('resume-button');
    if (resumeButton) {
      resumeButton.addEventListener('click', () => this.resumeGame());
    }
  }

  private startGame(): void {
    if (this.hasStarted) return;

    this.engine.sceneManager.onResize();
    const dom = this.engine.renderer.domElement;
    dom.requestPointerLock();

    this.environment = new Environment(this.engine.sceneManager.worldScene);
    this.player = new Player(this.engine.sceneManager);

    this.hud.setGameStarted(true);
    this.updateAmmoUI();
    
    this.hasStarted = true;
  }

  private resumeGame(): void {
    if (this.hasStarted) {
      this.engine.renderer.domElement.requestPointerLock();
    }
  }

  private onPointerLockChange(): void {
    const isLocked = document.pointerLockElement === this.engine.renderer.domElement;
    
    if (isLocked) {
      this.hud.setPaused(false);
      this.isPaused = false;
    } else {
      if (this.hasStarted) {
        this.hud.setPaused(true);
        this.isPaused = true;
      }
    }
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.hasStarted || this.isPaused || document.pointerLockElement !== this.engine.renderer.domElement) return;

    if (event.button === 0) {
      this.handleShoot();
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.hasStarted) return;

    if (event.code === 'KeyR') {
      this.handleReload();
    }

    if (event.code === 'Escape' && this.isPaused) {
      this.resumeGame();
    }
  }

  private handleShoot(): void {
    if (!this.player || !this.environment) return;

    if (this.player.shoot()) {
      this.updateAmmoUI();
      
      const hitTarget = this.combatSystem.checkHit(this.player.getCamera(), this.environment.getTargets());
      if (hitTarget) {
        this.score += 10;
        this.hud.updateScore(this.score);
        hitTarget.hit();
      }
    }
  }

  private handleReload(): void {
    if (!this.player) return;

    this.hud.setReloading(true);
    this.player.reload(() => {
      this.hud.setReloading(false);
      this.updateAmmoUI();
    });
  }

  private updateAmmoUI(): void {
    if (!this.player) return;
    const weapon = this.player.getWeapon();
    this.hud.updateAmmo(weapon.currentAmmo, weapon.totalAmmo);
  }

  private update(delta: number): void {
    if (this.hasStarted && !this.isPaused && this.player) {
      this.player.update(delta);
    }
  }

  public start(): void {
    this.engine.start();
  }
}
