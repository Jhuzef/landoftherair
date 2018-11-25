
import { SpellEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { CombatHelper } from '../../helpers/world/combat-helper';
import { Skill } from '../../base/Skill';
import { RollerHelper } from '../../../shared/helpers/roller-helper';

export class Poison extends SpellEffect {

  iconData = {
    name: 'poison-gas',
    color: '#0a0',
    tooltipDesc: 'Constantly receiving poison damage.'
  };

  maxSkillForSkillGain = 25;
  skillMults = [[0, 1], [6, 1.25], [11, 1.5], [16, 1.75], [21, 2], [26, 2.25], [31, 3.25], [36, 5], [41, 7]];

  private critBonus: number;
  private thiefCorrode: number;

  cast(caster: Character, target: Character, skillRef?: Skill) {

    this.setPotencyAndGainSkill(caster, skillRef);

    const mult = this.getMultiplier();

    const wisCheck = this.getTotalDamageDieSize(caster);
    const totalPotency = Math.floor(mult * this.getTotalDamageRolls(caster));
    const damage = RollerHelper.diceRoll(totalPotency, wisCheck);

    this.duration = this.duration || this.potency * 2;

    if(caster.getTraitLevel('CorrosivePoison')) {
      this.thiefCorrode = Math.round(this.potency / 5);
    }

    this.effectInfo = { damage, damageFactor: caster.getTotalStat('damageFactor'), caster: caster.uuid };
    this.flagCasterName(caster.name);
    target.applyEffect(this);
    this.effectMessage(caster, { message: `You poisoned ${target.name}!`, sfx: 'spell-debuff-give' });
  }

  effectStart(char: Character) {
    this.effectMessage(char, { message: 'You were poisoned!', sfx: 'spell-debuff-receive' });

    if(this.thiefCorrode) {
      this.iconData.tooltipDesc = `${this.iconData.tooltipDesc} Mitigation penalty.`;
      this.loseStat(char, 'mitigation', this.thiefCorrode);
    }
  }

  effectTick(char: Character) {
    const caster = char.$$room.state.findCharacter(this.effectInfo.caster);

    let isCrit = false;

    if(RollerHelper.XInOneHundred(this.critBonus * 100)) {
      isCrit = true;
    }

    CombatHelper.magicalAttack(caster, char, {
      effect: this,
      atkMsg: `${char.name} is ${isCrit ? 'critically ' : ''}poisoned!`,
      defMsg: `You are ${isCrit ? 'critically ' : ''}poisoned!`,
      damage: this.effectInfo.damage * (isCrit ? 3 : 1),
      damageClass: 'poison',
      isOverTime: true
    });

  }

  effectEnd(char: Character) {
    this.effectMessage(char, 'Your body flushed the poison out.');
  }
}
