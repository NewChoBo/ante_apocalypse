import {
  AdvancedDynamicTexture,
  Rectangle,
  StackPanel,
  Button,
  Control,
  TextBlock,
} from '@babylonjs/gui';
import { UI_CONFIG, InventoryCallbacks } from './Config';

export class InventoryContextMenu {
  private container: Rectangle;
  private activeItemId: string | null = null;
  private callbacks: InventoryCallbacks;
  private actionBtnText!: TextBlock;

  constructor(ui: AdvancedDynamicTexture, callbacks: InventoryCallbacks) {
    this.callbacks = callbacks;
    this.container = new Rectangle('contextMenu');
    this.container.width = '120px';
    this.container.height = '80px';
    this.container.background = '#111111';
    this.container.color = UI_CONFIG.colors.accent;
    this.container.thickness = 1;
    this.container.isVisible = false;
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.container.zIndex = 110;
    ui.addControl(this.container);

    const stack = new StackPanel();
    this.container.addControl(stack);

    const createMenuBtn = (id: string, text: string, onClick: () => void) => {
      const btn = Button.CreateSimpleButton(id, text);
      btn.height = '40px';
      btn.color = UI_CONFIG.colors.textMain;
      btn.background = 'transparent';
      btn.thickness = 0;
      btn.onPointerEnterObservable.add(() => (btn.background = UI_CONFIG.colors.accent));
      btn.onPointerOutObservable.add(() => (btn.background = 'transparent'));
      btn.onPointerClickObservable.add(onClick);
      return btn;
    };

    const actionBtn = createMenuBtn('actionBtn', UI_CONFIG.labels.use, () => {
      if (this.activeItemId) this.callbacks.onUseItem(this.activeItemId);
      this.hide();
    });
    this.actionBtnText = actionBtn.textBlock!;
    stack.addControl(actionBtn);

    stack.addControl(
      createMenuBtn('dropBtn', UI_CONFIG.labels.drop, () => {
        if (this.activeItemId) this.callbacks.onDropItem(this.activeItemId);
        this.hide();
      })
    );
  }

  public show(itemId: string, x: number, y: number, isWeapon: boolean = false): void {
    this.activeItemId = itemId;
    this.actionBtnText.text = isWeapon ? UI_CONFIG.labels.equip_action : UI_CONFIG.labels.use;
    this.container.left = x + 'px';
    this.container.top = y + 'px';
    this.container.isVisible = true;
  }

  public hide(): void {
    this.container.isVisible = false;
    this.activeItemId = null;
  }

  public get isVisible(): boolean {
    return this.container.isVisible;
  }

  public dispose(): void {
    this.container.dispose();
  }
}
