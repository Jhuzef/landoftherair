import { NPC } from '../../../../../shared/models/npc';
import { NPCLoader } from '../../../../helpers/npc-loader';

import { DailyKillApprentices, DailyKillRebels, DailyKillRenegades } from '../../../../quests';

export const setup = async (npc: NPC) => {
  npc.hostility = 'Never';

  npc.gear.Armor = await NPCLoader.loadItem('Antanian Tunic');
  npc.recalculateStats();
};

export const responses = (npc: NPC) => {

  const allQuests = [DailyKillRenegades, DailyKillRebels, DailyKillApprentices];
  const questTodayIndex = new Date().getDate() % allQuests.length;
  const allQuestModifiers = ['renegades', 'rebels', 'apprentices'];

  const questToday = allQuests[questTodayIndex];

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      if(!player.canDoDailyQuest(npc.name)) {
        return 'Thanks, but you\'ve done all you can today. Come back tomorrow - I\'m sure there\'ll be work for you.';
      }

      if(player.hasQuest(questToday)) {
        if(questToday.isComplete(player)) {
          questToday.completeFor(player);
          player.completeDailyQuest(npc.name);

          return 'Thank you for taking care of that for me. You\'ve done this town a great service. Here\'s your reward.';
        }

        return questToday.incompleteText(player);
      }

      player.startQuest(questToday);
      
      return `Hello, ${player.name}! Our troubles seem to change daily here in Rylt. Can you help us out today by killing some ${allQuestModifiers[questTodayIndex]}?`;
    });

};
