
import { Trait } from '../../models/trait';

export class TotemSpecialty extends Trait {

  static baseClass = 'Healer';
  static traitName = 'TotemSpecialty';
  static description = 'Spells cost $2|6$% less to cast while holding a totem in your right hand.';
  static icon = 'grapple';

  static upgrades = [
    { requireCharacterLevel: 10 }, { requireCharacterLevel: 10 }, { requireCharacterLevel: 15, capstone: true }
  ];

  static usageModifier(level: number): number {
    return level * 0.05;
  }

}
