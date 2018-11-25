
import { Trait } from '../../../shared/models/trait';

export class CalmMind extends Trait {

  static baseClass = 'Healer';
  static traitName = 'CalmMind';
  static description = 'Gain +$2|6$ to your mana regeneration.';
  static icon = 'psychic-waves';

  static upgrades = [
    { }, { }, { requireCharacterLevel: 15, capstone: true }
  ];

  static usageModifier(level: number): number {
    return level * 2;
  }

}
