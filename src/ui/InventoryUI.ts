import { inventoryStore, BagItem } from '../core/store/GameStore';
import { getItemMetadata } from '../core/items/ItemDatabase';
import { InventoryManager } from '../core/inventory/InventoryManager';

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
  private dragSource: { type: 'slot' | 'bag'; index: number; itemId: string | null } | null = null;

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
    el.style.position = 'fixed';
    el.style.display = 'none';
    el.style.zIndex = '2000';
    return el;
  }

  private createContextMenu(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'inventory-context-menu';
    el.style.position = 'fixed';
    el.style.display = 'none';
    el.style.zIndex = '2100';
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
            [L-Click] Equip | [R-Click] Menu | [Drag] Manage Gear
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
    } else {
      this.hideTooltip();
      this.hideContextMenu();
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

      const meta = weaponId ? getItemMetadata(weaponId) : null;
      const weaponName = meta?.name || 'Empty Slot';
      const iconHtml = meta
        ? `<img src="${meta.icon}" alt="${weaponName}" class="item-icon-img">`
        : '➖';

      slot.innerHTML = `
            <div class="slot-number">${index + 1}</div>
            <div class="item-icon">${iconHtml}</div>
            <div class="item-name">${weaponName}</div>
        `;

      // Interaction Listeners
      slot.addEventListener('click', () => {
        this.selectedSlotIndex = index;
        if (weaponId) this.callbacks.onEquipWeapon(index, weaponId);
        this.render();
      });

      slot.addEventListener('mouseenter', () => {
        if (meta) this.showTooltip(meta);
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
        const meta = getItemMetadata(item.id);
        const isEquipped = state.weaponSlots.includes(item.id);

        if (isEquipped) {
          slot.classList.add('equipped');
        }

        slot.innerHTML = `
                <div class="item-icon"><img src="${meta?.icon || '/images/items/generic.png'}" alt="${meta?.name}" class="item-icon-img"></div>
                <div class="item-count">x${item.count}</div>
            `;

        slot.addEventListener('click', (e) => {
          e.preventDefault();
          if (item.type === 'consumable') {
            InventoryManager.useItem(item.id);
          }
          // Weapon click equip removed: equipping is now DnD only
        });

        slot.addEventListener('contextmenu', (e) => this.showContextMenu(e, item));
        slot.addEventListener('mouseenter', () => {
          if (meta) this.showTooltip(meta);
        });
        slot.addEventListener('mouseleave', () => this.hideTooltip());

        this.setupDnD(slot, 'bag', i, item.id);
      } else {
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
      if (!itemId) {
        e.preventDefault();
        return;
      }
      this.dragSource = { type, index, itemId };
      el.style.opacity = '0.5';
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemId);
      }
    });

    el.addEventListener('dragend', () => {
      el.style.opacity = '1';
      this.dragSource = null;
      const slots = this.container.querySelectorAll('.weapon-slot, .bag-slot');
      slots.forEach((s) => s.classList.remove('drag-over'));
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.dragSource) {
        el.classList.add('drag-over');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      }
    });

    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (!this.dragSource) return;

      const source = this.dragSource;

      if (type === 'slot') {
        // Drop into equipment slot
        if (source.type === 'bag' || source.type === 'slot') {
          InventoryManager.equipWeapon(index, source.itemId);
        }
      } else if (type === 'bag') {
        if (source.type === 'slot') {
          // Drop from slot back to bag -> Unequip
          InventoryManager.equipWeapon(source.index, null);
        } else if (source.type === 'bag') {
          // Swap items in bag
          InventoryManager.swapBagItems(source.index, index);
        }
      }
    });
  }

  private showTooltip(item: { name: string; type: string; description: string }): void {
    this.tooltip.innerHTML = `
      <div class="tooltip-name">${item.name}</div>
      <div class="tooltip-type">${item.type.toUpperCase()}</div>
      <div class="tooltip-desc">${item.description}</div>
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
      useBtn.onclick = () => {
        InventoryManager.useItem(item.id);
        this.hideContextMenu();
      };
      this.contextMenu.appendChild(useBtn);
    }

    const dropBtn = document.createElement('div');
    dropBtn.className = 'context-menu-item';
    dropBtn.innerHTML = `<span style="color: #ff5252;">DROP ITEM</span>`;
    dropBtn.onclick = () => {
      InventoryManager.dropItem(item.id);
      this.hideContextMenu();
    };
    this.contextMenu.appendChild(dropBtn);
  }

  private hideContextMenu(): void {
    this.contextMenu.style.display = 'none';
  }
}
