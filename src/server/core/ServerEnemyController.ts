import { IServerNetwork } from '../interfaces/IServerNetwork';
import { EventCode, EnemySpawnData, EnemyUpdateData } from '../../shared/protocol/NetworkProtocol';
import { SimpleVector3 } from '../../shared/math/Vector';

interface ServerEnemy {
  id: string;
  type: string;
  position: SimpleVector3;
  rotation: { x: number; y: number; z: number };
  health: number;
  targetId?: string; // Player ID being chased
  state: 'IDLE' | 'CHASE' | 'ATTACK';
  isMoving: boolean;
}

export class ServerEnemyController {
  private network: IServerNetwork;
  private enemies: Map<string, ServerEnemy> = new Map();

  // Config
  private readonly SPAWN_INTERVAL = 5000; // 5 seconds
  private lastSpawnTime = 0;
  private readonly MOVEMENT_SPEED = 3.5; // Units per second
  private readonly AGGRO_RANGE = 20;
  private readonly ATTACK_RANGE = 1.5;

  // Spawn Points (Simple fixed points for now - TODO: Injected from LevelData)
  private readonly SPAWN_POINTS: SimpleVector3[] = [
    { x: 10, y: 0, z: 10 },
    { x: -10, y: 0, z: 10 },
    { x: 10, y: 0, z: -10 },
    { x: -10, y: 0, z: -10 },
  ];

  constructor(network: IServerNetwork) {
    this.network = network;
  }

  public tick(deltaTime: number, playerPositions: Map<string, SimpleVector3>): EnemyUpdateData[] {
    const now = Date.now();
    const changedEnemies: EnemyUpdateData[] = [];

    // 1. Spawning Logic
    if (now - this.lastSpawnTime > this.SPAWN_INTERVAL) {
      if (this.enemies.size < 10) {
        // Max 10 enemies for basic test
        this.spawnEnemy();
        this.lastSpawnTime = now;
      }
    }

    // 2. AI Logic
    this.enemies.forEach((enemy) => {
      // Find nearest player
      let nearestDistSq = Infinity;
      let nearestId: string | undefined;
      let targetPos: SimpleVector3 | undefined;

      playerPositions.forEach((pos, id) => {
        const dSq = this.distSq(enemy.position, pos);
        if (dSq < nearestDistSq) {
          nearestDistSq = dSq;
          nearestId = id;
          targetPos = pos;
        }
      });

      let hasChanged = false;

      // State Machine
      if (nearestId && targetPos && nearestDistSq < this.AGGRO_RANGE * this.AGGRO_RANGE) {
        enemy.targetId = nearestId;

        if (nearestDistSq > this.ATTACK_RANGE * this.ATTACK_RANGE) {
          // CHASE
          if (enemy.state !== 'CHASE') {
            enemy.state = 'CHASE';
            hasChanged = true;
          }
          if (!enemy.isMoving) {
            enemy.isMoving = true;
            hasChanged = true;
          }

          // Move towards
          const dx = targetPos.x - enemy.position.x;
          const dz = targetPos.z - enemy.position.z;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len > 0) {
            const moveStep = this.MOVEMENT_SPEED * deltaTime;
            enemy.position.x += (dx / len) * moveStep;
            enemy.position.z += (dz / len) * moveStep;

            // Simple rotation (look at target)
            enemy.rotation.y = Math.atan2(dx, dz);

            // Start moving = changed
            hasChanged = true;
          }
        } else {
          // ATTACK (Stop moving)
          if (enemy.state !== 'ATTACK') {
            enemy.state = 'ATTACK';
            hasChanged = true;
          }
          if (enemy.isMoving) {
            enemy.isMoving = false;
            hasChanged = true;
          }
        }
      } else {
        if (enemy.state !== 'IDLE') {
          enemy.state = 'IDLE';
          hasChanged = true;
        }
        if (enemy.isMoving) {
          enemy.isMoving = false;
          hasChanged = true;
        }
        enemy.targetId = undefined;
      }

      if (hasChanged) {
        changedEnemies.push({
          id: enemy.id,
          position: enemy.position,
          rotation: enemy.rotation,
          state: enemy.state,
          isMoving: enemy.isMoving,
          health: enemy.health,
        });
      }
    });

    return changedEnemies;
  }

  private spawnEnemy() {
    const id = `enemy_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const spawnPoint = this.SPAWN_POINTS[Math.floor(Math.random() * this.SPAWN_POINTS.length)];

    // Add randomness to spawn point
    const pos = {
      x: spawnPoint.x + (Math.random() - 0.5) * 4,
      y: 0,
      z: spawnPoint.z + (Math.random() - 0.5) * 4,
    };

    const newEnemy: ServerEnemy = {
      id,
      type: 'enemy_zombie', // or just 'enemy'
      position: pos,
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      state: 'IDLE',
      isMoving: false,
    };

    this.enemies.set(id, newEnemy);

    // Broadcast Spawn
    const payload = new EnemySpawnData(id, newEnemy.type, pos, undefined);
    this.network.sendEvent(EventCode.ON_ENEMY_SPAWN, payload, true, 'all');

    console.log(`[ServerEnemy] Spawned ${id} at ${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}`);
  }

  public getEnemyStates(): Map<string, ServerEnemy> {
    return this.enemies;
  }

  public removeEnemy(id: string) {
    if (this.enemies.has(id)) {
      this.enemies.delete(id);
    }
  }

  private distSq(v1: SimpleVector3, v2: SimpleVector3): number {
    return Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2) + Math.pow(v1.z - v2.z, 2);
  }
}
