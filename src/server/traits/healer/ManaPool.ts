
import { Trait } from '../../../shared/models/trait';

export class ManaPool extends Trait {

  static baseClass = 'Healer';
  static traitName = 'ManaPool';
  static description = 'Gain +$10|30$ additional mana.';
  static icon = 'drink-me';

  static upgrades = [
    { }, { }, { requireCharacterLevel: 15, capstone: true }
  ];

  static usageModifier(level: number): number {
    return level * 10;
  }

}
