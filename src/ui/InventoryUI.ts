import { inventoryStore } from '../core/store/GameStore';
import { getItemMetadata } from '../core/items/ItemDatabase';
import {
  AdvancedDynamicTexture,
  Rectangle,
  Grid,
  TextBlock,
  Image,
  Control,
  Button,
  StackPanel,
} from '@babylonjs/gui';
import { Observer } from '@babylonjs/core';
import { UIManager } from './UIManager';

export interface InventoryCallbacks {
  onEquipWeapon: (slot: number, weaponId: string | null) => void;
  onUseItem: (itemId: string) => void;
  onDropItem: (itemId: string) => void;
}

export class InventoryUI {
  private ui: AdvancedDynamicTexture;
  private container: Rectangle;
  private equipmentGrid!: Grid;
  private bagGrid!: Grid;
  private tooltip!: Rectangle;
  private tooltipName!: TextBlock;
  private tooltipType!: TextBlock;
  private tooltipDesc!: TextBlock;

  private contextMenu!: Rectangle;
  private activeContextItemId: string | null = null;

  private isOpen = false;
  private callbacks: InventoryCallbacks;
  private selectedSlotIndex = 0;

  private unsub: (() => void) | null = null;
  private pointerObserver: Observer<any> | null = null;

  constructor(callbacks: InventoryCallbacks) {
    this.callbacks = callbacks;
    this.ui = UIManager.getInstance().getTexture();

    // Create UI Structure
    this.container = this.createInventoryWindow();
    this.createTooltip();

    // Subscribe to store changes
    this.unsub = inventoryStore.subscribe(() => {
      if (this.isOpen) this.render();
    });

    // Tooltip tracking: Follow mouse using scene pointer coordinates
    this.pointerObserver =
      this.ui.getScene()?.onPointerObservable.add((pointerInfo) => {
        // Only update on move when tooltip is visible
        if (pointerInfo.type === 0x01 && this.tooltip.isVisible) {
          // 0x01 is PointerEventTypes.POINTERMOVE
          const scene = this.ui.getScene();
          if (scene) {
            this.tooltip.left = scene.pointerX + 20 + 'px';
            this.tooltip.top = scene.pointerY + 20 + 'px';
          }
        }
      }) || null;
  }

  private createInventoryWindow(): Rectangle {
    // 1. Full Screen Overlay (Background)
    const overlay = new Rectangle('inventoryOverlay');
    overlay.width = 1;
    overlay.height = 1;
    overlay.background = 'rgba(0, 0, 0, 0.7)';
    overlay.thickness = 0;
    overlay.isVisible = false;
    this.ui.addControl(overlay);

    overlay.onPointerDownObservable.add(() => {
      this.hideContextMenu();
    });

    // 2. Main Window
    const window = new Rectangle('inventoryWindow');
    window.width = '800px';
    window.height = '600px';
    window.background = '#222222';
    window.color = 'white'; // Border
    window.thickness = 2;
    window.cornerRadius = 5;
    overlay.addControl(window);

    // 3. Header
    const header = new StackPanel('header');
    header.height = '60px';
    header.isVertical = false;
    header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.top = '10px';
    window.addControl(header);

    const title = new TextBlock('title', 'SYSTEM INVENTORY V.2');
    title.color = 'white';
    title.fontSize = 28;
    title.width = '500px';
    header.addControl(title);

    const closeHint = new TextBlock('closeHint', 'PRESS [TAB] TO CLOSE');
    closeHint.color = '#aaaaaa';
    closeHint.fontSize = 14;
    closeHint.width = '300px';
    header.addControl(closeHint);

    // 4. Main Content Grid (Left: Equipment, Right: Bag)
    const contentGrid = new Grid('contentGrid');
    contentGrid.height = '500px';
    contentGrid.width = '760px';
    contentGrid.top = '20px';
    contentGrid.addColumnDefinition(0.3); // Equipment (30%)
    contentGrid.addColumnDefinition(0.7); // Bag (70%)
    window.addControl(contentGrid);

    // --- Left Side: Equipment ---
    const equipPanel = new StackPanel('equipPanel');
    equipPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    contentGrid.addControl(equipPanel, 0, 0);

    const equipLabel = new TextBlock('equipLabel', 'QUICK SLOTS (1-4)');
    equipLabel.color = '#888888';
    equipLabel.fontSize = 16;
    equipLabel.height = '30px';
    equipPanel.addControl(equipLabel);

    // Equipment Slots Grid (4 rows)
    this.equipmentGrid = new Grid('equipmentGrid');
    this.equipmentGrid.width = '100%';
    this.equipmentGrid.height = '400px';
    this.equipmentGrid.addRowDefinition(0.25);
    this.equipmentGrid.addRowDefinition(0.25);
    this.equipmentGrid.addRowDefinition(0.25);
    this.equipmentGrid.addRowDefinition(0.25);
    equipPanel.addControl(this.equipmentGrid);

    // --- Right Side: Bag ---
    const bagPanel = new StackPanel('bagPanel');
    bagPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    contentGrid.addControl(bagPanel, 0, 1);

    const bagLabel = new TextBlock('bagLabel', 'MODULAR STORAGE');
    bagLabel.color = '#888888';
    bagLabel.fontSize = 16;
    bagLabel.height = '30px';
    bagPanel.addControl(bagLabel);

    // Bag Grid (e.g. 4 columns x N rows)
    this.bagGrid = new Grid('bagGrid');
    this.bagGrid.width = '100%';
    this.bagGrid.height = '450px';

    // Initial definitions (Fixed 4x5 for ~20 items)
    for (let i = 0; i < 4; i++) this.bagGrid.addColumnDefinition(0.25);
    for (let i = 0; i < 5; i++) this.bagGrid.addRowDefinition(0.2);

    bagPanel.addControl(this.bagGrid);

    return overlay;
  }

