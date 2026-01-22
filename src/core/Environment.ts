import * as THREE from 'three';

export class Environment {
  private scene: THREE.Scene;
  private targets: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createLighting();
    this.createGround();
    this.createTargets();
    this.createSkybox();
  }

  private createLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);
  }

  private createGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a7d44,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(200, 40, 0x444444, 0x666666);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }

  private createSkybox(): void {
    this.scene.background = new THREE.Color(0x87ceeb);
  }

  private createTargets(): void {
    const targetPositions = [
      { x: 0, z: -10 },
      { x: -5, z: -15 },
      { x: 5, z: -15 },
      { x: -10, z: -25 },
      { x: 0, z: -25 },
      { x: 10, z: -25 },
      { x: -15, z: -40 },
      { x: 0, z: -40 },
      { x: 15, z: -40 },
    ];

    targetPositions.forEach((pos, index) => {
      this.createTarget(pos.x, 1.5, pos.z, index);
    });
  }

  private createTarget(x: number, y: number, z: number, id: number): void {
    const group = new THREE.Group();
    group.userData.id = id;
    group.userData.isTarget = true;

    const standGeometry = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 8);
    const standMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const stand = new THREE.Mesh(standGeometry, standMaterial);
    stand.position.y = -0.75;
    stand.castShadow = true;
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
      circle.userData.isTarget = true;
      group.add(circle);
    });

    group.position.set(x, y, z);
    group.castShadow = true;
    this.scene.add(group);
    this.targets.push(group);
  }

  public getTargets(): THREE.Group[] {
    return this.targets;
  }
}
