
import { Trait } from '../../../shared/models/trait';

export class HolyAffliction extends Trait {

  static baseClass = 'Healer';
  static traitName = 'HolyAffliction';
  static description = 'Your single-target spells have a $3|9$% chance of doing critical damage.';
  static icon = 'large-wound';

  static upgrades = [
    { cost: 10 }, { cost: 10 }, { cost: 35, capstone: true }
  ];

  static usageModifier(level: number): number {
    return level * 3;
  }

}
