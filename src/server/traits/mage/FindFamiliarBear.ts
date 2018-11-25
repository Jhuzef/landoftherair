
import { Trait } from '../../../shared/models/trait';

export class FindFamiliarBear extends Trait {

  static baseClass = 'Mage';
  static traitName = 'FindFamiliarBear';
  static description = 'You can now summon a bear, which has a lot of HP and can taunt your enemies.';
  static icon = 'eagle-emblem';

  static upgrades = [
    { requireCharacterLevel: 10, capstone: true }
  ];

}
