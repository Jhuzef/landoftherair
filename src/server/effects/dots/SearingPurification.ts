
import { Character } from '../../../shared/models/character';
import { CombatHelper } from '../../helpers/world/combat-helper';
import { Skill } from '../../base/Skill';
import { SpellEffect } from '../../base/Effect';
import { RollerHelper } from '../../../shared/helpers/roller-helper';

export class RecentlyPurified extends SpellEffect {

  iconData = {
    name: 'fireflake',
    color: '#000',
    tooltipDesc: 'Recently purified and cannot be purified for a period.'
  };

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.duration = Math.floor(10 / (1 - caster.getTraitLevelAndUsageModifier('SustainedImmunity')));
    target.applyEffect(this);
  }
}

export class SearingPurification extends SpellEffect {

  iconData = {
    name: 'fireflake',
    color: '#f50',
    tooltipDesc: 'Being purified by holy light.'
  };

  skillMults = [[0, 3], [6, 3.5], [11, 4], [16, 4.5], [21, 5], [26, 5.5], [31, 7], [36, 9], [41, 12]];

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.hasSkillRef = !!skillRef;

    let damage = RollerHelper.diceRoll(this.getTotalDamageRolls(caster), this.getTotalDamageDieSize(caster));
    if(target.alignment === caster.alignment) damage = Math.floor(damage * 0.1);

    this.effectInfo = { damage, damageFactor: caster.getTotalStat('damageFactor'), caster: caster.uuid };
    this.duration = 5;
    this.updateDebuffDurationBasedOnTraits(caster);
    this.flagCasterName(caster.name);
    target.applyEffect(this);
  }

  effectStart(char: Character) {
    this.effectMessage(char, 'A searing pain courses through your body!');
  }

  effectTick(char: Character) {
    const caster = char.$$room.state.findCharacter(this.effectInfo.caster);

    char.mp.sub(Math.floor(char.mp.maximum * 0.02));

    CombatHelper.magicalAttack(caster, char, {
      effect: this,
      atkMsg: `${char.name} is getting seared alive!`,
      defMsg: `You are getting seared alive!`,
      damage: this.effectInfo.damage,
      damageClass: 'fire',
      isOverTime: true
    });

  }

  effectEnd(char: Character) {
    this.effectMessage(char, 'Your body is no longer searing on the inside.');

    const recently = new RecentlyPurified({});
    recently.cast(char, char);
  }

}
