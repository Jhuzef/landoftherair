
import { Trait } from '../../../shared/models/trait';
import { Player } from '../../../shared/models/player';

export class ForcefulStrike extends Trait {

  static baseClass = 'Warrior';
  static traitName = 'ForcefulStrike';
  static description = 'Strike more forcefully, dealing $10|30$% additional damage if your health is above 50%.';
  static icon = 'striped-sword';

  static upgrades = [
    { }, { }, { }, { }, { }, { }, { }, { }, { }, { }
  ];

  static currentlyInEffect(player: Player): boolean {
    return super.currentlyInEffect(player) && player.hp.gtePercent(50);
  }

  static usageModifier(level: number): number {
    return level * 10;
  }

}
