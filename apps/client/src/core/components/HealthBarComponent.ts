import {
  Mesh,
  Scene,
  MeshBuilder,
  DynamicTexture,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import { BaseComponent } from './BaseComponent';

export type HealthBarStyle = 'enemy' | 'player';

/**
 * Reusable HealthBar component for Pawns.
 * Displays a billboard health bar above the parent mesh.
 */
export class HealthBarComponent extends BaseComponent {
  private plane: Mesh | null = null;
  private texture: DynamicTexture | null = null;
  private style: HealthBarStyle;
  private width: number;
  private height: number;
  private yOffset: number;

  constructor(
    owner: { mesh: Mesh },
    scene: Scene,
    options: {
      style?: HealthBarStyle;
      width?: number;
      height?: number;
      yOffset?: number;
    } = {}
  ) {
    super(owner as any, scene);
    this.style = options.style ?? 'player';
    this.width = options.width ?? 1.5;
    this.height = options.height ?? 0.2;
    this.yOffset = options.yOffset ?? 0.8;

    this.createHealthBar();
    this.updateHealth(100);
  }

  public setVisible(visible: boolean): void {
    if (this.plane) {
      this.plane.setEnabled(visible);
    }
  }

  private createHealthBar(): void {
    const id = Math.random().toString(36).substring(7);
    this.plane = MeshBuilder.CreatePlane(
      'healthBar_' + id,
      { width: this.width, height: this.height },
      this.scene
    );
    this.plane.position.y = this.yOffset;
    this.plane.parent = this.owner.mesh;
    this.plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

    this.texture = new DynamicTexture(
      'healthTex_' + id,
      { width: 300, height: 40 },
      this.scene,
      true
    );
    this.texture.hasAlpha = true;

    const mat = new StandardMaterial('healthMat_' + id, this.scene);
    mat.diffuseTexture = this.texture;
    mat.emissiveColor = Color3.White();
    mat.backFaceCulling = false;
    this.plane.material = mat;
  }

  public updateHealth(health: number): void {
    if (!this.texture) return;
    const ctx = this.texture.getContext();
    const width = 300;
    const height = 40;
    const healthPct = Math.max(0, health) / 100;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Health bar color based on style
    if (this.style === 'enemy') {
      ctx.fillStyle = healthPct > 0.5 ? '#ff0000' : '#880000';
    } else {
      ctx.fillStyle = healthPct > 0.5 ? '#00ff00' : healthPct > 0.2 ? '#ffff00' : '#ff0000';
    }
    ctx.fillRect(2, 2, (width - 4) * healthPct, height - 4);

    this.texture.update();
  }

  public update(_deltaTime: number): void {
    // No-op, updateHealth is called externally when health changes
  }

  public dispose(): void {
    if (this.plane) this.plane.dispose();
    if (this.texture) this.texture.dispose();
  }
}
