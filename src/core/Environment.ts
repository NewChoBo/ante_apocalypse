import * as THREE from 'three';
import { Target } from '../entities/Target';
import { StaticEntity } from '../entities/types/StaticEntity';

export class Environment {
  private scene: THREE.Scene;
  private targets: Target[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createGround();
    this.createLights();
    this.createTargets();
  }

  private createGround(): void {
    // Grass
    const grassGeo = new THREE.PlaneGeometry(100, 100);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d5e1e });
    const grass = new StaticEntity(this.scene, grassGeo, grassMat);
    grass.mesh.rotation.x = -Math.PI / 2;
    grass.mesh.receiveShadow = true;

    // Grid
    const grid = new THREE.GridHelper(100, 50, 0x000000, 0x000000);
    (grid.material as THREE.Material).opacity = 0.2;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  private createLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
  }

  private createTargets(): void {
    const targetConfigs = [
      { x: 0, z: -10, id: 1 },
      { x: -5, z: -15, id: 2 },
      { x: 5, z: -15, id: 3 },
      { x: -10, z: -20, id: 4 },
      { x: 10, z: -20, id: 5 },
      { x: 0, z: -25, id: 6 },
      { x: -15, z: -30, id: 7 },
      { x: 15, z: -30, id: 8 },
      { x: 0, z: -40, id: 9 },
    ];

    targetConfigs.forEach(cfg => {
      const target = new Target(this.scene, cfg.x, 0.75, cfg.z, cfg.id);
      this.targets.push(target);
    });
  }

  public getTargets(): Target[] {
    return this.targets;
  }
}
