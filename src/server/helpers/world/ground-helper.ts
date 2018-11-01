
import * as scheduler from 'node-schedule';
import { Logger } from '../../logger';
import { Item } from '../../../shared/models/item';

import { compact, reject, find, includes } from 'lodash';
import { DB } from '../../database';
import { GameWorld } from '../../rooms/GameWorld';

export class GroundHelper {

  private itemGCArray: any = [];
  private tiedItemGCArray: any = [];
  private trashGCArray: any = [];
  private corpseArray: any = [];

  public get numberOfItems(): number {
    return this.itemGCArray.length;
  }

  constructor(private room: GameWorld) {}

  private isTrash(item: Item): boolean {
    return includes(item.name, ' Trash ');
  }

  private isCorpse(item: Item): boolean {
    return item.itemClass === 'Corpse';
  }

  private chooseArrayFor(item: Item): string {
    if(this.isCorpse(item)) return 'corpseArray';
    if(this.isTrash(item)) return 'trashGCArray';
    if(item.owner || item.binds) return 'tiedItemGCArray';
    return 'itemGCArray';
  }

  addItemToGround(ref, item: Item, previouslyStackedItem = null) {

    let baseItem = item;

    if(previouslyStackedItem) {
      const oldItem = find(this[this.chooseArrayFor(item)], { uuid: previouslyStackedItem.uuid });
      this.removeItemFromGround(oldItem, true);
      baseItem = previouslyStackedItem;
    }

    // we have to do this BEFORE we push, in case we're adding an item that would be instantly removed.
    while(this.trashGCArray.length + this.itemGCArray.length + this.tiedItemGCArray.length > this.room.maxItemsOnGround) {
      let arr = this.tiedItemGCArray;
      if(this.itemGCArray.length > 0) arr = this.itemGCArray;
      if(this.trashGCArray.length > 0) arr = this.trashGCArray;

      const removeItem = arr.shift();
      this.removeItemFromGround(removeItem);
    }

    const pushArr = this[this.chooseArrayFor(baseItem)];

    pushArr.push({
      uuid: baseItem.uuid,
      itemClass: baseItem.itemClass,
      name: baseItem.name,
      x: ref.x,
      y: ref.y
    });
  }

  removeItemFromGround(item, fromGW = false) {

    // inf loop protection not called from the game world, called as part of the gc above
    if(!fromGW) {
      this.room.removeItemFromGround(item, true);
      return;
    }

    this[this.chooseArrayFor(item)] = reject(this[this.chooseArrayFor(item)], (checkItem: any) => checkItem.uuid === item.uuid);
  }

  watchForItemDecay(): any {
    const rule = new scheduler.RecurrenceRule();
    rule.minute = this.room.decayChecksMinutes;

    return scheduler.scheduleJob(rule, () => {
      this.checkIfAnyItemsAreExpired();
    });
  }

  checkIfAnyItemsAreExpired() {
    const groundItems = this.room.state.groundItems;
    Logger.db(`Checking for expired items.`, this.room.state.mapName);

    Object.keys(groundItems).forEach(x => {
      Object.keys(groundItems[x]).forEach(y => {
        Object.keys(groundItems[x][y]).forEach(itemClass => {
          groundItems[x][y][itemClass] = compact(groundItems[x][y][itemClass].map(i => {
            const expired = this.room.itemCreator.hasItemExpired(i);

            if(expired) {
              const now = Date.now();
              const delta = Math.floor((now - i.expiresAt) / 1000);
              Logger.db(`Item ${i.name} has expired @ ${now} (delta: ${delta}sec).`, this.room.state.mapName, i);
              this.room.removeItemFromGround(i);
            }

            return expired ? null : new Item(i);
          }));
        });
      });
    });
  }

  async loadGround() {
    const opts: any = { mapName: this.room.state.mapName };
    if((<any>this.room).partyOwner) opts.party = (<any>this.room).partyOwner;

    let obj = await DB.$mapGroundItems.findOne(opts);
    if(!obj) obj = {};
    const groundItems = obj.groundItems || {};

    this.room.state.setGround(groundItems);

    // load existing items onto the ground
    Object.keys(groundItems).forEach(x => {
      Object.keys(groundItems[x]).forEach(y => {
        Object.keys(groundItems[x][y]).forEach(cat => {
          groundItems[x][y][cat].forEach(item => {
            this.addItemToGround(item, item);
          });
        });
      });
    });

    this.checkIfAnyItemsAreExpired();

    DB.$mapGroundItems.remove(opts);
  }

  async saveGround() {
    const opts: any = { mapName: this.room.state.mapName };
    if((<any>this.room).partyOwner) opts.party = (<any>this.room).partyOwner;
    DB.$mapGroundItems.update(opts, { $set: { groundItems: this.room.state.serializableGroundItems(), updatedAt: new Date() } }, { upsert: true });
  }

}
