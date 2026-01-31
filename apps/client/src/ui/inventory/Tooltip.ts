import { AdvancedDynamicTexture, Rectangle, TextBlock, StackPanel, Control } from '@babylonjs/gui';
import { UI_CONFIG } from './Config';

export class InventoryTooltip {
  private container: Rectangle;
  private nameText: TextBlock;
  private typeText: TextBlock;
  private descText: TextBlock;

  constructor(ui: AdvancedDynamicTexture) {
    this.container = new Rectangle('tooltip');
    this.container.width = '240px';
    this.container.height = '120px';
    this.container.background = 'rgba(10, 10, 10, 0.95)';
    this.container.color = 'rgba(255, 255, 255, 0.1)';
    this.container.thickness = 1;
    this.container.isVisible = false;
    this.container.isHitTestVisible = false;
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.container.zIndex = 100;
    ui.addControl(this.container);

    const accent = new Rectangle('accent');
    accent.width = '4px';
    accent.height = '100%';
    accent.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    accent.background = UI_CONFIG.colors.accent;
    accent.thickness = 0;
    this.container.addControl(accent);

    const stack = new StackPanel();
    stack.paddingLeft = '15px';
    stack.paddingRight = '10px';
    stack.paddingTop = '10px';
    stack.isVertical = true;
    stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.addControl(stack);

    const createTBlock = (
      size: number,
      color: string,
      height: string,
      bold: boolean = false
    ): TextBlock => {
      const tb = new TextBlock('', '');
      tb.color = color;
      tb.fontSize = size;
      tb.height = height;
      tb.fontFamily = UI_CONFIG.fonts.main;
      if (bold) tb.fontWeight = 'bold';
      tb.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      stack.addControl(tb);
      return tb;
    };

    this.nameText = createTBlock(20, UI_CONFIG.colors.textMain, '30px', true);
    this.typeText = createTBlock(12, UI_CONFIG.colors.accent, '20px');
    this.descText = createTBlock(14, UI_CONFIG.colors.textDim, '50px');
    this.descText.textWrapping = true;
  }

  public show(item: { name: string; type: string; description: string }): void {
    this.container.isVisible = true;
    this.nameText.text = item.name.toUpperCase();
    this.typeText.text = `[ ${item.type.toUpperCase()} ]`;
    this.descText.text = item.description;
  }

  public hide(): void {
    this.container.isVisible = false;
  }

  public updatePosition(x: number, y: number): void {
    if (this.isVisible) {
      this.container.left = x + 20 + 'px';
      this.container.top = y + 20 + 'px';
    }
  }

  public get isVisible(): boolean {
    return this.container.isVisible;
  }

  public dispose(): void {
    this.container.dispose();
  }
}
