import { inventoryStore, InventoryState } from '../../core/store/GameStore';
import { getItemMetadata } from '../../core/items/ItemDatabase';
import {
  AdvancedDynamicTexture,
  Rectangle,
  Grid,
  TextBlock,
  Image,
  Control,
  Button,
  StackPanel,
  Vector2WithInfo,
} from '@babylonjs/gui';
import { Observer, Scene } from '@babylonjs/core';
import { UIManager } from '../UIManager';
import { UI_CONFIG, InventoryCallbacks } from './Config';
import { InventoryTooltip } from './Tooltip';
import { InventoryContextMenu } from './ContextMenu';

export class InventoryUI {
  private ui: AdvancedDynamicTexture;
  private container: Rectangle;
  private equipmentGrid!: Grid;
  private bagGrid!: Grid;

  private tooltip: InventoryTooltip;
  private contextMenu: InventoryContextMenu;

  private isOpen = false;
  private callbacks: InventoryCallbacks;
  private selectedSlotIndex = 0;

  private unsub: (() => void) | null = null;
  private pointerObserver: Observer<Scene> | null = null;

  constructor(callbacks: InventoryCallbacks) {
    this.callbacks = callbacks;
    this.ui = UIManager.getInstance().getTexture();

    this.container = this.createInventoryWindow();
    this.tooltip = new InventoryTooltip(this.ui);
    this.contextMenu = new InventoryContextMenu(this.ui, this.callbacks);

    this.unsub = inventoryStore.subscribe(() => {
      if (this.isOpen) this.render();
    });

    this.pointerObserver =
      this.ui.getScene()?.onBeforeRenderObservable.add(() => {
        if (this.tooltip.isVisible) {
          const scene = this.ui.getScene();
          if (scene) {
            this.tooltip.updatePosition(scene.pointerX, scene.pointerY);
          }
        }
      }) || null;
  }

  private createInventoryWindow(): Rectangle {
    const overlay = new Rectangle('inventoryOverlay');
    overlay.width = 1;
    overlay.height = 1;
    overlay.background = UI_CONFIG.colors.bgOverlay;
    overlay.thickness = 0;
    overlay.isVisible = false;
    this.ui.addControl(overlay);

    overlay.onPointerDownObservable.add(() => this.contextMenu.hide());

    const window = new Rectangle('inventoryWindow');
    window.width = UI_CONFIG.dimensions.windowWidth;
    window.height = UI_CONFIG.dimensions.windowHeight;
    window.background = UI_CONFIG.colors.bg;
    window.color = UI_CONFIG.colors.textMain;
    window.thickness = 2;
    window.cornerRadius = 5;
    overlay.addControl(window);

    this.createHeader(window);

    const contentGrid = new Grid('contentGrid');
    contentGrid.height = UI_CONFIG.dimensions.gridHeight;
    contentGrid.width = UI_CONFIG.dimensions.gridWidth;
    contentGrid.top = '20px';
    contentGrid.addColumnDefinition(0.3);
    contentGrid.addColumnDefinition(0.7);
    window.addControl(contentGrid);

    this.equipmentGrid = this.createSidePanel(contentGrid, UI_CONFIG.labels.equip, 0, 4, 1);
    this.bagGrid = this.createSidePanel(contentGrid, UI_CONFIG.labels.bag, 1, 5, 4);

    return overlay;
  }

  private createHeader(parent: Rectangle): void {
    const header = new StackPanel('header');
    header.height = UI_CONFIG.dimensions.headerHeight;
    header.isVertical = false;
    header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.top = '10px';
    parent.addControl(header);

    const createText = (text: string, color: string, size: number, width: string): TextBlock => {
      const tb = new TextBlock('txt', text);
      tb.color = color;
      tb.fontSize = size;
      tb.width = width;
      return tb;
    };

    header.addControl(createText(UI_CONFIG.labels.title, UI_CONFIG.colors.textMain, 28, '500px'));
    header.addControl(
      createText(UI_CONFIG.labels.closeHint, UI_CONFIG.colors.textDim, 14, '300px')
    );
  }

  private createSidePanel(
    parent: Grid,
    title: string,
    col: number,
    rows: number,
    cols: number
  ): Grid {
    const panel = new StackPanel('panel');
    panel.width = '100%';
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    parent.addControl(panel, 0, col);

    const label = new TextBlock('label', title);
    label.color = UI_CONFIG.colors.textLabel;
    label.fontSize = 16;
    label.height = '30px';
    panel.addControl(label);

    const grid = new Grid('grid');
    grid.width = '100%';
    grid.height = col === 0 ? '400px' : '450px';
    for (let i = 0; i < cols; i++) grid.addColumnDefinition(1 / cols);
    for (let i = 0; i < rows; i++) grid.addRowDefinition(1 / rows);
    panel.addControl(grid);
    return grid;
  }

