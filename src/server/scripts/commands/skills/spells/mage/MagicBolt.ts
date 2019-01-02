
import { Skill } from '../../../../../base/Skill';
import { Character } from '../../../../../../shared/models/character';
import { MagicBolt as CastEffect } from '../../../../../effects/damagers/MagicBolt';

export class MagicBolt extends Skill {

  static macroMetadata = {
    name: 'MagicBolt',
    macro: 'cast magicbolt',
    icon: 'burning-dot',
    color: '#a0a',
    mode: 'lockActivation',
    tooltipDesc: 'Inflict energy damage on a single target. Cost: 20 MP',
    skillTPCost: 10
  };

  public name = ['magicbolt', 'cast magicbolt'];
  public format = 'Target';

  mpCost(attacker: Character) {
    const energeticBolts = attacker.hasEffect('EnergeticBolts');
    if(energeticBolts) return 20 + (energeticBolts.setPotency * 3);
    return 20;
  }
  range(attacker: Character) { return 5; }

  execute(user: Character, { args, effect }) {
    if(!args) return false;

    const target = this.getTarget(user, args);
    if(!target) return;

    if(target === user) return;

    if(!this.tryToConsumeMP(user, effect)) return;

    this.use(user, target, effect);
  }

  use(user: Character, target: Character, baseEffect = {}) {
    const effect = new CastEffect(baseEffect);
    effect.cast(user, target, this);
  }

}
