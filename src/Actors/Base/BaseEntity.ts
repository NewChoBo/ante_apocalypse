import * as THREE from 'three';

export interface Entity {
  mesh: THREE.Object3D;
  update(delta: number): void;
  destroy(): void;
}

export abstract class BaseEntity implements Entity {
  public mesh: THREE.Object3D;
  protected scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.scene.add(this.mesh);
  }

  public abstract update(delta: number): void;

  public destroy(): void {
    this.scene.remove(this.mesh);
  }
}
