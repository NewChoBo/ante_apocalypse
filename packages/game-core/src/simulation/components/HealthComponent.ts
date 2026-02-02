import { IPawnComponent, IPawn, DamageEvent, DeathEvent, HealthChangeEvent } from '@ante/common';
import { Observable } from '@babylonjs/core';
import { Logger } from '@ante/common';

const logger = new Logger('HealthComponent');

/**
 * HealthComponent - Manages pawn health, damage, and death
 *
 * This component replaces the health management logic that was
 * previously embedded in BasePawn through inheritance.
 *
 * Features:
 * - Health tracking with max health
 * - Damage application with modifiers
 * - Death detection and notification
 * - Health regeneration (optional)
 * - Event-based communication
 */
export class HealthComponent implements IPawnComponent {
  public readonly componentId: string;
  public readonly componentType = 'HealthComponent';
  public isActive = true;

  // Health state
  private _health: number;
  private _maxHealth: number;
  private _isDead = false;

  // Optional regeneration
  private regenerateRate: number;
  private regenerateDelay: number;
  private timeSinceDamage = 0;
  private canRegenerate = false;

  // Owner reference
  private owner: IPawn | null = null;

  // Events
  public readonly onDamageTaken = new Observable<DamageEvent>();
  public readonly onHealthChanged = new Observable<HealthChangeEvent>();
  public readonly onDeath = new Observable<DeathEvent>();

  constructor(config: {
    maxHealth: number;
    initialHealth?: number;
    regenerateRate?: number;
    regenerateDelay?: number;
    componentId?: string;
  }) {
    this.componentId = config.componentId ?? `health_${Math.random().toString(36).substr(2, 9)}`;
    this._maxHealth = config.maxHealth;
    this._health = config.initialHealth ?? config.maxHealth;
    this.regenerateRate = config.regenerateRate ?? 0;
    this.regenerateDelay = config.regenerateDelay ?? 5;
  }

  // ============================================
  // IPawnComponent Implementation
  // ============================================

  public onAttach(pawn: IPawn): void {
    this.owner = pawn;
    logger.debug(`HealthComponent attached to pawn ${pawn.id}`);
  }

  public update(deltaTime: number): void {
    if (!this.isActive || this._isDead) return;

    // Handle regeneration
    if (this.regenerateRate > 0 && this.canRegenerate) {
      this.timeSinceDamage += deltaTime;
      if (this.timeSinceDamage >= this.regenerateDelay) {
        this.regenerate(deltaTime);
      }
    }
  }

  public onDetach(): void {
    this.owner = null;
    this.onDamageTaken.clear();
    this.onHealthChanged.clear();
    this.onDeath.clear();
  }

  public dispose(): void {
    this.onDetach();
  }

  // ============================================
  // Health Management
  // ============================================

  public get health(): number {
    return this._health;
  }

  public get maxHealth(): number {
    return this._maxHealth;
  }

  public get isDead(): boolean {
    return this._isDead;
  }

  public get healthPercent(): number {
    return this._health / this._maxHealth;
  }

  /**
   * Apply damage to this pawn
   */
  public takeDamage(
    amount: number,
    attackerId?: string,
    part?: string,
    hitPoint?: { x: number; y: number; z: number }
  ): void {
    if (!this.isActive || this._isDead) return;

    const oldHealth = this._health;
    this._health = Math.max(0, this._health - amount);
    this.timeSinceDamage = 0;
    this.canRegenerate = false;

    // Notify damage taken
    this.onDamageTaken.notifyObservers({
      pawnId: this.owner?.id ?? 'unknown',
      amount,
      attackerId,
      part,
      hitPoint,
      remainingHealth: this._health,
    });

    // Notify health change
    if (oldHealth !== this._health) {
      this.onHealthChanged.notifyObservers({
        pawnId: this.owner?.id ?? 'unknown',
        oldHealth,
        newHealth: this._health,
        maxHealth: this._maxHealth,
      });
    }

    // Check for death
    if (this._health <= 0 && !this._isDead) {
      this.die(attackerId);
    }

    logger.debug(`Damage: ${amount}, Health: ${this._health}/${this._maxHealth}`);
  }

  /**
   * Heal the pawn
   */
  public heal(amount: number): void {
    if (!this.isActive || this._isDead) return;

    const oldHealth = this._health;
    this._health = Math.min(this._maxHealth, this._health + amount);

    if (oldHealth !== this._health) {
      this.onHealthChanged.notifyObservers({
        pawnId: this.owner?.id ?? 'unknown',
        oldHealth,
        newHealth: this._health,
        maxHealth: this._maxHealth,
      });
    }
  }

  /**
   * Set health directly (for initialization or sync)
   */
  public setHealth(health: number): void {
    const oldHealth = this._health;
    this._health = Math.max(0, Math.min(this._maxHealth, health));

    if (oldHealth !== this._health) {
      this.onHealthChanged.notifyObservers({
        pawnId: this.owner?.id ?? 'unknown',
        oldHealth,
        newHealth: this._health,
        maxHealth: this._maxHealth,
      });
    }

    if (this._health <= 0 && !this._isDead) {
      this.die();
    }
  }

  /**
   * Kill the pawn
   */
  public die(killerId?: string): void {
    if (this._isDead) return;

    this._isDead = true;
    this._health = 0;

    this.onDeath.notifyObservers({
      pawnId: this.owner?.id ?? 'unknown',
      killerId,
      position: this.owner?.position ?? { x: 0, y: 0, z: 0 },
    });

    logger.debug(`Pawn died${killerId ? ` (killer: ${killerId})` : ''}`);
  }

  /**
   * Revive the pawn (for respawn systems)
   */
  public revive(health?: number): void {
    this._isDead = false;
    this._health = health ?? this._maxHealth;
    this.timeSinceDamage = 0;
    this.canRegenerate = true;

    logger.debug(`Pawn revived with ${this._health} health`);
  }

  // ============================================
  // Private Methods
  // ============================================

  private regenerate(deltaTime: number): void {
    if (this._health >= this._maxHealth) return;

    const regenAmount = this.regenerateRate * deltaTime;
    this.heal(regenAmount);
  }
}
