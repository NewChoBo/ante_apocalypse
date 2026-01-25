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
  private tooltipText!: TextBlock;

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

    // Tooltip tracking
    this.pointerObserver =
      this.ui.getScene()?.onPointerObservable.add((pointerInfo) => {
        if (this.tooltip.isVisible) {
          const evt = pointerInfo.event as PointerEvent;
          this.tooltip.left = evt.clientX + 15 + 'px';
          this.tooltip.top = evt.clientY + 15 + 'px';
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
    this.tooltip.width = '200px';
    this.tooltip.height = '80px';
    this.tooltip.background = 'rgba(0,0,0,0.9)';
    this.tooltip.color = '#aaaaaa';
    this.tooltip.thickness = 1;
    this.tooltip.isVisible = false;
    this.tooltip.isHitTestVisible = false; // Mouse passes through
    this.tooltip.linkOffsetX = 20;
    this.tooltip.linkOffsetY = 20;
    this.ui.addControl(this.tooltip);

    this.tooltipText = new TextBlock('tooltipText');
    this.tooltipText.color = 'white';
    this.tooltipText.textWrapping = true;
    this.tooltipText.paddingTop = '5px';
    this.tooltipText.paddingBottom = '5px';
    this.tooltipText.paddingLeft = '5px';
    this.tooltipText.paddingRight = '5px';
    this.tooltip.addControl(this.tooltipText);
  }

  public toggle(force?: boolean): boolean {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.container.isVisible = this.isOpen;

    if (this.isOpen) {
      this.render();
    } else {
      this.tooltip.isVisible = false;
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
      slotBtn.onPointerClickObservable.add((info) => {
        // Left Click: Select / Swap logic
        if (info.buttonIndex === 0) {
          this.selectedSlotIndex = index;
          this.callbacks.onEquipWeapon(index, weaponId);
          this.render(); // Re-render to update selection style
        }
        // Right Click: Unequip
        else if (info.buttonIndex === 2) {
          this.callbacks.onEquipWeapon(index, null);
        }
      });

      // Tooltip
      if (meta) {
        slotBtn.onPointerEnterObservable.add(() => this.showTooltip(meta));
        slotBtn.onPointerOutObservable.add(() => this.hideTooltip());
      }

      this.equipmentGrid.addControl(slotBtn, index, 0);
    });

    // --- Render Bag Slots ---
    const BAG_COLS = 4;
    // Assume definitions are set in createInventoryWindow or we just add controls to cells.
    // Ideally we should manage rows dynamically, but for now we rely on existing definitions or just adding to cells (which works if definitions exist).
    // If we need to expand rows, we should check rowCount (private) or just add definitions safely?
    // Let's just assume we have enough rows (e.g. 5) set in createInventoryWindow.

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

        // Content
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

        // Interaction
        slotBtn.onPointerClickObservable.add(() => {
          // Consume or Equip
          if (item.type === 'consumable') {
            this.callbacks.onUseItem(item.id);
          } else if (item.type === 'weapon') {
            this.callbacks.onEquipWeapon(this.selectedSlotIndex, item.id); // Equip to currently selected slot
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
    this.tooltip.isVisible = true;
    this.tooltipText.text = `${item.name}\n[${item.type.toUpperCase()}]\n${item.description}`;
    // Position is handled by onPointerObservable in constructor
  }

  private hideTooltip(): void {
    this.tooltip.isVisible = false;
  }

  public dispose(): void {
    // Unsubscribe from store
    // actually class doesn't keep subscription reference.
    // InventoryUI constructor calls inventoryStore.subscribe(...) but doesn't store unsub.
    // Store subscribe returns unsubscribe function.
    // We need to store it.
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }

    // Dispose UI
    if (this.container) this.container.dispose();
    if (this.tooltip) this.tooltip.dispose();

    // Cleaning observable
    // The pointer observable is added to scene. We need to remove it.
    if (this.pointerObserver) {
      this.ui.getScene()?.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }
  }
}
