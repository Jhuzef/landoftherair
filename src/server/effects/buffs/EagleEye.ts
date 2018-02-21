
import { SpellEffect } from '../../base/Effect';
import { Character, SkillClassNames } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';

export class EagleEye extends SpellEffect {

  iconData = {
    name: 'dead-eye',
    color: '#f00',
    tooltipDesc: 'Seeing through the trees and waters.'
  };

  maxSkillForSkillGain = 15;
  skillFlag = () => SkillClassNames.Thievery;

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.setPotencyAndGainSkill(caster, skillRef);

    if(caster !== target) {
      this.casterEffectMessage(caster, `You cast EagleEye on ${target.name}.`);
    }

    this.potency = Math.floor(this.potency / 2);

    if(!this.duration) this.duration = this.potency * 30;
    this.updateDurationBasedOnTraits(caster);

    target.applyEffect(this);
  }

  effectStart(char: Character) {
    this.targetEffectMessage(char, 'Your vision expands to see through the trees and beneath the waters.');
    char.gainStat('perception', this.potency);
    char.gainStat('accuracy', this.potency);
  }

  effectEnd(char: Character) {
    this.effectMessage(char, 'Your vision returns to normal.');
    char.loseStat('perception', this.potency);
    char.loseStat('accuracy', this.potency);
  }
}
