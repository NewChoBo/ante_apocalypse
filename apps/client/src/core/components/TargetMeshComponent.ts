import {
  Vector3,
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  ShadowGenerator,
  AbstractMesh,
} from '@babylonjs/core';
import { BaseComponent } from '@ante/game-core';
import { TargetPawn } from '../TargetPawn';

export interface TargetMeshConfig {
  targetType: string;
  shadowGenerator: ShadowGenerator;
}

/**
 * 타겟의 외형을 생성하고 관리하는 컴포넌트
 * Humanoid, Moving, Static 등 타입에 따라 다른 메쉬를 생성합니다.
 */
export class TargetMeshComponent extends BaseComponent {
  private targetOwner: TargetPawn;
  private config: TargetMeshConfig;
  private _visualMesh: AbstractMesh | null = null;

  constructor(owner: TargetPawn, scene: Scene, config: TargetMeshConfig) {
    super(owner, scene);
    this.targetOwner = owner;
    this.config = config;

    this.createMesh();
  }

  public getVisualMesh(): AbstractMesh | null {
    return this._visualMesh;
  }

  private createMesh(): void {
    const type = this.config.targetType;

    if (type === 'humanoid' || type === 'humanoid_target') {
      this.createHumanoidMesh();
    } else if (type === 'moving' || type === 'moving_target') {
      this.createMovingTargetMesh();
    } else {
      // Default: Static Box
      this.createStaticTargetMesh();
    }
  }

  private createHumanoidMesh(): void {
    // 1. 몸통 (Body) - Pivot
    const body = MeshBuilder.CreateBox(
      `${this.targetOwner.id}_body`,
      { width: 0.6, height: 1.2, depth: 0.3 },
      this.scene
    );
    // Pawn Root는 발 밑(혹은 중심)에 위치. Body는 위로 띄움
    body.position = new Vector3(0, 0.6, 0);
    body.parent = this.targetOwner.mesh;
    body.isPickable = true;

    const bodyMat = new StandardMaterial(`${this.targetOwner.id}BodyMat`, this.scene);
    bodyMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
    body.material = bodyMat;

    // 2. 머리 (Head) relative to Body
    const head = MeshBuilder.CreateSphere(
      `${this.targetOwner.id}_head`,
      { diameter: 0.4 },
      this.scene
    );
    head.parent = body;
    head.position = new Vector3(0, 0.8, 0); // 몸통 위에 위치
    head.isPickable = true;

    const headMat = new StandardMaterial(`${this.targetOwner.id}HeadMat`, this.scene);
    headMat.diffuseColor = new Color3(0.9, 0.7, 0.6);
    head.material = headMat;

    // 그림자
    this.config.shadowGenerator.addShadowCaster(body);
    this.config.shadowGenerator.addShadowCaster(head);

    // 메타데이터 (Hit System용)
    body.metadata = { type: 'target', pawn: this.targetOwner, bodyPart: 'body' };
    head.metadata = { type: 'target', pawn: this.targetOwner, bodyPart: 'head' };

    // Damage Profile Override for Humanoid
    this.targetOwner.damageProfile = {
      multipliers: { head: 4.0, body: 1.0 },
      defaultMultiplier: 1.0,
    };
    // Health Override
    this.targetOwner.maxHealth = 150;
    this.targetOwner.health = 150;

    this._visualMesh = body;
  }

  private createMovingTargetMesh(): void {
    const target = MeshBuilder.CreateCylinder(
      `${this.targetOwner.id}_moving`,
      { height: 0.1, diameter: 1.5 },
      this.scene
    );
    target.rotation.x = Math.PI / 2;
    target.position = new Vector3(0, 0, 0);
    target.parent = this.targetOwner.mesh;
    target.isPickable = true;

    const material = new StandardMaterial(`${this.targetOwner.id}Mat`, this.scene);
    material.diffuseColor = new Color3(0.2, 0.6, 0.9);
    material.emissiveColor = new Color3(0.05, 0.15, 0.25);
    target.material = material;

    this.config.shadowGenerator.addShadowCaster(target);
    target.metadata = { type: 'target', pawn: this.targetOwner, bodyPart: 'body' };

    // 중앙 원
    const center = MeshBuilder.CreateCylinder(
      `${this.targetOwner.id}_center`,
      { height: 0.12, diameter: 0.4 },
      this.scene
    );
    center.rotation.x = Math.PI / 2;
    center.parent = target;
    center.position = new Vector3(0, 0.02, 0);
    center.isPickable = false;

    const centerMat = new StandardMaterial(`${this.targetOwner.id}CenterMat`, this.scene);
    centerMat.diffuseColor = new Color3(1, 0.9, 0.2);
    centerMat.emissiveColor = new Color3(0.3, 0.27, 0.06);
    center.material = centerMat;

    // Damage Profile
    this.targetOwner.damageProfile = {
      multipliers: { head: 3.0, body: 1.0 }, // Center hit treated as 'head' if we had precise collision
      defaultMultiplier: 1.0,
    };
    // Health Override
    this.targetOwner.maxHealth = 100;
    this.targetOwner.health = 100;

    this._visualMesh = target;
  }

  private createStaticTargetMesh(): void {
    // Logic for Static Target (Box? Cylinder?)
    // Assuming similar to moving but static
    const target = MeshBuilder.CreateCylinder(
      `${this.targetOwner.id}_static`,
      { height: 0.1, diameter: 1.2 },
      this.scene
    );
    target.rotation.x = Math.PI / 2;
    target.parent = this.targetOwner.mesh;
    target.isPickable = true;

    const material = new StandardMaterial(`${this.targetOwner.id}StaticMat`, this.scene);
    material.diffuseColor = new Color3(0.8, 0.2, 0.2);
    target.material = material;

    target.metadata = { type: 'target', pawn: this.targetOwner, bodyPart: 'body' };
    this.config.shadowGenerator.addShadowCaster(target);

    this._visualMesh = target;
  }

  public update(_deltaTime: number): void {}

  public override dispose(): void {
    if (this._visualMesh) {
      this._visualMesh.dispose();
    }
    super.dispose();
  }
}
