import { NPC } from '../../../../shared/models/npc';
import { NPCLoader } from '../../../helpers/npc-loader';
import { BaseClassTrainerResponses, RecallerResponses, ReviverResponses } from '../common-responses';
import { SkillClassNames } from '../../../../shared/models/character';

const learnedSkills = { Restoration: {
  1: ['Cure'],
  2: ['Afflict'],
  3: ['TrueSight'],
  4: ['Antidote', 'BarFire'],
  5: ['Poison', 'BarFrost'],
  6: ['BarNecro'],
  7: ['Revive'],
  8: ['Succor'],
  9: ['Light'],
  10: ['Disease'],
  11: ['Stun'],
  12: ['Push'],
  13: ['Regen'],
  14: ['Augury'],
  15: ['Autoheal']
} };

export const setup = async (npc: NPC) => {
  npc.hostility = 'Never';

  npc.gear.Armor = await NPCLoader.loadItem('Antanian Studded Tunic');
  npc.rightHand = await NPCLoader.loadItem('Antanian Staff');
  npc.classTrain = 'Healer';
  npc.trainSkills = [SkillClassNames.Restoration, SkillClassNames.Mace, SkillClassNames.Staff];
  npc.recalculateStats();
};

export const responses = (npc: NPC) => {
  BaseClassTrainerResponses(npc, learnedSkills);
  RecallerResponses(npc);
  ReviverResponses(npc);
};
