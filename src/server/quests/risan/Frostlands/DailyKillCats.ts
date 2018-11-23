
import { clone, includes } from 'lodash';

import { Quest } from '../../../base/Quest';
import { Player } from '../../../../shared/models/player';
import { HolidayHelper } from '../../../../shared/helpers/holiday-helper';

export class DailyKillCats extends Quest {

  public static isRepeatable = true;
  static killsRequired = 15;

  public static get requirements() {
    return {
      type: 'kill',
      npcIds: [
        'Frostlands Sabretooth',
        'Frostfang'
      ]
    };
  }

  public static get initialData(): any {
    return clone({ kills: 0 });
  }

  public static canUpdateProgress(player: Player, questOpts: any = {}): boolean {
    return questOpts.kill && includes(this.requirements.npcIds, questOpts.kill);
  }

  public static updateProgress(player: Player, questOpts: any = {}): void {
    const { kills } = player.getQuestData(this);

    const structure = this.initialData;
    structure.kills = kills + 1;

    if(structure.kills <= this.killsRequired) {
      player.sendQuestMessage(this, `You have killed ${structure.kills}/${this.killsRequired} cats.`);
    }

    player.setQuestData(this, structure);
  }

  public static isComplete(player: Player): boolean {
    const { kills } = player.getQuestData(this);

    return kills >= this.killsRequired;
  }

  public static incompleteText(player: Player): string {
    const { kills } = player.getQuestData(this);

    return `Thanks for offering your help. You have to kill ${this.killsRequired - kills} more cats.`;
  }

  public static completeFor(player: Player): void {
    this.givePlayerRewards(player);
    player.completeQuest(this);
  }

  public static givePlayerRewards(player: Player): void {
    this.rewardPlayerGold(player, 50000);
    player.gainExp(1500000);
    player.$$room.partyManager.giveAccountSilver(player.username, 4);

    const gainedResetPoints = player.skillTree.canGainResetPoints ? 2 : 0;
    player.skillTree.gainResetPoints(gainedResetPoints);
    player.sendClientMessage(`You received 1,500,000 XP, 50,000 gold, 4 silver and ${gainedResetPoints} RP!`);

    HolidayHelper.tryGrantHolidayTokens(player, 50);
  }
}
