export interface InventoryCallbacks {
  onEquipWeapon: (slot: number, weaponId: string | null) => void;
  onUseItem: (itemId: string) => void;
  onDropItem: (itemId: string) => void;
}

export const UI_CONFIG = {
  colors: {
    bg: '#222222',
    bgOverlay: 'rgba(0, 0, 0, 0.7)',
    bgSlot: '#444444',
    bgSlotActive: '#555555',
    bgEquip: '#333333',
    accent: '#ffc400',
    textMain: 'white',
    textDim: '#aaaaaa',
    textLabel: '#888888',
    equipActive: '#4caf50',
  },
  dimensions: {
    windowWidth: '800px',
    windowHeight: '600px',
    headerHeight: '60px',
    gridWidth: '760px',
    gridHeight: '500px',
    slotSizeBag: '95%',
    slotSizeEquip: '90%',
    iconSize: '40px',
  },
  fonts: {
    main: 'Rajdhani, sans-serif',
  },
  labels: {
    title: 'SYSTEM INVENTORY V.2',
    closeHint: 'PRESS [TAB] TO CLOSE',
    equip: 'QUICK SLOTS (1-4)',
    bag: 'MODULAR STORAGE',
    empty: 'Empty',
    use: 'USE ITEM',
    equip_action: 'EQUIP',
    drop: 'DROP',
  },
};
