
import { Trait } from '../../../shared/models/trait';

export class NaturalArmor extends Trait {

  static traitName = 'NaturalArmor';
  static description = 'Harden your skin, increasing your natural armor class by $2|6$.';
  static icon = 'internal-injury';

  static upgrades = [
    { }, { }, { requireCharacterLevel: 15, capstone: true }
  ];

  static usageModifier(level: number): number {
    return level * 2;
  }

}
