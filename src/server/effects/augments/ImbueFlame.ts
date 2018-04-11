
import { random } from 'lodash';

import { AugmentSpellEffect, ImbueEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';

export class ImbueFlame extends ImbueEffect implements AugmentSpellEffect {

  iconData = {
    name: 'magic-palm',
    color: '#a00',
    tooltipDesc: 'Physical attacks sometimes do bonus fire damage.'
  };

  maxSkillForSkillGain = 21;
  potencyMultiplier = 10;

  cast(caster: Character, target: Character, skillRef?: Skill) {
    const foundSelf = super.cast(caster, target, skillRef);
    if(foundSelf) return foundSelf;

    this.setPotencyAndGainSkill(caster, skillRef);
    this.flagUnapply();
    this.flagCasterName(caster.name);

    if(!this.duration) this.duration = 30 * this.potency;
    this.updateDurationBasedOnTraits(caster);

    if(caster !== target) {
      this.casterEffectMessage(caster, `You cast Imbue Flame on ${target.name}.`);
    }

    this.aoeAgro(caster, 10);

    target.applyEffect(this);
  }

  effectStart(char: Character) {
    this.targetEffectMessage(char, 'A whirling red aura envelops your hands.');

    this.iconData.tooltipDesc = `Physical attacks sometimes do ${this.potency * this.potencyMultiplier} bonus fire damage.`;
  }

  effectEnd(char: Character) {
    this.effectMessage(char, 'Your hands lose their red glow.');
  }

  augmentAttack(attacker: Character, defender: Character, opts: { damage: number, damageClass: string }) {

    if(opts.damageClass !== 'physical') return;
    if(random(0, 100) > this.potency) return;

    this.magicalAttack(attacker, defender, {
      atkMsg: `You strike for bonus fire damage!`,
      defMsg: `${this.getCasterName(attacker, defender)} struck you with a burst of raw heat!`,
      damage: this.potency * this.potencyMultiplier,
      damageClass: 'fire'
    });
  }
}
