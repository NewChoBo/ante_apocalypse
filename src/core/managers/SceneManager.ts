import * as THREE from 'three';

export class SceneManager {
  public worldScene: THREE.Scene;
  public viewModelScene: THREE.Scene;
  public uiScene: THREE.Scene;
  
  public camera: THREE.PerspectiveCamera;
  public viewModelCamera: THREE.PerspectiveCamera;
  public uiCamera: THREE.OrthographicCamera;

  constructor() {
    this.worldScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.viewModelScene = new THREE.Scene();
    this.viewModelCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      10
    );
    this.viewModelScene.add(new THREE.AmbientLight(0xffffff, 1.0));

    this.uiScene = new THREE.Scene();
    this.uiCamera = new THREE.OrthographicCamera(
      -window.innerWidth / 2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      -window.innerHeight / 2,
      0,
      10
    );
  }

  public onResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.viewModelCamera.aspect = aspect;
    this.viewModelCamera.updateProjectionMatrix();
    this.uiCamera.left = -window.innerWidth / 2;
    this.uiCamera.right = window.innerWidth / 2;
    this.uiCamera.top = window.innerHeight / 2;
    this.uiCamera.bottom = -window.innerHeight / 2;
    this.uiCamera.updateProjectionMatrix();
  }
}
