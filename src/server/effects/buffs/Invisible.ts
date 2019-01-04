
import { SpellEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';

export class Invisible extends SpellEffect {

  iconData = {
    name: 'invisible',
    color: '#000',
    tooltipDesc: 'Hidden from the average sight.'
  };

  maxSkillForSkillGain = 20;

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.setPotencyAndGainSkill(caster, skillRef);
    this.flagUnapply();
    this.flagCasterName(caster.name);

    if(!this.duration) this.duration = 300 * this.potency;
    this.updateBuffDurationBasedOnTraits(caster);

    if(caster !== target) {
      this.casterEffectMessage(caster, { message: `You cast Invisibility on ${target.name}.`, sfx: 'spell-sight-effect' });
    }

    this.aoeAgro(caster, 100);

    target.applyEffect(this);
  }

  effectStart(char: Character) {
    this.targetEffectMessage(char, { message: 'You can see through yourself!', sfx: 'spell-sight-effect' });

    // add some stealth so it triggers transparency on the client
    this.gainStat(char, 'stealth', 1);
  }

  effectEnd(char: Character) {
    this.effectMessage(char, 'You are once again opaque.');
  }
}
