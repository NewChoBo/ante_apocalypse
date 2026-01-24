import { BaseController } from './BaseController';
import { EnemyPawn } from '../EnemyPawn';
import { PlayerPawn } from '../PlayerPawn';

export class AIController extends BaseController {
  private updateRate = 0.1; // 10 times per sec
  private timeSinceLastUpdate = 0;
  private targetPlayer: PlayerPawn | null = null;
  private detectionRange = 30;
  private attackRange = 15;
  private meleeAttackRange = 2.5;
  private attackCooldown = 1.0;
  private lastAttackTime = 0;
  private damage = 10;
  private moveSpeed = 3.0;

  private enemyPawn: EnemyPawn | null = null;

  constructor(id: string, pawn: EnemyPawn, target: PlayerPawn) {
    super(id);
    this.possess(pawn);
    this.targetPlayer = target;
  }

  protected onPossess(pawn: any): void {
    if (pawn instanceof EnemyPawn) {
      this.enemyPawn = pawn;
    }
  }

  protected onUnpossess(_pawn: any): void {
    this.enemyPawn = null;
  }

  public tick(deltaTime: number): void {
    if (!this.enemyPawn || !this.targetPlayer) return;

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
    const target = this.targetPlayer;
    if (!enemy || !target) return;

    const diff = target.position.subtract(enemy.position);
    const distance = diff.length();

    // 1. Look at player (Y-axis only)
    const lookAtPos = target.position.clone();
    lookAtPos.y = enemy.position.y;
    enemy.lookAt(lookAtPos);

    // 2. Chase
    if (distance < this.detectionRange && distance > 2) {
      // 2m distance to stop
      const direction = diff.normalize();
      enemy.move(direction, this.moveSpeed, deltaTime);
    }

    // 3. Attack (Melee)
    const now = performance.now() / 1000;
    if (distance <= this.meleeAttackRange) {
      if (now - this.lastAttackTime >= this.attackCooldown) {
        target.takeDamage(this.damage);
        this.lastAttackTime = now;
      }
    }

    // 4. Attack (Firearm Placeholder)
    if (distance < this.attackRange && distance > this.meleeAttackRange) {
      // enemy.fire();
    }
  }

  public dispose(): void {
    // cleanup
  }
}
