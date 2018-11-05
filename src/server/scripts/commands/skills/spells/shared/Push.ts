


import { Skill } from '../../../../../base/Skill';
import { Character} from '../../../../../../shared/models/character';
import { Push as CastEffect } from '../../../../../effects/misc/Push';
import { StatName } from '../../../../../../shared/interfaces/character';

export class Push extends Skill {

  static macroMetadata = {
    name: 'Push',
    macro: 'cast push',
    icon: 'swirl-string',
    color: '#000',
    mode: 'clickToTarget',
    tooltipDesc: 'Push an enemy around. Cost: 25 MP'
  };

  public name = ['push', 'cast push'];

  mpCost() { return 25; }
  range(attacker: Character) { return 5; }

  canUse(user: Character, target: Character) {
    if(!super.canUse(user, target)) return false;

    const userStat = user.baseClass === 'Healer' ? 'wis' : 'int';

    const baseStat = user.getTotalStat(<StatName>userStat);
    const targetStat = target.getTotalStat('wil');

    return (baseStat - targetStat) + 4 > 0;
  }

  execute(user: Character, { args, effect }) {

    const target = this.getTarget(user, args, true);
    if(!target) return;

    if(target === user) return;

    if(!this.tryToConsumeMP(user, effect)) return;

    this.use(user, target);
  }

  use(user: Character, target: Character, baseEffect = {}) {
    const effect = new CastEffect(baseEffect);
    effect.cast(user, target, this);
  }

}
