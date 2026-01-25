import {
  Mesh,
  Scene,
  Vector3,
  StandardMaterial,
  Color3,
  MeshBuilder,
  DynamicTexture,
} from '@babylonjs/core';
import { BasePawn } from './BasePawn';

/**
 * 다른 네트워크 플레이어를 나타내는 Pawn.
 */
export class RemotePlayerPawn extends BasePawn {
  public mesh: Mesh;
  private targetPosition: Vector3;
  private targetRotation: Vector3;
  private lerpSpeed = 10;
  public id: string;
  public playerName: string;
  private nameLabel: Mesh | null = null;

  constructor(scene: Scene, id: string, name: string = 'Unknown') {
    super(scene);
    this.id = id;
    this.playerName = name;

    // 다른 플레이어는 보이게 설정
    this.mesh = MeshBuilder.CreateBox(
      'remotePlayer_' + id,
      { height: 1.75, width: 0.5, depth: 0.5 },
      scene
    );
    this.mesh.position.set(0, 0.875, 0);

    const mat = new StandardMaterial('remotePlayerMat_' + id, scene);
    mat.diffuseColor = new Color3(1, 0.5, 0); // Orange for players
    this.mesh.material = mat;

    this.createNameLabel(scene, name);

    // 히트박스 설정
    this.mesh.isPickable = true;
    this.mesh.metadata = {
      type: 'enemy', // 기존 시스템 재활용 (PVP에서는 플레이어가 적이 됨)
      pawn: this,
      bodyPart: 'body',
    };

    this.targetPosition = this.mesh.position.clone();
    this.targetRotation = this.mesh.rotation.clone();
  }

  private createNameLabel(scene: Scene, name: string): void {
    const plane = MeshBuilder.CreatePlane('nameLabel_' + this.id, { width: 2, height: 0.5 }, scene);
    plane.position.y = 1.2; // Head height
    plane.parent = this.mesh;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const texture = new DynamicTexture(
      'nameTex_' + this.id,
      { width: 512, height: 128 },
      scene,
      true
    );
    texture.hasAlpha = true;
    texture.drawText(name, null, null, 'bold 70px Rajdhani', 'white', 'transparent', true);

    const mat = new StandardMaterial('nameMat_' + this.id, scene);
    mat.diffuseTexture = texture;
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.backFaceCulling = false;
    plane.material = mat;
    this.nameLabel = plane;
  }

  public initialize(): void {
    // 초기화 로직
  }

  public updateNetworkState(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ): void {
    this.targetPosition.set(position.x, position.y, position.z);
    this.targetRotation.set(rotation.x, rotation.y, rotation.z);
  }

  public tick(deltaTime: number): void {
    // 위치 및 회전 보간 (Interpolation)
    this.mesh.position = Vector3.Lerp(
      this.mesh.position,
      this.targetPosition,
      deltaTime * this.lerpSpeed
    );

    // 회전 보간 (Euler angles 사용하므로 간단하게 처리, 추후 Quaternion 고려)
    this.mesh.rotation.x =
      this.mesh.rotation.x +
      (this.targetRotation.x - this.mesh.rotation.x) * deltaTime * this.lerpSpeed;
    this.mesh.rotation.y =
      this.mesh.rotation.y +
      (this.targetRotation.y - this.mesh.rotation.y) * deltaTime * this.lerpSpeed;
    this.mesh.rotation.z =
      this.mesh.rotation.z +
      (this.targetRotation.z - this.mesh.rotation.z) * deltaTime * this.lerpSpeed;

    this.updateComponents(deltaTime);
  }

  public takeDamage(amount: number): void {
    // 데미지 처리는 서버에서 관리하지만, 시각적 피드백 등을 여기서 처리할 수 있음
    console.log(`Remote player ${this.id} hit for ${amount} damage.`);
  }

  public dispose(): void {
    super.dispose();
  }
}
