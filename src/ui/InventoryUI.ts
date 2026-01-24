import { inventoryStore, InventoryItem, BagItem } from '../core/store/GameStore';

export interface InventoryCallbacks {
  onEquipWeapon: (slot: number, weaponId: string | null) => void;
  onUseItem: (itemId: string) => void;
  onDropItem: (itemId: string) => void;
}

export class InventoryUI {
  private container: HTMLElement;
  private equipmentSlots: HTMLElement;
  private bagGrid: HTMLElement;
  private tooltip: HTMLElement;
  private contextMenu: HTMLElement;

  private isOpen = false;
  private callbacks: InventoryCallbacks;
  private selectedSlotIndex = 0;

  // DnD state
  private draggedItemId: string | null = null;
  private dragSource: { type: 'slot' | 'bag'; index: number } | null = null;

  constructor(callbacks: InventoryCallbacks) {
    this.callbacks = callbacks;
    this.container = this.createUI();
    this.equipmentSlots = this.container.querySelector('.equipment-slots')!;
    this.bagGrid = this.container.querySelector('.bag-grid')!;
    this.tooltip = this.createTooltip();
    this.contextMenu = this.createContextMenu();

    document.body.appendChild(this.container);
    document.body.appendChild(this.tooltip);
    document.body.appendChild(this.contextMenu);

    // Global listeners
    document.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
    document.addEventListener('click', () => this.hideContextMenu());

    // Subscribe to store changes
    inventoryStore.subscribe(() => {
      if (this.isOpen) this.render();
    });
  }

  private createTooltip(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'inventory-tooltip';
    return el;
  }

  private createContextMenu(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'inventory-context-menu';
    return el;
  }

  private handleGlobalMouseMove(e: MouseEvent): void {
    if (!this.isOpen) return;
    this.tooltip.style.left = `${e.clientX + 15}px`;
    this.tooltip.style.top = `${e.clientY + 15}px`;
  }

