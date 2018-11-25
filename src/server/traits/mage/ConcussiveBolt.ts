
import { Trait } from '../../../shared/models/trait';

export class ConcussiveBolt extends Trait {

  static baseClass = 'Mage';
  static traitName = 'ConcussiveBolt';
  static description = 'Your Magic Bolt spell will have a $5|15$% chance to stun the enemy.';
  static icon = 'burning-dot';

  static upgrades = [
    { capstone: true }
  ];

  static usageModifier(level: number): number {
    return level ? 5 : 0;
  }

}
