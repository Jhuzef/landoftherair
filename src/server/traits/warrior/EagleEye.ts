
import { Trait } from '../../../shared/models/trait';

export class EagleEye extends Trait {

  static baseClass = 'Warrior';
  static traitName = 'EagleEye';
  static description = 'Sharpen your vision, increasing your accuracy by $1|3$.';
  static icon = 'bullseye';

  static upgrades = [
    { }, { }, { }, { }, { capstone: true }
  ];
}
