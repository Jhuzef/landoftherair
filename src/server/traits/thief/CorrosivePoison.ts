
import { Trait } from '../../../shared/models/trait';

export class CorrosivePoison extends Trait {

  static baseClass = 'Thief';
  static traitName = 'CorrosivePoison';
  static description = 'Your Poison spell will also lower the mitigation of the afflicted target.';
  static icon = 'poison-gas';

  static upgrades = [
    { cost: 10, capstone: true }
  ];

}
