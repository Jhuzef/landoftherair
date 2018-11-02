
import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';

export class LeftToPotion extends Command {

  public name = '~LtP';
  public format = '';

  execute(player: Player) {
    const left = player.leftHand;
    if(this.isBusy(player)) return;
    if(!left) return;

    if(left.itemClass !== 'Bottle') return player.sendClientMessage('That item is not a bottle.');

    if(player.potionHand) return player.sendClientMessage('Your potion slot is occupied.');

    player.setPotionHand(left);
    player.setLeftHand(null);
  }

}
