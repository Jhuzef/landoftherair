
import { Trait } from '../../../shared/models/trait';
import { Player } from '../../../shared/models/player';

export class MirroredEnchantments extends Trait {

  static baseClass = 'Warrior';
  static traitName = 'MirroredEnchantments';
  static description = `The potency of gems and runes in your boots and gloves are doubled while your right hand is empty. 
  You cannot exceed an encrusted gem max limit or trait cap in this fashion.`;
  static icon = 'emerald';

  static upgrades = [
    { cost: 30, capstone: true }
  ];

  static currentlyInEffect(player: Player): boolean {
    return super.currentlyInEffect(player) && !player.rightHand;
  }

}
