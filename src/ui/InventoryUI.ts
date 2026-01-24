import { inventoryStore, InventoryItem, BagItem } from '../core/store/GameStore';

export interface InventoryCallbacks {
  onEquipWeapon: (slot: number, weaponId: string | null) => void;
  onUseItem: (itemId: string) => void;
}

export class InventoryUI {
  private container: HTMLElement;
  private equipmentSlots: HTMLElement;
  private bagGrid: HTMLElement;
  private detailName: HTMLElement;
  private detailDesc: HTMLElement;

  private isOpen = false;
  private callbacks: InventoryCallbacks;
  private selectedSlotIndex = 0;

  constructor(callbacks: InventoryCallbacks) {
    this.callbacks = callbacks;
    this.container = this.createUI();
    this.equipmentSlots = this.container.querySelector('.equipment-slots')!;
    this.bagGrid = this.container.querySelector('.bag-grid')!;
    this.detailName = this.container.querySelector('.detail-name')!;
    this.detailDesc = this.container.querySelector('.detail-description')!;

    document.body.appendChild(this.container);

    // Subscribe to store changes
    inventoryStore.subscribe(() => {
      if (this.isOpen) this.render();
    });
  }

  private createUI(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'inventory-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="inventory-window">
        <div class="inventory-header">
          <h2>CHARACTER INVENTORY</h2>
          <div class="close-hint">PRESS [TAB] TO CLOSE</div>
        </div>
        <div class="inventory-panels">
          <div class="equipment-side">
            <div class="section-title">Equipment Slots (1-4)</div>
            <div class="equipment-slots">
                <!-- Weapon slots will be rendered here -->
            </div>
          </div>
          <div class="bag-side">
            <div class="section-title">Bag / Items</div>
            <div class="bag-grid">
                <!-- Bag items will be rendered here -->
            </div>
          </div>
        </div>
        <div class="inventory-footer">
          <div class="item-details">
             <div class="detail-name">INVENTORY</div>
             <div class="detail-description">Manage your gear and consumables.</div>
          </div>
          <div class="usage-hint">
            [L-Click] Equip/Select | [R-Click] Use Item
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

      const weaponName = weaponId || 'Empty Slot';
      const icon = this.getItemIcon(weaponId);

      slot.innerHTML = `
            <div class="slot-number">${index + 1}</div>
            <div class="item-icon">${icon}</div>
            <div class="item-name">${weaponName}</div>
        `;

      slot.addEventListener('click', () => {
        this.selectedSlotIndex = index;
        this.render();
        this.updateDetails(weaponId ? { id: weaponId, name: weaponId, type: 'weapon' } : null);
      });

      this.equipmentSlots.appendChild(slot);
    });

    // Render Bag
    this.bagGrid.innerHTML = '';
    // Fill with items + empty slots up to maxBagSlots
    for (let i = 0; i < state.maxBagSlots; i++) {
      const item = state.bagItems[i];
      const slot = document.createElement('div');
      slot.className = 'bag-slot';

      if (item) {
        slot.innerHTML = `
                <div class="item-icon" style="font-size: 24px;">${this.getItemIcon(item.id)}</div>
                <div class="item-count">x${item.count}</div>
            `;

        slot.addEventListener('click', (e) => {
          e.preventDefault();
          if (item.type === 'weapon') {
            this.callbacks.onEquipWeapon(this.selectedSlotIndex, item.id);
          } else {
            this.updateDetails(item);
          }
        });

        // Right click to use
        slot.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (item.type === 'consumable') {
            this.callbacks.onUseItem(item.id);
          }
        });

        slot.addEventListener('mouseenter', () => this.updateDetails(item));
      }

      this.bagGrid.appendChild(slot);
    }
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

  private updateDetails(item: InventoryItem | null): void {
    if (!item) {
      this.detailName.textContent = 'EMPTY SLOT';
      this.detailDesc.textContent = 'Select a weapon from your bag to equip here.';
      return;
    }

    this.detailName.textContent = item.name.toUpperCase();
    if (item.type === 'weapon') {
      this.detailDesc.textContent = `Weapon. Click to assign to Slot ${this.selectedSlotIndex + 1}.`;
    } else {
      this.detailDesc.textContent = `Consumable. Right-Click to use.`;
    }
  }
}
