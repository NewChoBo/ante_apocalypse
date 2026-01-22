import * as THREE from 'three';
import '../style.css';
import { FirstPersonController } from './FirstPersonController';
import { Environment } from './Environment';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controller: FirstPersonController | null = null;
  private _environment: Environment | null = null;
  private clock: THREE.Clock;
  private isRunning = false;
  private score = 0;
  private raycaster = new THREE.Raycaster();
  private currentAmmo = 30;
  private maxAmmo = 30;
  private totalAmmo = 90;
  private isReloading = false;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = document.getElementById('game-container');
    if (container) {
      container.insertBefore(this.renderer.domElement, container.firstChild);
    }

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.7, 5);
    this.scene.add(this.camera);

    this.clock = new THREE.Clock();

    window.addEventListener('resize', this.onWindowResize.bind(this));

    const startButton = document.getElementById('start-button');
    if (startButton) {
      startButton.addEventListener('click', () => this.startGame());
    }

    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private startGame(): void {
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }

    const hud = document.getElementById('hud');
    if (hud) {
      hud.style.display = 'block';
    }

    this.renderer.domElement.requestPointerLock();

    this._environment = new Environment(this.scene);
    this.controller = new FirstPersonController(this.camera, this.renderer.domElement);

    this.updateAmmoDisplay();
    this.isRunning = true;
  }

  public start(): void {
    this.animate();
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();

    if (this.isRunning && this.controller) {
      this.controller.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.isRunning || document.pointerLockElement !== this.renderer.domElement) return;
    if (event.button === 0) {
      this.shoot();
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isRunning) return;
    if (event.code === 'KeyR') {
      this.reload();
    }
  }

  private shoot(): void {
    if (!this._environment || this.isReloading || this.currentAmmo <= 0 || !this.controller) return;

    this.currentAmmo--;
    this.updateAmmoDisplay();

    // 총기 반동 애니메이션
    this.controller.getWeapon().shoot();

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const targets = this._environment.getTargets();
    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const targetGroup = hitObject.parent;

      if (targetGroup && targetGroup.userData.isTarget) {
        const points = hitObject.userData.points || 0;
        this.score += points;
        this.updateScoreDisplay();

        targetGroup.visible = false;
      }
    }
  }

  private reload(): void {
    if (this.isReloading || this.currentAmmo >= this.maxAmmo || this.totalAmmo <= 0 || !this.controller) return;

    this.isReloading = true;
    
    // 총기 재장전 애니메이션
    this.controller.getWeapon().reload();

    const reloadMsg = document.getElementById('reload-message');
    if (reloadMsg) reloadMsg.style.display = 'block';

    setTimeout(() => {
      const ammoNeeded = this.maxAmmo - this.currentAmmo;
      const ammoToFill = Math.min(ammoNeeded, this.totalAmmo);

      this.currentAmmo += ammoToFill;
      this.totalAmmo -= ammoToFill;
      this.isReloading = false;

      if (reloadMsg) reloadMsg.style.display = 'none';
      this.updateAmmoDisplay();
    }, 1500);
  }

  private updateScoreDisplay(): void {
    const scoreEl = document.getElementById('score');
    if (scoreEl) {
      scoreEl.textContent = this.score.toString();
    }
  }

  private updateAmmoDisplay(): void {
    const currentEl = document.getElementById('current-ammo');
    const totalEl = document.getElementById('total-ammo');
    if (currentEl) currentEl.textContent = this.currentAmmo.toString();
    if (totalEl) totalEl.textContent = this.totalAmmo.toString();
  }

  public get environment(): Environment | null {
    return this._environment;
  }
}
