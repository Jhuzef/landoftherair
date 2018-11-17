
import { Trait } from '../../models/trait';
import { Player } from '../../models/player';

import { get, includes } from 'lodash';
import { RobeClasses } from '../../interfaces/item';
import { Character } from '../../models/character';

export class UnarmoredSavant extends Trait {

  static baseClass = 'Warrior';
  static traitName = 'UnarmoredSavant';
  static description = 'You will have 60 base mitigation if you are using a fur, robe, or cloak in your main armor slot.';
  static icon = 'robe';

  static upgrades = [
    { cost: 30, capstone: true }
  ];

  static currentlyInEffect(player: Player): boolean {
    const itemClass = get(player, 'gear.Armor.itemClass');
    return super.currentlyInEffect(player) && (includes(RobeClasses, itemClass) || itemClass === 'Fur');
  }

  static usageModifier(level: number, char: Character): number {
    if(!level) return 0;

    const itemClass = get(char, 'gear.Armor.itemClass');
    if(itemClass === 'Fur') return 50;

    return 60;
  }

}
