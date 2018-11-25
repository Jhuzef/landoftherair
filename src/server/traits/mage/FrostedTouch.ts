
import { Trait } from '../../../shared/models/trait';

export class FrostedTouch extends Trait {

  static baseClass = 'Mage';
  static traitName = 'FrostedTouch';
  static description = 'Your ice spells freeze the opponent more quickly.';
  static icon = 'ice-spell-cast';

  static upgrades = [
    { requireCharacterLevel: 10 }, { requireCharacterLevel: 10 }, { requireCharacterLevel: 15, capstone: true }
  ];

}
