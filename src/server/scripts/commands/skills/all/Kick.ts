
import { Skill } from '../../../../base/Skill';
import { Character} from '../../../../../shared/models/character';
import { CombatHelper } from '../../../../helpers/world/combat-helper';
import { MessageHelper } from '../../../../helpers/world/message-helper';
import { Player } from '../../../../../shared/models/player';
import { SkillClassNames } from '../../../../../shared/interfaces/character';

export class Kick extends Skill {

  static macroMetadata = {
    name: 'Kick',
    macro: 'kick',
    icon: 'barefoot',
    color: '#530000',
    mode: 'lockActivation',
    tooltipDesc: 'Physically attack a target with your boots.'
  };

  public name = 'kick';
  public format = 'Target';

  requiresLearn = false;

  canUse(user: Character, target: Character) {
    return this.range(user) >= user.distFrom(target);
  }

  execute(user: Player, { args }) {
    if(!args) return false;

    const possTargets = MessageHelper.getPossibleMessageTargets(user, args);
    const target = possTargets[0];
    if(!target) return user.youDontSeeThatPerson(args);

    if(target === user) return;

    if(target.distFrom(user) > 0) return user.sendClientMessage('That target is too far away!');

    this.use(user, target);
  }

  use(user: Character, target: Character) {

    /** PERK:CLASS:WARRIOR:Warriors gain skill on physical hits. */
    if(user.baseClass === 'Warrior') user.gainSkill(SkillClassNames.Martial, 1);
    CombatHelper.physicalAttack(user, target, { attackRange: 0, isKick: true });
  }

}
