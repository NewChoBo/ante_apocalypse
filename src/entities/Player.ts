import * as THREE from 'three';
import { Pistol } from '../weapons/Pistol';
import { InputManager } from '../core/managers/InputManager';
import { SceneManager } from '../core/managers/SceneManager';

export class Player {
  private camera: THREE.PerspectiveCamera;
  private weapon: Pistol;
  private input: InputManager;
  private sceneManager: SceneManager;

  private velocityY = 0;
  private isJumping = false;
  private gravity = -20;
  private jumpForce = 8;
  private groundLevel = 1.7;
  private moveSpeed = 5.0;

  private mouseSensitivity = 0.002;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.camera = sceneManager.camera;
    this.input = InputManager.getInstance();
    
    this.weapon = new Pistol();
    this.sceneManager.viewModelScene.add(this.weapon.mesh);
    
    this.camera.position.set(0, this.groundLevel, 5);
    this.initEvents();
  }

  private initEvents(): void {
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  private onMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement !== document.body && !document.pointerLockElement) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= movementX * this.mouseSensitivity;
    this.euler.x -= movementY * this.mouseSensitivity;
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  public update(delta: number): void {
    this.handleMovement(delta);
    this.handleJump(delta);
    
    const moving = this.isMoving() && !this.isJumping;
    this.weapon.update(delta, moving);
  }

  private isMoving(): boolean {
    return (
      this.input.isKeyDown('KeyW') ||
      this.input.isKeyDown('KeyS') ||
      this.input.isKeyDown('KeyA') ||
      this.input.isKeyDown('KeyD')
    );
  }

  private handleMovement(delta: number): void {
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    if (this.input.isKeyDown('KeyW')) direction.add(forward);
    if (this.input.isKeyDown('KeyS')) direction.sub(forward);
    if (this.input.isKeyDown('KeyA')) direction.sub(right);
    if (this.input.isKeyDown('KeyD')) direction.add(right);

    if (direction.length() > 0) {
      direction.normalize();
      this.camera.position.addScaledVector(direction, this.moveSpeed * delta);
    }
  }

  private handleJump(delta: number): void {
    if (this.input.isKeyDown('Space') && !this.isJumping) {
      this.isJumping = true;
      this.velocityY = this.jumpForce;
    }

    if (this.isJumping || this.camera.position.y > this.groundLevel) {
      this.velocityY += this.gravity * delta;
      this.camera.position.y += this.velocityY * delta;

      if (this.camera.position.y <= this.groundLevel) {
        this.camera.position.y = this.groundLevel;
        this.velocityY = 0;
        this.isJumping = false;
      }
    }
  }

  public shoot(): boolean {
    return this.weapon.shoot();
  }

  public reload(onComplete: () => void): void {
    this.weapon.reload(onComplete);
  }

  public getWeapon(): Pistol {
    return this.weapon;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}