  private createBaseSlot(id: string, background: string, isEquip: boolean = false): Button {
    const btn = Button.CreateSimpleButton(id, '');
    const size = isEquip ? UI_CONFIG.dimensions.slotSizeEquip : UI_CONFIG.dimensions.slotSizeBag;
    btn.width = size;
    btn.height = size;
    btn.background = background;
    btn.color = UI_CONFIG.colors.textMain;
    btn.thickness = 1;

    btn.onPointerEnterObservable.add(() => (btn.color = UI_CONFIG.colors.accent));
    btn.onPointerOutObservable.add(() => (btn.color = UI_CONFIG.colors.textMain));
    return btn;
  }

  public toggle(force?: boolean): boolean {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.container.isVisible = this.isOpen;
    if (this.isOpen) {
      this.render();
    } else {
      this.tooltip.hide();
      this.contextMenu.hide();
    }
    return this.isOpen;
  }

  public getSelectedSlot(): number {
    return this.selectedSlotIndex;
  }

  private render(): void {
    const state = inventoryStore.get();
    [this.equipmentGrid, this.bagGrid].forEach((grid) => {
      while (grid.children.length > 0) grid.children[0].dispose();
    });
    this.renderEquipmentSlots(state);
    this.renderBagSlots(state);
  }

  private renderEquipmentSlots(state: InventoryState): void {
    state.weaponSlots.forEach((weaponId: string | null, index: number) => {
      const isSelected = this.selectedSlotIndex === index;
      const slotBtn = this.createBaseSlot(`equipSlot_${index}`, UI_CONFIG.colors.bgEquip, true);
      if (isSelected) {
        slotBtn.color = UI_CONFIG.colors.equipActive;
        slotBtn.thickness = 2;
      }

      const meta = weaponId ? getItemMetadata(weaponId) : null;
      const stack = new StackPanel();
      stack.width = stack.height = '100%';
      stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      slotBtn.addControl(stack);

      if (meta?.icon) {
        const img = new Image('icon', meta.icon);
        img.width = img.height = UI_CONFIG.dimensions.iconSize;
        stack.addControl(img);
      }

      const name = new TextBlock('name', meta ? meta.name : UI_CONFIG.labels.empty);
      name.color = UI_CONFIG.colors.textMain;
      name.fontSize = meta?.icon ? 14 : 18;
      name.height = '24px';
      stack.addControl(name);

      this.attachSlotInteraction(
        slotBtn,
        (info) => {
          if (info.buttonIndex === 0) {
            this.selectedSlotIndex = index;
            this.callbacks.onEquipWeapon(index, weaponId);
            this.render();
          } else if (info.buttonIndex === 2 && weaponId) {
            this.contextMenu.show(weaponId, info.x, info.y, true);
          }
        },
        meta || null,
        isSelected
      );

      this.equipmentGrid.addControl(slotBtn, index, 0);
    });
  }

  private renderBagSlots(state: InventoryState): void {
    const BAG_COLS = 4;
    for (let i = 0; i < state.maxBagSlots; i++) {
      const item = state.bagItems[i];
      const slotBtn = this.createBaseSlot(
        `bagSlot_${i}`,
        item ? UI_CONFIG.colors.bgSlotActive : UI_CONFIG.colors.bgSlot
      );
      if (item) {
        const meta = getItemMetadata(item.id);
        if (meta?.icon) {
          const img = new Image('icon', meta.icon);
          img.width = img.height = UI_CONFIG.dimensions.iconSize;
          slotBtn.addControl(img);
        }
        const count = new TextBlock('count', `x${item.count}`);
        count.color = UI_CONFIG.colors.textMain;
        count.fontSize = 12;
        count.fontWeight = 'bold';
        count.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        count.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        count.paddingRight = count.paddingBottom = '5px';
        slotBtn.addControl(count);

        this.attachSlotInteraction(
          slotBtn,
          (info) => {
            if (info.buttonIndex === 2) {
              this.contextMenu.show(item.id, info.x, info.y, item.type === 'weapon');
            } else if (info.buttonIndex === 0 && item.type === 'weapon') {
              this.callbacks.onEquipWeapon(this.selectedSlotIndex, item.id);
            }
          },
          meta || null
        );
      }
      this.bagGrid.addControl(slotBtn, Math.floor(i / BAG_COLS), i % BAG_COLS);
    }
  }

  private attachSlotInteraction(
    btn: Button,
    onUp: (info: Vector2WithInfo) => void, // Button onPointerUpObservable passes Vector2WithInfo
    meta: { name: string; type: string; description: string } | null,
    isSelected: boolean = false
  ): void {
    btn.onPointerUpObservable.add(onUp);
    if (meta) {
      btn.onPointerEnterObservable.add(() => this.tooltip.show(meta));
      btn.onPointerOutObservable.add(() => {
        this.tooltip.hide();
        if (isSelected) btn.color = UI_CONFIG.colors.equipActive;
      });
    }
  }

  public dispose(): void {
    if (this.unsub) this.unsub();
    this.container.dispose();
    this.tooltip.dispose();
    this.contextMenu.dispose();
    if (this.pointerObserver) {
      this.ui.getScene()?.onBeforeRenderObservable.remove(this.pointerObserver);
    }
  }
}
