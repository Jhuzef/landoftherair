
import { SpellEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';
import { RollerHelper } from '../../../shared/helpers/roller-helper';

export class Cure extends SpellEffect {

  maxSkillForSkillGain = 7;
  skillMults = [[0, 4], [11, 6], [21, 10], [31, 15], [41, 25]];

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.setPotencyAndGainSkill(caster, skillRef);

    const damage = -RollerHelper.diceRoll(this.getTotalDamageRolls(caster), this.getTotalDamageDieSize(caster));

    this.aoeAgro(caster, Math.abs(damage / 10));

    this.magicalAttack(caster, target, {
      skillRef,
      atkMsg: `You heal %0.`,
      defMsg: `%0 healed you!`,
      damage,
      damageClass: 'heal',
      customSfx: 'spell-heal'
    });
  }
}
