import { scoreStore, ammoStore, playerHealthStore } from '../core/store/GameStore.ts';
import { GameObservables } from '../core/events/GameObservables.ts';
import { Observer } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock, Rectangle, Control } from '@babylonjs/gui';
import { UIManager } from './UIManager';

export class HUD {
  private ui: AdvancedDynamicTexture;

  // UI Controls
  private scoreText!: TextBlock;
  private currentAmmoText!: TextBlock;
  private totalAmmoText!: TextBlock;
  private healthBar!: Rectangle;
  private healthValueText!: TextBlock;
  private damageOverlay!: Rectangle;
  private crosshair!: Rectangle;

  private scoreContainer!: Rectangle;
  private ammoContainer!: Rectangle;
  private healthContainer!: Rectangle;

  private curAmmoUnsub: (() => void) | null = null;
  private scoreUnsub: (() => void) | null = null;
  private healthUnsub: (() => void) | null = null;
  private weaponFireObserver: Observer<any> | null = null;
  private expandTimeout: any;
  private previousHealth: number = 100;

  constructor() {
    this.ui = UIManager.getInstance().getTexture();
    this.createHUD();
    this.setupSubscriptions();
  }

  private createHUD(): void {
    // 1. Damage Overlay (Full Screen Red Flash)
    this.damageOverlay = new Rectangle('damageOverlay');
    this.damageOverlay.width = 1;
    this.damageOverlay.height = 1;
    this.damageOverlay.background = 'red';
    this.damageOverlay.alpha = 0;
    this.damageOverlay.thickness = 0;
    this.damageOverlay.isHitTestVisible = false;
    this.ui.addControl(this.damageOverlay);

    // 2. Score (Top Left)
    this.scoreContainer = new Rectangle('scoreContainer');
    this.scoreContainer.width = '200px';
    this.scoreContainer.height = '50px';
    this.scoreContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.scoreContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.scoreContainer.top = '20px';
    this.scoreContainer.left = '20px';
    this.scoreContainer.thickness = 0;
    this.ui.addControl(this.scoreContainer);

    const scoreLabel = new TextBlock('scoreLabel', 'SCORE: ');
    scoreLabel.color = 'white';
    scoreLabel.fontSize = 24;
    scoreLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    scoreLabel.width = '80px';
    this.scoreContainer.addControl(scoreLabel);

    this.scoreText = new TextBlock('scoreValue', '0');
    this.scoreText.color = '#4caf50'; // Green
    this.scoreText.fontSize = 24;
    this.scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.scoreText.left = '90px';
    this.scoreContainer.addControl(this.scoreText);

    // 3. Ammo (Bottom Right)
    this.ammoContainer = new Rectangle('ammoContainer');
    this.ammoContainer.width = '200px';
    this.ammoContainer.height = '80px';
    this.ammoContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.ammoContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.ammoContainer.top = '-20px';
    this.ammoContainer.left = '-20px';
    this.ammoContainer.thickness = 0;
    this.ui.addControl(this.ammoContainer);

    this.currentAmmoText = new TextBlock('currentAmmo', '30');
    this.currentAmmoText.color = 'white';
    this.currentAmmoText.fontSize = 48;
    this.currentAmmoText.fontWeight = 'bold';
    this.currentAmmoText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.currentAmmoText.top = '-20px';
    this.ammoContainer.addControl(this.currentAmmoText);

    this.totalAmmoText = new TextBlock('totalAmmo', '/ 90');
    this.totalAmmoText.color = '#aaaaaa';
    this.totalAmmoText.fontSize = 24;
    this.totalAmmoText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.totalAmmoText.top = '20px';
    this.ammoContainer.addControl(this.totalAmmoText);

    // 4. Health Bar (Bottom Left)
    this.healthContainer = new Rectangle('healthContainer');
    this.healthContainer.width = '300px';
    this.healthContainer.height = '40px';
    this.healthContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.healthContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.healthContainer.top = '-30px';
    this.healthContainer.left = '30px';
    this.healthContainer.color = 'white'; // Border color
    this.healthContainer.thickness = 2;
    this.healthContainer.background = 'rgba(0, 0, 0, 0.5)';
    this.ui.addControl(this.healthContainer);

    this.healthBar = new Rectangle('healthBar');
    this.healthBar.width = 1; // 100%
    this.healthBar.height = 1;
    this.healthBar.background = '#4caf50';
    this.healthBar.thickness = 0;
    this.healthBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.healthContainer.addControl(this.healthBar);

    this.healthValueText = new TextBlock('healthValue', '100');
    this.healthValueText.color = 'white';
    this.healthValueText.fontSize = 20;
    this.healthValueText.fontWeight = 'bold';
    this.healthContainer.addControl(this.healthValueText);

    // 5. Crosshair (Center)
    this.crosshair = new Rectangle('crosshair');
    this.crosshair.width = '8px';
    this.crosshair.height = '8px';
    this.crosshair.background = 'white';
    this.crosshair.thickness = 0;
    this.crosshair.cornerRadius = 4;
    this.crosshair.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.crosshair.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.crosshair.isHitTestVisible = false;
    this.ui.addControl(this.crosshair);
  }

