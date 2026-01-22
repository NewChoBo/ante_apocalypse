import * as THREE from 'three';
import { SceneManager } from './managers/SceneManager';
import { InputManager } from './managers/InputManager';
import { UIManager } from './managers/UIManager';

export class Engine {
  public renderer: THREE.WebGLRenderer;
  public sceneManager: SceneManager;
  public inputManager: InputManager;
  public uiManager: UIManager;
  public clock: THREE.Clock;

  private onUpdate: (delta: number) => void;

  constructor(containerId: string, onUpdate: (delta: number) => void) {
    this.onUpdate = onUpdate;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.autoClear = false; // 수동 레이어 렌더링을 위해 false

    const container = document.getElementById(containerId);
    if (container) {
      container.insertBefore(this.renderer.domElement, container.firstChild);
    }

    this.sceneManager = new SceneManager();
    this.inputManager = InputManager.getInstance();
    this.uiManager = new UIManager();
    this.clock = new THREE.Clock();

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private onWindowResize(): void {
    this.sceneManager.onResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public start(): void {
    this.render();
  }

  private render(): void {
    requestAnimationFrame(this.render.bind(this));
    const delta = this.clock.getDelta();

    this.onUpdate(delta);

    const { renderer, sceneManager } = this;
    
    renderer.clear();

    // 1. 월드 렌더링
    renderer.render(sceneManager.worldScene, sceneManager.camera);

    // 2. 무기 레이어 렌더링 (depthBuffer 클리어하여 월드 오브젝트 위에 겹치게 함)
    renderer.clearDepth();
    renderer.render(sceneManager.viewModelScene, sceneManager.viewModelCamera);

    // 3. UI 레이어 렌더링
    renderer.render(sceneManager.uiScene, sceneManager.uiCamera);
  }
}
