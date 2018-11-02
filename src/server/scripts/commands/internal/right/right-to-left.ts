
import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';

export class RightToLeft extends Command {

  public name = '~RtL';
  public format = '';

  execute(player: Player) {
    if(this.isBusy(player)) return;
    const left = player.leftHand;
    const right = player.rightHand;

    player.setRightHand(left, false);
    player.setLeftHand(right, false);
    player.recalculateStats();
  }

}
