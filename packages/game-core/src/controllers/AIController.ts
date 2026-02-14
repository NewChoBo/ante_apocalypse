import { Vector3 } from '@babylonjs/core';
import { IEnemyPawn } from '../types/IEnemyPawn.js';
import { INetworkAuthority } from '../network/INetworkAuthority.js';
import { EventCode } from '@ante/common';
import { WeaponRegistry } from '../weapons/WeaponRegistry.js';

export class AIController {
  private updateRate = 0.1; // 10 times per sec
  private timeSinceLastUpdate = 0;

  private target: { position: Vector3 } | null = null;
  private detectionRange = 30;
  private attackRange = 15;
  private meleeAttackRange = 2.5;
  private attackCooldown = 1.0;
  private lastAttackTime = 0;
  private moveSpeed = 3.0;

  private enemyPawn: IEnemyPawn | null = null;
  private authority: INetworkAuthority;

  constructor(
    public readonly id: string,
    pawn: IEnemyPawn,
    target: { position: Vector3 },
    authority: INetworkAuthority
  ) {
    this.enemyPawn = pawn;
    this.target = target;
    this.authority = authority;

    // [Authoritative Stats Sync]
    if (WeaponRegistry['Enemy_Melee']) {
      // this.damage = WeaponRegistry['Enemy_Melee'].damage;
    }
  }

  public tick(deltaTime: number): void {
    if (!this.enemyPawn || !this.target || this.enemyPawn.isDead) {
      if (this.enemyPawn?.isDead) {
        this.dispose();
      }
      return;
    }

    this.timeSinceLastUpdate += deltaTime;

    // AI decisions don't need to run every frame
    if (this.timeSinceLastUpdate >= this.updateRate) {
      this.think();
      this.timeSinceLastUpdate = 0;
    }

    // Movement happens every frame for smoothness
    this.act(deltaTime);
  }

  private think(): void {
    // State machine logic here
  }

  private act(deltaTime: number): void {
    const enemy = this.enemyPawn;
    const target = this.target;
    if (!enemy || !target) return;

    const diff = target.position.subtract(enemy.position);
    const distance = diff.length();

    // 1. Look at player (Y-axis only)
    const lookAtPos = target.position.clone();
    lookAtPos.y = enemy.position.y;
    enemy.lookAt(lookAtPos);

    // 2. Chase
    let isMoving = false;
    if (distance < this.detectionRange && distance > 2) {
      // 2m distance to stop
      const direction = diff.normalize();
      enemy.move(direction, this.moveSpeed, deltaTime);
      isMoving = true;
    }
    enemy.isMoving = isMoving;

    // 3. Attack (Melee)
    const now = performance.now() / 1000;
    if (distance <= this.meleeAttackRange) {
      if (now - this.lastAttackTime >= this.attackCooldown) {
        // [Authoritative Attack]
        // 데미지 직접 적용 대신 서버에 사격(공격) 요청 전송
        const muzzlePos = enemy.position.add(new Vector3(0, 0.5, 0));
        const dir = target.position.subtract(muzzlePos).normalize();

        this.authority.sendEvent(
          EventCode.FIRE,
          {
            weaponId: 'Enemy_Melee',
            muzzleTransform: {
              position: { x: muzzlePos.x, y: muzzlePos.y, z: muzzlePos.z },
              direction: { x: dir.x, y: dir.y, z: dir.z },
            },
          },
          true
        ); // reliable

        this.lastAttackTime = now;
      }
    }

    // 4. Attack (Firearm Placeholder)
    if (distance < this.attackRange && distance > this.meleeAttackRange) {
      // enemy.fire();
    }
  }

  public dispose(): void {
    this.enemyPawn = null;
    this.target = null;
  }
}