  private createUI(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'inventory-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="inventory-window">
        <div class="inventory-header">
          <h2>SYSTEM INVENTORY V.2</h2>
          <div class="close-hint">PRESS [TAB] TO CLOSE</div>
        </div>
        <div class="inventory-panels">
          <div class="equipment-side">
            <div class="section-title">QUICK SLOTS (1-4)</div>
            <div class="equipment-slots">
                <!-- Weapon slots will be rendered here -->
            </div>
          </div>
          <div class="bag-side">
            <div class="section-title">MODULAR STORAGE</div>
            <div class="bag-grid">
                <!-- Bag items will be rendered here -->
            </div>
          </div>
        </div>
        <div class="inventory-footer">
          <div class="usage-hint">
            [L-Click] Assign | [R-Click] Menu | [Drag] Manage Gear
          </div>
        </div>
      </div>
    `;

    return overlay;
  }

  public toggle(force?: boolean): boolean {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.container.style.display = this.isOpen ? 'flex' : 'none';

    if (this.isOpen) {
      this.render();
      document.exitPointerLock();
    }
    return this.isOpen;
  }

  private render(): void {
    const state = inventoryStore.get();

    // Render Equipment Slots
    this.equipmentSlots.innerHTML = '';
    state.weaponSlots.forEach((weaponId, index) => {
      const slot = document.createElement('div');
      slot.className = `weapon-slot ${this.selectedSlotIndex === index ? 'active' : ''}`;
      if (weaponId) slot.draggable = true;

      const weaponName = weaponId || 'Empty Slot';
      const icon = this.getItemIcon(weaponId);

      slot.innerHTML = `
            <div class="slot-number">${index + 1}</div>
            <div class="item-icon">${icon}</div>
            <div class="item-name">${weaponName}</div>
        `;

      // Interaction Listeners
      slot.addEventListener('click', () => {
        this.selectedSlotIndex = index;
        if (weaponId) this.callbacks.onEquipWeapon(index, weaponId);
        this.render();
      });

      slot.addEventListener('mouseenter', () => {
        if (weaponId) this.showTooltip({ id: weaponId, name: weaponId, type: 'weapon' });
      });
      slot.addEventListener('mouseleave', () => this.hideTooltip());

      // DnD Listeners
      this.setupDnD(slot, 'slot', index, weaponId);

      this.equipmentSlots.appendChild(slot);
    });

    // Render Bag
    this.bagGrid.innerHTML = '';
    for (let i = 0; i < state.maxBagSlots; i++) {
      const item = state.bagItems[i];
      const slot = document.createElement('div');
      slot.className = 'bag-slot';

      if (item) {
        slot.draggable = true;
        slot.innerHTML = `
                <div class="item-icon" style="font-size: 24px;">${this.getItemIcon(item.id)}</div>
                <div class="item-count">x${item.count}</div>
            `;

        slot.addEventListener('click', (e) => {
          e.preventDefault();
          if (item.type === 'weapon') {
            this.callbacks.onEquipWeapon(this.selectedSlotIndex, item.id);
          }
        });

        slot.addEventListener('contextmenu', (e) => this.showContextMenu(e, item));
        slot.addEventListener('mouseenter', () => this.showTooltip(item));
        slot.addEventListener('mouseleave', () => this.hideTooltip());

        this.setupDnD(slot, 'bag', i, item.id);
      } else {
        // Empty bag slot can also be a drop target
        this.setupDnD(slot, 'bag', i, null);
      }

      this.bagGrid.appendChild(slot);
    }
  }

  private setupDnD(
    el: HTMLElement,
    type: 'slot' | 'bag',
    index: number,
    itemId: string | null
  ): void {
    el.addEventListener('dragstart', (e) => {
      if (!itemId) return;
      this.draggedItemId = itemId;
      this.dragSource = { type, index };
      el.style.opacity = '0.5';
      if (e.dataTransfer) e.dataTransfer.setData('text/plain', itemId);
    });

    el.addEventListener('dragend', () => {
      el.style.opacity = '1';
      this.draggedItemId = null;
      this.dragSource = null;
      const slots = this.container.querySelectorAll('.weapon-slot, .bag-slot');
      slots.forEach((s) => s.classList.remove('drag-over'));
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.draggedItemId) el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (!this.draggedItemId || !this.dragSource) return;

      if (type === 'slot') {
        // Drop into equipment slot
        this.callbacks.onEquipWeapon(index, this.draggedItemId);
      } else if (type === 'bag' && this.dragSource.type === 'slot') {
        // Drop from slot back to bag -> Unequip
        this.callbacks.onEquipWeapon(this.dragSource.index, null);
      }
    });
  }

  private showTooltip(item: InventoryItem): void {
    this.tooltip.innerHTML = `
      <div class="tooltip-name">${item.name}</div>
      <div class="tooltip-type">${item.type.toUpperCase()}</div>
      <div class="tooltip-desc">${this.getItemDescription(item.id)}</div>
    `;
    this.tooltip.style.display = 'block';
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }

  private showContextMenu(e: MouseEvent, item: BagItem): void {
    e.preventDefault();
    this.contextMenu.style.left = `${e.clientX}px`;
    this.contextMenu.style.top = `${e.clientY}px`;
    this.contextMenu.style.display = 'block';

    this.contextMenu.innerHTML = '';

    if (item.type === 'consumable') {
      const useBtn = document.createElement('div');
      useBtn.className = 'context-menu-item';
      useBtn.innerHTML = `<span>USE ITEM</span>`;
      useBtn.onclick = () => this.callbacks.onUseItem(item.id);
      this.contextMenu.appendChild(useBtn);
    }

    const dropBtn = document.createElement('div');
    dropBtn.className = 'context-menu-item';
    dropBtn.innerHTML = `<span style="color: #ff5252;">DROP ITEM</span>`;
    dropBtn.onclick = () => this.callbacks.onDropItem(item.id);
    this.contextMenu.appendChild(dropBtn);
  }

  private hideContextMenu(): void {
    this.contextMenu.style.display = 'none';
  }

  private getItemDescription(id: string): string {
    const lid = id.toLowerCase();
    if (lid.includes('pistol')) return 'Standard sidearm. Reliable and fast.';
    if (lid.includes('rifle')) return 'Powerful long-range weapon.';
    if (lid.includes('knife')) return 'Sharp combat knife for silent kills.';
    if (lid.includes('bat')) return 'Melee weapon for heavy impact.';
    if (lid.includes('health')) return 'Restores 30 HP on use.';
    if (lid.includes('ammo')) return 'Restores 50 rounds for all weapons.';
    return 'Generic survival item.';
  }

  private getItemIcon(id: string | null): string {
    if (!id) return '➖';
    const lid = id.toLowerCase();
    if (lid.includes('pistol')) return '🔫';
    if (lid.includes('rifle')) return '🔫';
    if (lid.includes('knife')) return '🔪';
    if (lid.includes('bat')) return '🏏';
    if (lid.includes('health')) return '💊';
    if (lid.includes('ammo')) return '🔋';
    return '📦';
  }
}
