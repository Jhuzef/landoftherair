

import { MonsterSkill } from '../../../../base/Skill';
import { Character } from '../../../../../shared/models/character';
import { Disease as CastEffect } from '../../../../effects/dots/Disease';
import { CombatHelper } from '../../../../helpers/world/combat-helper';
import { RollerHelper } from '../../../../../shared/helpers/roller-helper';

export class DiseaseBiteWeak extends MonsterSkill {

  name = 'diseasebiteweak';

  canUse(user: Character, target: Character) {
    return user.distFrom(target) <= this.range() && !target.hasEffect('Disease');
  }

  use(user: Character, target: Character) {
    const damage = RollerHelper.diceRoll(2, user.getTotalStat('str'));
    CombatHelper.dealDamage(user, target, {
      damage,
      damageClass: 'physical',
      attackerDamageMessage: '',
      defenderDamageMessage: `%0 bit you!`
    });
    const effect = new CastEffect({ potency: 5, duration: 10 });
    effect.cast(user, target, this);
  }

}
