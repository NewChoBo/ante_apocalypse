export interface ItemMetadata {
  id: string;
  name: string;
  type: 'weapon' | 'consumable';
  icon: string;
  description: string;
}

export const ITEM_DATABASE: Record<string, ItemMetadata> = {
  pistol: {
    id: 'pistol',
    name: 'Military Pistol',
    type: 'weapon',
    icon: '🔫',
    description: 'Standard sidearm. Reliable and fast.',
  },
  rifle: {
    id: 'rifle',
    name: 'Assault Rifle',
    type: 'weapon',
    icon: '🔫',
    description: 'Powerful long-range weapon.',
  },
  knife: {
    id: 'knife',
    name: 'Combat Knife',
    type: 'weapon',
    icon: '🔪',
    description: 'Sharp combat knife for silent kills.',
  },
  bat: {
    id: 'bat',
    name: 'Spiked Bat',
    type: 'weapon',
    icon: '🏏',
    description: 'Melee weapon for heavy impact.',
  },
  health_pack: {
    id: 'health_pack',
    name: 'First Aid Kit',
    type: 'consumable',
    icon: '💊',
    description: 'Restores 30 HP on use.',
  },
  ammo_box: {
    id: 'ammo_box',
    name: 'Ammo Crate',
    type: 'consumable',
    icon: '🔋',
    description: 'Restores 50 rounds for all weapons.',
  },
};

export function getItemMetadata(id: string): ItemMetadata | undefined {
  const lid = id.toLowerCase();
  // Try exact match first
  if (ITEM_DATABASE[lid]) return ITEM_DATABASE[lid];

  // Try fuzzy match for legacy support
  for (const key in ITEM_DATABASE) {
    if (lid.includes(key)) return ITEM_DATABASE[key];
  }

  return undefined;
}
