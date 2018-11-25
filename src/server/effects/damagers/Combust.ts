
import { SpellEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';
import { RollerHelper } from '../../../shared/helpers/roller-helper';

export class Combust extends SpellEffect {

  maxSkillForSkillGain = 30;
  skillMults = [[0, 6], [6, 7], [11, 8], [16, 9], [21, 10], [26, 11], [31, 15]];

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.setPotencyAndGainSkill(caster, skillRef);

    const damage = RollerHelper.diceRoll(this.getTotalDamageRolls(caster), this.getTotalDamageDieSize(caster));

    this.magicalAttack(caster, target, {
      skillRef,
      atkMsg: `You combust %0!`,
      defMsg: `%0 set you ablaze!`,
      damage,
      damageClass: 'fire'
    });
  }
}
