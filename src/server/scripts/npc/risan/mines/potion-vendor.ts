import { NPC } from '../../../../../shared/models/npc';
import { VendorResponses } from '../../common-responses';

export const setup = async (npc: NPC) => {
  npc.hostility = 'Never';
  npc.affiliation = 'Potion Vendor';

  const vendorItems = [
    'Mend Bottle',
    'Mend Bottle (5oz)',
    'Instant Heal Bottle',
    'Instant Heal Bottle (5oz)',
    'Scribe Scroll',
    'Ink Vial',
    'Ink Vial (15oz)',
    'Antanian Slice of Bread',
    'Antanian Loaf of Bread',
    'Antanian Bottle of Water',
    'Antanian Pint of Water',
    'Empty Bottle',
    { name: 'Revive Ring', valueMult: 25 },
    { name: 'Transmute Ring', valueMult: 25 },
    { name: 'EagleEye Ring', valueMult: 25 },
    { name: 'DarkVision Ring', valueMult: 25 }
  ];

  npc.$$room.npcLoader.loadVendorItems(npc, vendorItems);

  npc.rightHand = await npc.$$room.npcLoader.loadItem('Instant Heal Bottle');
  npc.gear.Armor = await npc.$$room.npcLoader.loadItem('Risan Tunic');
  npc.recalculateStats();
};

export const responses = (npc: NPC) => {
  VendorResponses(npc);
};