  private showDamageFlash(): void {
    // Simple flash animation
    let alpha = 0.5;
    this.damageOverlay.alpha = alpha;

    // Animate fade out
    const fadeInterval = setInterval(() => {
      alpha -= 0.05;
      if (alpha <= 0) {
        this.damageOverlay.alpha = 0;
        clearInterval(fadeInterval);
      } else {
        this.damageOverlay.alpha = alpha;
      }
    }, 50);
  }

  private setupSubscriptions(): void {
    // Ammo
    this.curAmmoUnsub = ammoStore.subscribe((state) => {
      this.currentAmmoText.text = state.current.toString();
      this.totalAmmoText.text = `/ ${state.reserve}`;

      const ammoContainer = this.currentAmmoText.parent as Control;
      if (ammoContainer) {
        ammoContainer.isVisible = state.showAmmo;
      }
    });

    // Score
    this.scoreUnsub = scoreStore.subscribe((score) => {
      this.scoreText.text = score.toString();
    });

    // Health
    this.healthUnsub = playerHealthStore.subscribe((health) => {
      if (health < this.previousHealth) {
        this.showDamageFlash();
      }
      this.previousHealth = health;

      const healthPercent = Math.max(0, health / 100);
      this.healthBar.width = healthPercent; // Babylon GUI Rectangle width is 0..1 when not string
      this.healthValueText.text = Math.ceil(health).toString();

      // Health Color
      if (health < 30) {
        this.healthBar.background = '#f44336'; // Red
      } else if (health < 60) {
        this.healthBar.background = '#ffeb3b'; // Yellow
      } else {
        this.healthBar.background = '#4caf50'; // Green
      }
    });

    // Crosshair Recoil
    this.weaponFireObserver = GameObservables.weaponFire.add(() => {
      this.crosshair.width = '20px';
      this.crosshair.height = '20px';

      if (this.expandTimeout) clearTimeout(this.expandTimeout);
      this.expandTimeout = setTimeout(() => {
        this.crosshair.width = '8px';
        this.crosshair.height = '8px';
      }, 150);
    });
  }

  public dispose(): void {
    if (this.curAmmoUnsub) {
      this.curAmmoUnsub();
      this.curAmmoUnsub = null;
    }
    if (this.scoreUnsub) {
      this.scoreUnsub();
      this.scoreUnsub = null;
    }
    if (this.healthUnsub) {
      this.healthUnsub();
      this.healthUnsub = null;
    }
    if (this.weaponFireObserver) {
      GameObservables.weaponFire.remove(this.weaponFireObserver);
      this.weaponFireObserver = null;
    }
    if (this.expandTimeout) {
      clearTimeout(this.expandTimeout);
    }

    // Dispose GUI controls
    this.damageOverlay.dispose();
    this.scoreContainer.dispose();
    this.ammoContainer.dispose();
    this.healthContainer.dispose();
    this.crosshair.dispose();
  }
}
