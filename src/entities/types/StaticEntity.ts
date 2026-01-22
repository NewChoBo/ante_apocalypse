import * as THREE from 'three';
import { BaseEntity } from '../BaseEntity';

export class StaticEntity extends BaseEntity {
  constructor(scene: THREE.Scene, geometry: THREE.BufferGeometry, material: THREE.Material) {
    super(scene);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.mesh.add(mesh);
  }

  public update(_delta: number): void {
    // Static objects typically don't update every frame
  }
}
