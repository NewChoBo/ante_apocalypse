import * as THREE from 'three';
import { BaseEntity } from '../Base/BaseEntity';

export class Target extends BaseEntity {
  public id: number;

  constructor(scene: THREE.Scene, x: number, y: number, z: number, id: number) {
    super(scene);
    this.id = id;
    this.createTarget(x, y, z);
  }

  private createTarget(x: number, y: number, z: number): void {
    const group = this.mesh as THREE.Group;
    group.userData.id = this.id;
    group.userData.isTarget = true;
    group.userData.entity = this;

    const standGeometry = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 8);
    const standMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const stand = new THREE.Mesh(standGeometry, standMaterial);
    stand.position.y = -0.75;
    group.add(stand);

    const rings = [
      { radius: 0.8, color: 0xffffff },
      { radius: 0.6, color: 0x000000 },
      { radius: 0.45, color: 0x0066ff },
      { radius: 0.3, color: 0xff0000 },
      { radius: 0.15, color: 0xffff00 },
    ];

    rings.forEach((ring, i) => {
      const geometry = new THREE.CircleGeometry(ring.radius, 32);
      const material = new THREE.MeshStandardMaterial({
        color: ring.color,
        side: THREE.DoubleSide,
      });
      const circle = new THREE.Mesh(geometry, material);
      circle.position.z = 0.001 * i;
      circle.userData.points = (rings.length - i) * 2;
      group.add(circle);
    });

    group.position.set(x, y, z);
  }

  public update(_delta: number): void {}

  public hit(): void {
    this.mesh.visible = false;
  }
}
