import type { PlayerPawn } from '../PlayerPawn';

export interface ItemMetadata {
  id: string;
  name: string;
  type: 'weapon' | 'consumable';
  icon: string;
  description: string;
  onUse?: (player: PlayerPawn) => void;
}

import pistolIcon from '../../assets/images/items/pistol.png';
import rifleIcon from '../../assets/images/items/rifle.png';
import knifeIcon from '../../assets/images/items/knife.png';
import batIcon from '../../assets/images/items/bat.png';
import healthIcon from '../../assets/images/items/health_pack.png';
import ammoIcon from '../../assets/images/items/ammo_box.png';

export const ITEM_DATABASE: Record<string, ItemMetadata> = {
  pistol: {
    id: 'pistol',
    name: 'Military Pistol',
    type: 'weapon',
    icon: pistolIcon,
    description: 'Standard sidearm. Reliable and fast.',
  },
  rifle: {
    id: 'rifle',
    name: 'Assault Rifle',
    type: 'weapon',
    icon: rifleIcon,
    description: 'Powerful long-range weapon.',
  },
  knife: {
    id: 'knife',
    name: 'Combat Knife',
    type: 'weapon',
    icon: knifeIcon,
    description: 'Sharp combat knife for silent kills.',
  },
  bat: {
    id: 'bat',
    name: 'Spiked Bat',
    type: 'weapon',
    icon: batIcon,
    description: 'Melee weapon for heavy impact.',
  },
  health_pack: {
    id: 'health_pack',
    name: 'First Aid Kit',
    type: 'consumable',
    icon: healthIcon,
    description: 'Restores 30 HP on use.',
    onUse: (player: PlayerPawn) => player.addHealth(30),
  },
  ammo_box: {
    id: 'ammo_box',
    name: 'Ammo Crate',
    type: 'consumable',
    icon: ammoIcon,
    description: 'Restores 50 rounds for all weapons.',
    onUse: (player: PlayerPawn) => player.addAmmo(50),
  },
  ammo_generic: {
    id: 'ammo_generic',
    name: 'Generic Ammo',
    type: 'consumable',
    icon: ammoIcon, // 임시로 같은 아이콘 사용 (필요 시 교체 가능)
    description: 'A few extra rounds for your weapons.',
    onUse: (player: PlayerPawn) => player.addAmmo(20),
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
