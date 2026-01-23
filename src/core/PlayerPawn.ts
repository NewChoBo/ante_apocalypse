import { Mesh, Vector3, Scene, UniversalCamera, Ray } from '@babylonjs/core';
import { BasePawn } from './BasePawn.ts';

/**
 * 1인칭 플레이어 캐릭터 실체 (Pawn).
 */
export class PlayerPawn extends BasePawn {
  public mesh: Mesh;
  public camera: UniversalCamera;

  private playerHeight = 1.8;
  private moveSpeed = 8;
  private sprintMultiplier = 1.6;
  private mouseSensitivity = 0.002;

  // 중력/상태 변수
  private velocityY = 0;
  private gravity = -25;
  private jumpForce = 9;
  private isGrounded = false;

  constructor(scene: Scene) {
    super(scene);

    // 단순한 히트박스 또는 투명 메쉬 (Pawn의 실체)
    this.mesh = Mesh.CreateBox('playerPawn', 0.5, scene);
    this.mesh.isVisible = false; // 1인칭에서는 자신의 몸이 안보이게 함
    this.mesh.position.set(0, this.playerHeight, -5);

    // 카메라 부착
    this.camera = new UniversalCamera('fpsCamera', Vector3.Zero(), scene);
    this.camera.parent = this.mesh;
    this.camera.minZ = 0.1;
    this.camera.fov = 1.2;
    this.camera.inputs.clear(); // Controller가 제어하므로 입력 해제
  }

  public initialize(scene: Scene): void {
    // 추가 초기화 로직
  }

  /** Controller로부터 입력을 받아 이동 처리 */
  public handleInput(keys: any, mouseDelta: any, deltaTime: number): void {
    // 1. 회전 처리 (카메라는 X축, 몸체는 Y축)
    this.mesh.rotation.y += mouseDelta.x * this.mouseSensitivity;
    this.camera.rotation.x += mouseDelta.y * this.mouseSensitivity;
    this.camera.rotation.x = Math.max(
      -Math.PI / 2 + 0.1,
      Math.min(Math.PI / 2 - 0.1, this.camera.rotation.x)
    );

    // 2. 이동 처리
    const speed = this.moveSpeed * (keys.sprint ? this.sprintMultiplier : 1);
    const forward = this.mesh.getDirection(Vector3.Forward());
    const right = this.mesh.getDirection(Vector3.Right());

    const moveDirection = Vector3.Zero();
    if (keys.forward) moveDirection.addInPlace(forward);
    if (keys.backward) moveDirection.subtractInPlace(forward);
    if (keys.right) moveDirection.addInPlace(right);
    if (keys.left) moveDirection.subtractInPlace(right);

    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      this.mesh.position.addInPlace(moveDirection.scale(speed * deltaTime));
    }

    // 3. 점프 시도
    if (this.isGrounded && keys.jump) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }
  }

  public update(deltaTime: number): void {
    this.updateGravity(deltaTime);
  }

  private updateGravity(deltaTime: number): void {
    this.checkGround();

    if (this.isGrounded) {
      this.velocityY = 0;
    } else {
      this.velocityY += this.gravity * deltaTime;
    }

    this.mesh.position.y += this.velocityY * deltaTime;

    // 최소 높이 안전장치
    if (this.mesh.position.y < this.playerHeight) {
      this.mesh.position.y = this.playerHeight;
      this.velocityY = 0;
      this.isGrounded = true;
    }
  }

  private checkGround(): void {
    const ray = new Ray(this.mesh.position, Vector3.Down(), this.playerHeight + 0.1);
    const pickInfo = this.scene.pickWithRay(ray, (m) => m.isPickable && m !== this.mesh);
    this.isGrounded = !!pickInfo?.hit;
  }
}
