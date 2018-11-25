
import { Trait } from '../../../shared/models/trait';

export class StrongMind extends Trait {

  static baseClass = 'Mage';
  static traitName = 'StrongMind';
  static description = 'Add $100|100$% of your INT to your STR in melee combat.';
  static icon = 'brain';

  static upgrades = [
    { cost: 50, requireCharacterLevel: 15, capstone: true }
  ];

}
