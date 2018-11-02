
import { isUndefined } from 'lodash';

import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';

export class EquipToLeft extends Command {

  public name = '~EtL';
  public format = 'ItemSlot';

  execute(player: Player, { args }) {
    const slot = args;
    if(this.isBusy(player)) return;
    if(isUndefined(slot)) return false;

    const item = player.gear[slot];
    if(!item) return false;

    if(!player.hasEmptyHand()) return player.sendClientMessage('Your hands are full.');
    this.trySwapLeftToRight(player);

    player.unequip(slot);
    player.setLeftHand(item);
  }

}
