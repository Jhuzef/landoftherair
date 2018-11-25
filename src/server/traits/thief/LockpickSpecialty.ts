
import { Trait } from '../../../shared/models/trait';

export class LockpickSpecialty extends Trait {

  static baseClass = 'Thief';
  static traitName = 'LockpickSpecialty';
  static description = 'Your lockpicking ability is increased by +$1|3$ skill(s).';
  static icon = 'unlocking';

  static upgrades = [
    { cost: 5 }, { cost: 5 }, { cost: 5 }, { cost: 5 }, { cost: 5 }
  ];

}
