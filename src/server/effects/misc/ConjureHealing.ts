
import { SpellEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';
import { SkillClassNames } from '../../../shared/interfaces/character';

export class ConjureHealing extends SpellEffect {

  maxSkillForSkillGain = 20;

  async cast(caster: Character, target: Character, skillRef?: Skill) {
    this.setPotencyAndGainSkill(caster, skillRef);

    if(caster.rightHand) return caster.sendClientMessage('You must empty your right hand!');

    caster.sendClientMessage({ message: 'You channel your magical energies into a bottle.', sfx: 'spell-conjure' });

    const water = await caster.$$room.itemCreator.getItemByName('Conjured Healing Potion');

    water.setOwner(caster);

    water.ounces = caster.calcSkillLevel(SkillClassNames.Conjuration) + 1;
    water.effect.potency = caster.calcSkillLevel(SkillClassNames.Conjuration) * 50;

    caster.setRightHand(water);
  }
}
