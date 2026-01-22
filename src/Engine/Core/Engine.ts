import * as THREE from 'three';
import { SceneManager } from '../Scene/SceneManager';
import { InputManager } from '../Input/InputManager';

export class Engine {
  public renderer: THREE.WebGLRenderer;
  public sceneManager: SceneManager;
  public inputManager: InputManager;
  public clock: THREE.Clock;

  private onUpdate: (delta: number) => void;

  constructor(containerId: string, onUpdate: (delta: number) => void) {
    this.onUpdate = onUpdate;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.autoClear = false;

    const container = document.getElementById(containerId);
    if (container) {
      container.insertBefore(this.renderer.domElement, container.firstChild);
    }

    this.sceneManager = new SceneManager();
    this.inputManager = InputManager.getInstance();
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
    renderer.render(sceneManager.worldScene, sceneManager.camera);
    renderer.clearDepth();
    renderer.render(sceneManager.viewModelScene, sceneManager.viewModelCamera);
    renderer.render(sceneManager.uiScene, sceneManager.uiCamera);
  }
}
