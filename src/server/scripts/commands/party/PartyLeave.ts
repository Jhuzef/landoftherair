
import { Command } from '../../../base/Command';
import { Player } from '../../../../shared/models/player';

export class PartyLeave extends Command {

  public name = 'party leave';

  execute(player: Player, { room }) {
    if(!player.party) return player.sendClientMessage('You are not in a party!');
    room.partyManager.leaveParty(player);

    if(!room.canPartyAction) {
      room.kickOut(player);
    }
  }

}
