import * as THREE from 'three';
import { Weapon } from './Weapon';

export class FirstPersonController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  // 이동 상태
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;

  // 점프
  private isJumping = false;
  private velocityY = 0;
  private gravity = -20;
  private jumpForce = 8;
  private groundLevel = 1.7; // 눈 높이

  // 속도 설정
  private moveSpeed = 5.0;

  // 마우스 감도
  private mouseSensitivity = 0.002;

  // 회전 값
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // 포인터 잠금 상태
  private isLocked = false;

  private weapon: Weapon;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.camera.position.y = this.groundLevel;
    this.weapon = new Weapon(this.camera);
    this.initEventListeners();
  }

  private initEventListeners(): void {
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'Space':
        if (!this.isJumping) {
          this.isJumping = true;
          this.velocityY = this.jumpForce;
        }
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'KeyD':
        this.moveRight = false;
        break;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= movementX * this.mouseSensitivity;
    this.euler.x -= movementY * this.mouseSensitivity;

    // 상하 시점 제한 (90도)
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  }

  private onPointerLockChange(): void {
    this.isLocked = document.pointerLockElement === this.domElement;
  }

  public update(delta: number): void {
    // 점프/중력 처리
    if (this.isJumping || this.camera.position.y > this.groundLevel) {
      this.velocityY += this.gravity * delta;
      this.camera.position.y += this.velocityY * delta;

      // 착지
      if (this.camera.position.y <= this.groundLevel) {
        this.camera.position.y = this.groundLevel;
        this.velocityY = 0;
        this.isJumping = false;
      }
    }

    // 이동 방향 계산
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    if (this.moveForward) direction.add(forward);
    if (this.moveBackward) direction.sub(forward);
    if (this.moveRight) direction.add(right);
    if (this.moveLeft) direction.sub(right);

    if (direction.length() > 0) {
      direction.normalize();
      this.camera.position.addScaledVector(direction, this.moveSpeed * delta);
    }

    // 무기 애니메이션 업데이트
    const isMoving = direction.length() > 0 && !this.isJumping;
    this.weapon.update(delta, isMoving);
  }

  public getWeapon(): Weapon {
    return this.weapon;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public isPointerLocked(): boolean {
    return this.isLocked;
  }
}
