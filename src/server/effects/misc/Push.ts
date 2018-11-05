
import { SpellEffect } from '../../base/Effect';
import { Character} from '../../../shared/models/character';
import { Skill } from '../../base/Skill';
import { random, clamp } from 'lodash';
import { Stun } from '../antibuffs/Stun';
import { RollerHelper } from '../../../shared/helpers/roller-helper';
import { StatName } from '../../../shared/interfaces/character';

export class Push extends SpellEffect {

  maxSkillForSkillGain = 15;

  cast(caster: Character, target: Character, skillRef?: Skill) {
    if((<any>target).hostility === 'Never' || target.isNaturalResource) return caster.sendClientMessage('How rude.');
    if(target.hasEffect('Unshakeable')) return;

    target.addAgro(caster, 5);

    const predetermined = this.potency;

    if(!predetermined) {
      this.setPotencyAndGainSkill(caster, skillRef);
    }

    const userStat = caster.baseClass === 'Healer' ? 'wis' : 'int';
    const resistStat = predetermined ? 'con' : 'wil';

    const baseStat = caster.getTotalStat(<StatName>userStat);
    const targetStat = target.getTotalStat(<StatName>resistStat);

    const successChance = clamp((baseStat - targetStat) + 4, 0, 8) * 12.5;

    if(!RollerHelper.XInOneHundred(successChance)) {
      if(!predetermined) caster.sendClientMessage(`${target.name} resisted your push!`);
      return;
    }

    let x = 0;
    let y = 0;

    if(target.x > caster.x) {
      x = 1;

    } else if(target.x < caster.x) {
      x = -1;
    }

    if(target.y > caster.y) {
      y = 1;

    } else if(target.y < caster.y) {
      y = -1;
    }

    if(x === 0 && y === 0) {
      x = random(-1, 1);
      y = random(-1, 1);
    }

    // first, try to push them in a direction
    const didFirstPushWork = target.takeSequenceOfSteps([{ x, y }], false, true);
    let didSecondPushWork = false;

    // then, try to push them randomly if the first fails
    if(!didFirstPushWork) {
      didSecondPushWork = target.takeSequenceOfSteps([{ x: random(-1, 1), y: random(-1, 1) }], false, true);
    }

    if(didFirstPushWork || didSecondPushWork) {
      this.effectMessageRadius(target, `${target.name} was knocked down!`, 5);
    } else {
      this.effectMessageRadius(target, `${target.name} was knocked over!`, 5);

      const stunned = new Stun({ duration: 1, potency: 1 });
      stunned.cast(caster, target);
    }
  }
}
