
import { SpellEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';
import { OnHitEffect } from '../../../shared/interfaces/effect';

export class VitalEssence extends SpellEffect implements OnHitEffect {

  iconData = {
    name: 'bell-shield',
    bgColor: '#0a0',
    color: '#fff',
    tooltipDesc: 'Grants you more health and armor.'
  };

  maxSkillForSkillGain = 25;
  potencyMultiplier = 15;

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.setPotencyAndGainSkill(caster, skillRef);
    this.flagPermanent(caster.uuid);
    this.flagUnapply(true);
    this.flagCasterName(caster.name);

    if(!this.charges) this.charges = 5 * this.potency;
    this.updateBuffDurationBasedOnTraits(caster);

    if(caster !== target) {
      this.casterEffectMessage(caster, { message: `You cast VitalEssence on ${target.name}.`, sfx: 'spell-buff-magical' });
    }

    this.aoeAgro(caster, 100);

    target.applyEffect(this);
  }

  effectStart(char: Character) {
    this.targetEffectMessage(char, { message: 'Your body feels more durable.', sfx: 'spell-buff-magical' });
    this.gainStat(char, 'hp', this.potency * this.potencyMultiplier);

    const acGain = Math.floor(this.potency / 2);
    this.gainStat(char, 'armorClass', acGain);

    this.iconData.tooltipDesc = `Grants you ${this.potency * this.potencyMultiplier} more health and ${acGain} AC. Each hit you take erodes your essence.`;
  }

  effectEnd(char: Character) {
    this.effectMessage(char, 'Your durability fades.');
  }

  onHit(attacker: Character, defender: Character, opts: { damage: number }) {
    if(opts.damage <= 0) return;

    this.charges--;
    if(this.charges <= 0) defender.unapplyEffect(this);
  }
}
