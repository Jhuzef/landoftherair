
import { species } from 'fantastical';
import { DateTime } from 'luxon';
import { capitalize, isString, sample, kebabCase, includes } from 'lodash';
import * as Cache from 'node-cache';

import { ItemCreator } from '../world/item-creator';
import { NPC } from '../../../shared/models/npc';
import { DB } from '../../database';
import { Player } from '../../../shared/models/player';

import * as Effects from '../../effects';
import { Item } from '../../../shared/models/item';

const isProd = process.env.NODE_ENV === 'production';

export class NPCLoader {

  cache = new Cache({ stdTTL: 600 });

  itemCreator = new ItemCreator();

  searchNPCs(name: string): Promise<NPC[]> {
    const regex = new RegExp(`.*${name}.*`, 'i');
    return DB.$npcs.find({ $or: [{ npcId: regex }, { name: regex }] }).toArray();
  }

  async loadNPCData(npcId) {

    const data = this.cache.get(npcId);
    if(data) return data;

    const npc = await DB.$npcs.findOne({ npcId });
    if(!npc) throw new Error(`NPC ${npcId} does not exist.`);

    if(isProd) this.cache.set(npcId, npc);
    return npc;
  }

  determineNPCName(npc: NPC) {
    let func = 'human';

    switch(npc.allegiance) {
      case 'None': func = 'human'; break;
      case 'Pirates': func = 'dwarf'; break;
      case 'Townsfolk': func = 'human'; break;
      case 'Royalty': func = sample(['elf', 'highelf']); break;
      case 'Adventurers': func = 'human'; break;
      case 'Wilderness': func = sample(['fairy', 'highfairy']); break;
      case 'Underground': func = sample(['goblin', 'orc', 'ogre']); break;
    }

    if(func === 'human') return species[func]({ allowMultipleNames: false });
    return species[func](sample(['male', 'female']));
  }

  loadItem(item): Promise<Item> {
    return this.itemCreator.getItemByName(item);
  }

  private async _loadVendorItems(npc: NPC, items: Array<{ name: string, valueMult: number }>): Promise<Item[]> {
    npc.vendorItems = npc.vendorItems || [];

    const loadedItems = await Promise.all(items.map(async ({ name, valueMult }) => {
      const item = await this.loadItem(name);

      item.value = Math.floor((valueMult || 1) * item.value);

      return item;
    }));

    npc.vendorItems.push(...loadedItems);

    return loadedItems;
  }

  async loadVendorItems(npc: NPC, items: any[]) {
    items = items.map(item => {
      if(isString(item)) return { name: item, valueMult: 1 };
      return item;
    });

    return this._loadVendorItems(npc, items);
  }

  async loadDailyVendorItems(npc: NPC, items: any[]) {
    items = items.map(item => {
      if(isString(item)) return { name: item, valueMult: 1 };
      return item;
    });

    const dailyItems = await this._loadVendorItems(npc, items);

    dailyItems.forEach((item, i) => {
      item.uuid = kebabCase(`${npc.name}-${item.name}-${i}`);
      item.daily = true;
    });

    return dailyItems;
  }

  checkPlayerHeldItems(player: Player, itemName1: string, itemName2: string) {
    return player.hasHeldItems(itemName1, itemName2);
  }

  checkPlayerHeldItemEitherHand(player: Player, itemName: string) {
    return player.hasHeldItem(itemName, 'right') || player.hasHeldItem(itemName, 'left');
  }

  checkPlayerHeldItemBothHands(player: Player, itemName: string) {
    return player.hasHeldItem(itemName, 'right') && player.hasHeldItem(itemName, 'left');
  }

  takePlayerItemFromEitherHand(player: Player, itemName: string) {
    if(this.takePlayerItem(player, itemName, 'right')) return;
    this.takePlayerItem(player, itemName, 'left');
  }

  checkPlayerHeldItem(player: Player, itemName: string, hand: 'left'|'right' = 'right') {
    return player.hasHeldItem(itemName, hand);
  }

  takePlayerItem(player: Player, itemName: string, hand: 'left'|'right' = 'right'): boolean {
    if(!player[`${hand}Hand`] || player[`${hand}Hand`].name !== itemName) return false;
    player[`set${capitalize(hand)}Hand`](null);
    return true;
  }

  async givePlayerItem(player: Player, itemName: string, hand: 'left'|'right' = 'right', setOwner = true) {
    const item = await this.loadItem(itemName);
    if(setOwner) {
      item.setOwner(player);
    }
    player[`set${capitalize(hand)}Hand`](item);
  }

  givePlayerEffect(player: Player, effectName: string, { potency, duration }: any = {}) {
    player.applyEffect(new Effects[effectName]({ name: effectName, potency, duration }));
  }

  getItemsFromPlayerSackByName(player: Player, name, partial = false) {
    const indexes = [];

    for(let i = 0; i < player.sack.allItems.length; i++) {
      const item = player.sack.allItems[i];

      if(!item || !item.isOwnedBy(player)) continue;

      if(partial) {
        if(!includes(item.name, name)) continue;
      } else {
        if(item.name !== name) continue;
      }

      indexes.push(i);
    }

    return indexes;
  }

  takeItemsFromPlayerSack(player: Player, sackIndexes = []): Item[] {
    return player.sack.takeItemFromSlots(sackIndexes);
  }

  getCurrentDailyDayOfYear(player: Player): number {

    const now = DateTime.fromObject({ zone: 'utc' });
    const start = DateTime.fromObject({ zone: 'utc', year: now.year, month: 1, day: 1 });
    const diff = +now - +start;
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay);

    return day + this.getDailyOffset(player);
  }

  getDailyOffset(player: Player): number {
    return player.name.charCodeAt(0);
  }
}
