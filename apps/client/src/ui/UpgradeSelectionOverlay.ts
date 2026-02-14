import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
} from '@babylonjs/gui';
import type { UpgradeOfferPayload } from '@ante/common';

export interface IUpgradeSelectionOverlay {
  showOffer(offer: UpgradeOfferPayload, onPick: (upgradeId: string) => void): void;
  setTimeRemaining(seconds: number): void;
  hide(): void;
  dispose(): void;
}

const RARITY_BORDER: Record<string, string> = {
  common: '#5ec8ff',
  rare: '#7ee67a',
  epic: '#ffbf47',
};

export class BabylonUpgradeSelectionOverlay implements IUpgradeSelectionOverlay {
  private readonly root: Rectangle;
  private readonly titleText: TextBlock;
  private readonly timerText: TextBlock;
  private readonly optionButtons: Button[] = [];

  constructor(private readonly ui: AdvancedDynamicTexture) {
    this.root = new Rectangle('upgrade_overlay_root');
    this.root.width = '560px';
    this.root.height = '360px';
    this.root.thickness = 2;
    this.root.color = '#39f4c8';
    this.root.background = 'rgba(6, 14, 20, 0.92)';
    this.root.cornerRadius = 8;
    this.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.root.isVisible = false;
    this.root.zIndex = 500;
    this.root.isHitTestVisible = true;
    this.ui.addControl(this.root);

    const layout = new StackPanel('upgrade_overlay_layout');
    layout.width = 1;
    layout.height = 1;
    layout.spacing = 8;
    layout.paddingTop = '14px';
    layout.paddingLeft = '14px';
    layout.paddingRight = '14px';
    layout.paddingBottom = '14px';
    this.root.addControl(layout);

    this.titleText = new TextBlock('upgrade_overlay_title', 'UPGRADE_SELECTION');
    this.titleText.height = '32px';
    this.titleText.color = '#ffffff';
    this.titleText.fontFamily = 'Rajdhani, sans-serif';
    this.titleText.fontWeight = '700';
    this.titleText.fontSize = 26;
    this.titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    layout.addControl(this.titleText);

    this.timerText = new TextBlock('upgrade_overlay_timer', 'TIME_LEFT: 00s');
    this.timerText.height = '24px';
    this.timerText.color = '#39f4c8';
    this.timerText.fontFamily = 'IBM Plex Mono, monospace';
    this.timerText.fontSize = 16;
    this.timerText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    layout.addControl(this.timerText);

    for (let i = 0; i < 3; i++) {
      const button = Button.CreateSimpleButton(`upgrade_overlay_option_${i + 1}`, '');
      button.width = 1;
      button.height = '86px';
      button.thickness = 2;
      button.color = '#5ec8ff';
      button.background = 'rgba(255, 255, 255, 0.03)';
      button.cornerRadius = 6;
      button.paddingTop = i === 0 ? '8px' : '0px';
      button.fontFamily = 'IBM Plex Mono, monospace';
      button.fontWeight = '600';
      button.fontSize = 16;
      button.textBlock!.textWrapping = true;
      button.textBlock!.lineSpacing = '4px';
      button.textBlock!.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      button.textBlock!.paddingLeft = '14px';
      button.textBlock!.paddingRight = '14px';
      layout.addControl(button);
      this.optionButtons.push(button);
    }
  }

  public showOffer(offer: UpgradeOfferPayload, onPick: (upgradeId: string) => void): void {
    this.root.isVisible = true;
    this.titleText.text = `WAVE_${offer.wave}_UPGRADE_SELECTION`;

    for (let i = 0; i < this.optionButtons.length; i++) {
      const button = this.optionButtons[i];
      const option = offer.options[i];

      button.onPointerUpObservable.clear();
      if (!option) {
        button.isVisible = false;
        continue;
      }

      const rarity = option.rarity || 'common';
      button.isVisible = true;
      button.color = RARITY_BORDER[rarity] || RARITY_BORDER.common;
      button.textBlock!.text =
        `[${i + 1}] ${option.label.toUpperCase()}\n${option.description.toUpperCase()}`;
      button.onPointerUpObservable.add((): void => {
        onPick(option.id);
      });
    }
  }

  public setTimeRemaining(seconds: number): void {
    const clamped = Math.max(0, Math.floor(seconds));
    this.timerText.text = `TIME_LEFT: ${clamped.toString().padStart(2, '0')}s`;
  }

  public hide(): void {
    this.root.isVisible = false;
    this.optionButtons.forEach((button) => button.onPointerUpObservable.clear());
  }

  public dispose(): void {
    this.hide();
    this.root.dispose();
  }
}
