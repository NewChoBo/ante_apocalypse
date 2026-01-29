import { Scene, Vector3, Mesh, MeshBuilder, AbstractMesh, Ray } from '@babylonjs/core';

export enum HitboxPart {
  HEAD = 'head',
  BODY = 'body',
  LEG = 'leg',
}

export interface HitboxConfig {
  part: HitboxPart;
  radius: number;
  height?: number;
  offset: Vector3;
}

export const HITBOX_DEFINITIONS: HitboxConfig[] = [
  {
    part: HitboxPart.HEAD,
    radius: 0.12, // Head is roughly 24cm diameter
    offset: new Vector3(0, 0, 0),
  },
  {
    part: HitboxPart.BODY,
    radius: 0.25, // Chest/Stomach
    height: 0.7,
    offset: new Vector3(0, -0.4, 0),
  },
  {
    part: HitboxPart.LEG,
    radius: 0.22,
    height: 0.8,
    offset: new Vector3(0, -1.1, 0),
  },
];

export interface HitboxGroup {
  id: string;
  root: AbstractMesh;
  parts: Map<HitboxPart, Mesh>;
}

/**
 * 전역 히트박스 관리 시스템 (Game-Core)
 * 클라이언트와 서버에서 동일한 히트박스 구조와 판정 로직을 보장합니다.
 */
export class HitboxSystem {
  private static instance: HitboxSystem;
  private hitboxGroups: Map<string, HitboxGroup> = new Map();

  private constructor() {}

  public static getInstance(): HitboxSystem {
    if (!HitboxSystem.instance) {
      HitboxSystem.instance = new HitboxSystem();
    }
    return HitboxSystem.instance;
  }

  /**
   * 새로운 히트박스 그룹을 생성합니다. (3개 분할: 머리, 몸통, 다리)
   */
  public createHitboxGroup(id: string, scene: Scene, parent?: AbstractMesh): HitboxGroup {
    const root = new Mesh(`hitbox_root_${id}`, scene);
    if (parent) root.parent = parent;

    const parts = new Map<HitboxPart, Mesh>();

    HITBOX_DEFINITIONS.forEach((config) => {
      let mesh: Mesh;
      if (config.part === HitboxPart.HEAD) {
        mesh = MeshBuilder.CreateSphere(
          `hitbox_${config.part}_${id}`,
          { diameter: config.radius * 2 },
          scene
        );
      } else {
        mesh = MeshBuilder.CreateCapsule(
          `hitbox_${config.part}_${id}`,
          { radius: config.radius, height: config.height! },
          scene
        );
      }

      mesh.position = config.offset.clone();
      mesh.parent = root;
      mesh.isVisible = false; // 기본적으로 투명 (디버그 시 켤 수 있음)
      mesh.isPickable = true;

      // 메타데이터 설정 (판정 시 사용)
      mesh.metadata = {
        type: 'hitbox',
        targetId: id,
        bodyPart: config.part,
      };

      parts.set(config.part, mesh);
    });

    const group: HitboxGroup = { id, root, parts };
    this.hitboxGroups.set(id, group);
    return group;
  }

  public getHitboxGroup(id: string): HitboxGroup | undefined {
    return this.hitboxGroups.get(id);
  }

  public removeHitboxGroup(id: string): void {
    const group = this.hitboxGroups.get(id);
    if (group) {
      group.root.dispose();
      this.hitboxGroups.delete(id);
    }
  }

  /**
   * 레이캐스트 판정 (서버/클라이언트 공용)
   */
  public pickWithRay(ray: Ray, scene: Scene): any {
    return scene.pickWithRay(ray, (mesh) => {
      return mesh.metadata?.type === 'hitbox';
    });
  }
}