  private createTooltip(): void {
    this.tooltip = new Rectangle('tooltip');
    this.tooltip.width = '240px';
    this.tooltip.height = '120px';
    this.tooltip.background = 'rgba(10, 10, 10, 0.95)';
    this.tooltip.color = 'rgba(255, 255, 255, 0.1)';
    this.tooltip.thickness = 1;
    this.tooltip.isVisible = false;
    this.tooltip.isHitTestVisible = false;
    this.tooltip.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.tooltip.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.tooltip.zIndex = 100;
    this.ui.addControl(this.tooltip);

    // Accent Bar (Left)
    const accent = new Rectangle('accent');
    accent.width = '4px';
    accent.height = '100%';
    accent.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    accent.background = '#ffc400';
    accent.thickness = 0;
    this.tooltip.addControl(accent);

    const stack = new StackPanel();
    stack.paddingLeft = '15px';
    stack.paddingRight = '10px';
    stack.paddingTop = '10px';
    stack.isVertical = true;
    stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.tooltip.addControl(stack);

    this.tooltipName = new TextBlock('tName', '');
    this.tooltipName.color = 'white';
    this.tooltipName.fontSize = 20;
    this.tooltipName.fontFamily = 'Rajdhani, sans-serif';
    this.tooltipName.fontWeight = 'bold';
    this.tooltipName.height = '30px';
    this.tooltipName.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.tooltipName);

