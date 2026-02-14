import { describe, expect, it } from 'vitest';
import { MeshBuilder, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { HitRegistrationSystem } from './HitRegistrationSystem.js';

describe('HitRegistrationSystem', () => {
  it('classifies overlapping head hitbox as head with head-priority raycast', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);

    const targetId = 'enemy_test';
    const root = MeshBuilder.CreateBox('enemyRoot', { width: 0.5, height: 2, depth: 0.5 }, scene);
    root.setPivotPoint(new Vector3(0, -1, 0));
    root.position.set(0, 0, 0);
    root.isPickable = true;
    root.metadata = { id: targetId, bodyPart: 'body' };

    const head = MeshBuilder.CreateBox('headBox', { size: 0.25 }, scene);
    head.parent = root;
    head.position.set(0, 1.75, 0);
    head.isPickable = true;
    head.metadata = { id: targetId, bodyPart: 'head' };

    const result = HitRegistrationSystem.validateHit(
      scene,
      targetId,
      new Vector3(0, 1.75, -5),
      new Vector3(0, 0, 1),
      root
    );

    expect(result.isValid).toBe(true);
    expect(result.part).toBe('head');
    expect(result.method).toBe('strict');

    scene.dispose();
    engine.dispose();
  });
});

