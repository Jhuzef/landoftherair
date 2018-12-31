
import { compact, get } from 'lodash';

import { SkillClassNames } from '../../../shared/interfaces/character';
import { Player } from '../../../shared/models/player';
import { Item } from '../../../shared/models/item';

export class AlchemyHelper {
  static async alchemize(player: Player): Promise<Item> {
    const reagents = player.tradeSkillContainers.alchemy.reagents;
    const playerSkill = player.calcSkillLevel(SkillClassNames.Alchemy);

    player.setTradeskillBusy();

    const reagentNames = compact(reagents.map(x => x ? x.name : null));
    let recipeMatch = await player.$$room.itemCreator.getRecipe({
      recipeType: 'alchemy',
      ingredients: { $all: reagentNames, $size: reagentNames.length },
      requiredSkill: { $lte: playerSkill }
    });

    if(recipeMatch) {
      const ingredients = recipeMatch.ingredients.sort();
      const alchemyItems = reagentNames.sort();

      for(let i = 0; i < ingredients.length; i++) {
        if(ingredients[i] !== alchemyItems[i]) recipeMatch = null;
      }
    }

    let returnedItem = null;

    if(recipeMatch) {
      const { item, skillGained, maxSkillForGains, xpGained } = recipeMatch;
      returnedItem = await player.$$room.itemCreator.getItemByName(item, player.$$room);

      const baseEffectValue = get(returnedItem, 'effect.duration');
      if(baseEffectValue && baseEffectValue > 0 && playerSkill > 0) {
        returnedItem.effect.duration += Math.floor(baseEffectValue * 0.1 * playerSkill);
      }

      player.gainExp(xpGained);

      if(playerSkill < maxSkillForGains) {
        player.gainSkill(SkillClassNames.Alchemy, skillGained, true);
      }

      player.$$statistics.craftAlchemy();

    } else {
      returnedItem = await player.$$room.itemCreator.getItemByName('Alchemical Mistake', player.$$room);
    }

    player.tradeSkillContainers.alchemy.clearReagents();
    player.tradeSkillContainers.alchemy.result = returnedItem;

    player.setTradeskillFree();

    return returnedItem;
  }
}
