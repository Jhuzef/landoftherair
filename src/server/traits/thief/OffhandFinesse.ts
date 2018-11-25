
import { Trait } from '../../../shared/models/trait';

export class OffhandFinesse extends Trait {

  static baseClass = 'Thief';
  static traitName = 'OffhandFinesse';
  static description = 'Increase your offhand attack damage by $10|30$%.';
  static icon = 'crossed-sabres';

  static upgrades = [
    { }, { }, { }, { }, { requireCharacterLevel: 15, capstone: true }
  ];

  static usageModifier(level: number): number {
    return level * 0.1;
  }

}