    this.tooltipType = new TextBlock('tType', '');
    this.tooltipType.color = '#ffc400';
    this.tooltipType.fontSize = 12;
    this.tooltipType.height = '20px';
    this.tooltipType.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.tooltipType);

    this.tooltipDesc = new TextBlock('tDesc', '');
    this.tooltipDesc.color = '#aaaaaa';
    this.tooltipDesc.fontSize = 14;
    this.tooltipDesc.textWrapping = true;
    this.tooltipDesc.height = '50px';
    this.tooltipDesc.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.tooltipDesc);

    // --- Create Context Menu ---
    this.contextMenu = new Rectangle('contextMenu');
    this.contextMenu.width = '120px';
    this.contextMenu.height = '80px';
    this.contextMenu.background = '#111111';
    this.contextMenu.color = '#ffc400';
    this.contextMenu.thickness = 1;
    this.contextMenu.isVisible = false;
    this.contextMenu.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.contextMenu.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.contextMenu.zIndex = 110;
    this.ui.addControl(this.contextMenu);

    const contextStack = new StackPanel();
    this.contextMenu.addControl(contextStack);

    const createMenuBtn = (text: string, onClick: () => void) => {
      const btn = Button.CreateSimpleButton(text, text);
      btn.height = '40px';
      btn.color = 'white';
      btn.background = 'transparent';
      btn.thickness = 0;
      btn.onPointerEnterObservable.add(() => (btn.background = '#ffc400'));
      btn.onPointerOutObservable.add(() => (btn.background = 'transparent'));
      btn.onPointerClickObservable.add(onClick);
      return btn;
    };

    contextStack.addControl(
      createMenuBtn('USE ITEM', () => {
        if (this.activeContextItemId) this.callbacks.onUseItem(this.activeContextItemId);
        this.hideContextMenu();
      })
    );
    contextStack.addControl(
      createMenuBtn('DROP', () => {
        if (this.activeContextItemId) this.callbacks.onDropItem(this.activeContextItemId);
        this.hideContextMenu();
      })
    );
  }

  public toggle(force?: boolean): boolean {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.container.isVisible = this.isOpen;

    if (this.isOpen) {
      this.render();
    } else {
      this.tooltip.isVisible = false;
      this.hideContextMenu(); // Ensure context menu closes with inventory
    }
    return this.isOpen;
  }

  private render(): void {
    const state = inventoryStore.get();

    // Clear existing children (Babylon GUI Grid doesn't have clear(), have to dispose children)
    this.equipmentGrid.children.forEach((c) => c.dispose());
    // However, if we dispose children, we need to rebuild grid content.
    // Actually Grid.children returns readonly array.
    // We can iterate simple loop.
    while (this.equipmentGrid.children.length > 0) {
      this.equipmentGrid.children[0].dispose();
    }
    while (this.bagGrid.children.length > 0) {
      this.bagGrid.children[0].dispose();
    }

    // --- Render Equipment Slots ---
    state.weaponSlots.forEach((weaponId, index) => {
      const slotBtn = Button.CreateSimpleButton(`equipSlot_${index}`, '');
      slotBtn.width = '90%';
      slotBtn.height = '90%';
      slotBtn.background = '#333333';
      slotBtn.color = this.selectedSlotIndex === index ? '#4caf50' : 'white';
      slotBtn.thickness = this.selectedSlotIndex === index ? 2 : 1;

      // Slot Content Stack
      const stack = new StackPanel();
      slotBtn.addControl(stack);

      const meta = weaponId ? getItemMetadata(weaponId) : null;
      const nameText = new TextBlock('name', meta ? meta.name : 'Empty');
      nameText.color = 'white';
      nameText.fontSize = 18;
      nameText.height = '30px';
      stack.addControl(nameText);

      // Icon (if available, using simple text or image)
      if (meta && meta.icon) {
        const img = new Image('icon', meta.icon);
        img.width = '40px';
        img.height = '40px';
        stack.addControl(img);
      }

      // Interaction
      slotBtn.onPointerUpObservable.add((info) => {
        if (info.buttonIndex === 0) {
          this.selectedSlotIndex = index;
          this.callbacks.onEquipWeapon(index, weaponId);
          this.render();
        } else if (info.buttonIndex === 2 && weaponId) {
          // Right Click on equipped weapon: Drop it
          this.showContextMenu(weaponId, info.x, info.y);
        }
      });

      if (meta) {
        slotBtn.onPointerEnterObservable.add(() => this.showTooltip(meta));
        slotBtn.onPointerOutObservable.add(() => this.hideTooltip());
      }

      this.equipmentGrid.addControl(slotBtn, index, 0);
    });

    // --- Render Bag Slots ---
    const BAG_COLS = 4;

    for (let i = 0; i < state.maxBagSlots; i++) {
      const item = state.bagItems[i];
      const row = Math.floor(i / BAG_COLS);
      const col = i % BAG_COLS;

      const slotBtn = Button.CreateSimpleButton(`bagSlot_${i}`, '');
      slotBtn.width = '95%';
      slotBtn.height = '95%';
      slotBtn.background = '#444444';
      slotBtn.color = 'gray';
      slotBtn.thickness = 1;

      if (item) {
        slotBtn.background = '#555555';
        slotBtn.color = 'white';

        const stack = new StackPanel();
        slotBtn.addControl(stack);

        const meta = getItemMetadata(item.id);
        if (meta?.icon) {
          const img = new Image('icon', meta.icon);
          img.width = '40px';
          img.height = '40px';
          stack.addControl(img);
        }

        const count = new TextBlock('count', `x${item.count}`);
        count.color = 'white';
        count.fontSize = 14;
        count.height = '20px';
        stack.addControl(count);

        // Interaction: Right Click for Context Menu
        slotBtn.onPointerUpObservable.add((info) => {
          if (info.buttonIndex === 2) {
            // Right Click
            this.showContextMenu(item.id, info.x, info.y);
          } else if (info.buttonIndex === 0 && item.type === 'weapon') {
            // Left Click for weapon: quick equip
            this.callbacks.onEquipWeapon(this.selectedSlotIndex, item.id);
          }
        });

        if (meta) {
          slotBtn.onPointerEnterObservable.add(() => this.showTooltip(meta));
          slotBtn.onPointerOutObservable.add(() => this.hideTooltip());
        }
      }

      this.bagGrid.addControl(slotBtn, row, col);
    }
  }

  private showTooltip(item: { name: string; type: string; description: string }): void {
    const scene = this.ui.getScene();
    if (scene) {
      this.tooltip.left = scene.pointerX + 20 + 'px';
      this.tooltip.top = scene.pointerY + 20 + 'px';
    }
    this.tooltip.isVisible = true;
    this.tooltipName.text = item.name.toUpperCase();
    this.tooltipType.text = `[ ${item.type.toUpperCase()} ]`;
    this.tooltipDesc.text = item.description;
  }

  private hideTooltip(): void {
    this.tooltip.isVisible = false;
  }

  private showContextMenu(itemId: string, x: number, y: number): void {
    this.activeContextItemId = itemId;
    this.contextMenu.left = x + 'px';
    this.contextMenu.top = y + 'px';
    this.contextMenu.isVisible = true;
  }

  private hideContextMenu(): void {
    this.contextMenu.isVisible = false;
    this.activeContextItemId = null;
  }

  public dispose(): void {
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }

    if (this.container) this.container.dispose();
    if (this.tooltip) this.tooltip.dispose();
    if (this.contextMenu) this.contextMenu.dispose();

    if (this.pointerObserver) {
      this.ui.getScene()?.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }
  }
}
