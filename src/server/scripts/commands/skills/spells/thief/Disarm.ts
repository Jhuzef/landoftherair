
import { Skill } from '../../../../../base/Skill';
import { Character } from '../../../../../../shared/models/character';
import { SkillClassNames } from '../../../../../../shared/interfaces/character';

export class Disarm extends Skill {

  static macroMetadata = {
    name: 'Disarm',
    macro: 'cast disarm',
    icon: 'quake-stomp',
    color: '#000053',
    mode: 'clickToActivate',
    tooltipDesc: 'Disarm a trap on an adjacent tile.'
  };

  public name = ['disarm', 'cast disarm'];
  public format = 'Dir';
  public unableToLearnFromStealing = true;

  execute(user: Character, { args }) {

    const { x, y } = user.getXYFromDir(args);

    if(x === 0 && y === 0) return user.sendClientMessage('You can\'t disarm a trap from there!');

    const targetX = user.x + x;
    const targetY = user.y + y;

    const interactable = user.$$room.state.getInteractable(targetX, targetY, true, 'Trap');
    if(!interactable) return user.sendClientMessage('There is no trap there!');

    this.use(user, { x: targetX, y: targetY });
  }

  use(user: Character, { x, y } = { x: 0, y: 0 }) {
    const trap = user.$$room.state.getInteractable(x, y, true, 'Trap');
    if(!trap) return user.sendClientMessage('There is no trap there!');

    const { setSkill, caster } = trap.properties;
    const mySkill = user.calcSkillLevel(SkillClassNames.Thievery);

    if(caster.username !== (<any>user).username) {
      if(mySkill <= setSkill) return user.sendClientMessage('You are unable to disarm the trap.');
      user.gainSkill(SkillClassNames.Thievery, 3);
    }

    user.$$room.state.removeInteractable(trap);
    user.sendClientMessage(`You disarmed the trap.`);
  }

}
