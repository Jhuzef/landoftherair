
import { sample } from 'lodash';

import { NPC } from '../../../../../shared/models/npc';
import { RollerHelper } from '../../../../../shared/helpers/roller-helper';
import { LootHelper } from '../../../../helpers/world/loot-helper';
import { Currency } from '../../../../../shared/helpers/holiday-helper';

export const setup = async (npc: NPC) => {
  npc.hostility = 'Never';
  npc.affiliation = 'Lost Turkey';

  npc.rightHand = await npc.$$room.npcLoader.loadItem('Thanksgiving Turkey Feather');
  npc.gear.Armor = await npc.$$room.npcLoader.loadItem('Thanksgiving Turkey Skin');

  npc.recalculateStats();
};

const tokenTable = [
  { result: 1,      chance: 15  },
  { result: 10,     chance: 500 },
  { result: 15,     chance: 500 },
  { result: 25,     chance: 500 },
  { result: 50,     chance: 200 },
  { result: 100,    chance: 5   },
  { result: 1000,   chance: 3   },
  { result: 5000,   chance: 1   }
];

const itemTable = [
  { chance: 1500, result: 'Thanksgiving Corn' },
  { chance: 1500, result: 'Thanksgiving Cornbread' },
  { chance: 1000, result: 'Thanksgiving Heal Bottle (XS)' },
  { chance: 600,  result: 'Rune Scroll - Slow Digestion I' },
  { chance: 400,  result: 'Thanksgiving Arrows' },
  { chance: 300,  result: 'Gold Coin' },
  { chance: 200,  result: 'Thanksgiving Gem' },
  { chance: 175,  result: 'Thanksgiving Heal Bottle (SM)' },
  { chance: 150,  result: 'Rune Scroll - Slow Digestion II' },
  { chance: 150,  result: 'Thanksgiving Bead Amulet' },
  { chance: 100,  result: 'Rune Scroll - Slow Digestion III' },
  { chance: 150,  result: 'Thanksgiving Heal Bottle (MD)' },
  { chance: 65,   result: 'Antanian Charisma Potion' },
  { chance: 35,   result: 'Rune Scroll - Slow Digestion IV' },
  { chance: 15,   result: 'Thanksgiving Heal Bottle' },
  { chance: 1,    result: 'Thanksgiving Pilgrim Hat' },
  { chance: 1,    result: 'Thanksgiving Pilgrim Boots' },
  { chance: 1,    result: 'Thanksgiving Pilgrim Cloak' },
  { chance: 1,    result: 'Thanksgiving Gobbler Staff' },
  { chance: 1,    result: 'Rune Scroll - Slow Digestion V' }
];

export const responses = (npc: NPC) => {

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Gobble? Gobble gobble?';

      if(player.rightHand) {
        if(player.rightHand.name === 'Thanksgiving Turkey Feather') {

          if(RollerHelper.XInOneHundred(90)) {
            LootHelper.rollAnyTable(tokenTable).then(([numTokens]) => {
              player.sendClientMessage({ message: `Koda hands you ${numTokens} holiday tokens!`, grouping: 'always' });
              player.earnCurrency(Currency.Thanksgiving, numTokens, 'Koda');
              player.setRightHand(null);
            });

          } else {

            LootHelper.rollSingleTable(itemTable, npc.$$room).then(([item]) => {
              if(item.name === 'Gold Coin') {
                const value = sample([25000, 50000, 75000, 100000]);
                item.value = value;
              }

              player.setRightHand(item);
            });
          }

          return 'Gobble!';
        }

        return 'Gobble?';
      }

      return 'Gobble! Gobble gobble! Gobble? Gobble!';
    });
};
