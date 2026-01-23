import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  ShadowGenerator,
} from '@babylonjs/core';

export class ShootingRange {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
  }

  public create(): void {
    this.createGround();
    this.createWalls();
    this.createTargetLanes();
    this.createDecorations();
  }

  private createGround(): void {
    const ground = MeshBuilder.CreateGround('ground', { width: 40, height: 60 }, this.scene);
    ground.position.y = 0;
    ground.receiveShadows = true;
    ground.checkCollisions = true;

    const material = new StandardMaterial('groundMat', this.scene);
    material.diffuseColor = new Color3(0.2, 0.2, 0.22);
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    ground.material = material;
  }

  private createWalls(): void {
    const wallMaterial = new StandardMaterial('wallMat', this.scene);
    wallMaterial.diffuseColor = new Color3(0.3, 0.3, 0.32);

    // 뒷벽
    const backWall = MeshBuilder.CreateBox(
      'backWall',
      { width: 40, height: 6, depth: 0.5 },
      this.scene
    );
    backWall.position = new Vector3(0, 3, 25);
    backWall.material = wallMaterial;
    backWall.receiveShadows = true;
    backWall.checkCollisions = true;
    this.shadowGenerator.addShadowCaster(backWall);

    // 좌우 벽
    const leftWall = MeshBuilder.CreateBox(
      'leftWall',
      { width: 0.5, height: 6, depth: 60 },
      this.scene
    );
    leftWall.position = new Vector3(-20, 3, 0);
    leftWall.material = wallMaterial;
    leftWall.receiveShadows = true;
    leftWall.checkCollisions = true;

    const rightWall = leftWall.clone('rightWall');
    rightWall.position.x = 20;
  }

  private createTargetLanes(): void {
    const laneMaterial = new StandardMaterial('laneMat', this.scene);
    laneMaterial.diffuseColor = new Color3(0.15, 0.15, 0.18);

    // 5개의 사격 레인
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 7;

      // 레인 바닥 (구분선)
      const lane = MeshBuilder.CreateBox(
        `lane${i}`,
        { width: 6, height: 0.02, depth: 50 },
        this.scene
      );
      lane.position = new Vector3(x, 0.01, 5);
      lane.material = laneMaterial;

      // 레인 번호 표시용 기둥
      const post = MeshBuilder.CreateCylinder(`post${i}`, { height: 2, diameter: 0.2 }, this.scene);
      post.position = new Vector3(x - 2.5, 1, -5);
      post.checkCollisions = true;

      const postMat = new StandardMaterial(`postMat${i}`, this.scene);
      postMat.diffuseColor = new Color3(0.8, 0.6, 0.2);
      post.material = postMat;
      this.shadowGenerator.addShadowCaster(post);
    }
  }

  private createDecorations(): void {
    // 조명 기둥들
    const lightPostMaterial = new StandardMaterial('lightPostMat', this.scene);
    lightPostMaterial.diffuseColor = new Color3(0.4, 0.4, 0.45);
    lightPostMaterial.emissiveColor = new Color3(0.1, 0.1, 0.12);

    const positions = [
      new Vector3(-15, 0, -10),
      new Vector3(15, 0, -10),
      new Vector3(-15, 0, 15),
      new Vector3(15, 0, 15),
    ];

    positions.forEach((pos, i) => {
      const pole = MeshBuilder.CreateCylinder(
        `lightPole${i}`,
        { height: 4, diameter: 0.3 },
        this.scene
      );
      pole.position = pos.add(new Vector3(0, 2, 0));
      pole.material = lightPostMaterial;
      this.shadowGenerator.addShadowCaster(pole);

      // 조명 헤드
      const head = MeshBuilder.CreateBox(
        `lightHead${i}`,
        { width: 1, height: 0.3, depth: 0.5 },
        this.scene
      );
      head.position = pos.add(new Vector3(0, 4.2, 0));

      const headMat = new StandardMaterial(`headMat${i}`, this.scene);
      headMat.diffuseColor = new Color3(0.9, 0.9, 0.8);
      headMat.emissiveColor = new Color3(0.5, 0.5, 0.4);
      head.material = headMat;
    });

    // 탄약 상자들
    const boxMaterial = new StandardMaterial('ammoBoxMat', this.scene);
    boxMaterial.diffuseColor = new Color3(0.3, 0.4, 0.3);

    for (let i = 0; i < 3; i++) {
      const box = MeshBuilder.CreateBox(
        `ammoBox${i}`,
        { width: 0.8, height: 0.5, depth: 0.5 },
        this.scene
      );
      box.position = new Vector3(-18 + i * 1.2, 0.25, -8);
      box.material = boxMaterial;
      this.shadowGenerator.addShadowCaster(box);
    }
  }
}
