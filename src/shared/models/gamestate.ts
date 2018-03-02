
import { cloneDeep, reject, filter, extend, find, pull, size, pick, minBy, includes, reduce, get, endsWith } from 'lodash';

import { Player } from './player';

import * as Mrpas from 'mrpas';
import { Item } from './item';
import { NPC } from './npc';
import { Character } from './character';
import { GetGidDescription, GetSwimLevel } from '../../server/gidmetadata/descriptions';
import { CombatHelper } from '../../server/helpers/combat-helper';
import { MapLayer } from './maplayer';
import { nonenumerable } from 'nonenumerable';
import { LootHelper } from '../../server/helpers/loot-helper';

enum TilesWithNoFOVUpdate {
  Empty = 0,
  Air = 2386
}

export class GameState {

  public isDisposing: boolean;

  @nonenumerable
  private players: Player[] = [];

  @nonenumerable
  private maintainedPlayerHash: any = {};

  @nonenumerable
  private playerClientIdHash: any = {};

  private playerHash: any = {};

  @nonenumerable
  map: any = {};
  mapName = '';
  mapData: any = { openDoors: {} };

  @nonenumerable
  _mapNPCs: NPC[] = [];

  @nonenumerable
  mapNPCs: any = {};

  @nonenumerable
  groundItems: any = {};

  @nonenumerable
  simpleGroundItems: any = {};

  @nonenumerable
  fov: Mrpas;

  @nonenumerable
  private secretWallHash = {};

  private createdId: string|number;

  environmentalObjects: any[] = [];

  private darkness: any = {};

  @nonenumerable
  public trimmedNPCs: any = {};

  private npcVolatile: any = {};

  get formattedMap() {
    const map = cloneDeep(this.map);
    map.layers.length = 10;
    delete map.properties;
    delete map.propertytypes;

    const mapWallTiles = map.layers[MapLayer.Walls].data;

    // clear air tiles that are on the wall layer because they're see-through
    for(let i = 0; i < mapWallTiles.length; i++) {
      if(mapWallTiles[i] === TilesWithNoFOVUpdate.Air) mapWallTiles[i] = TilesWithNoFOVUpdate.Empty;
    }

    return map;
  }

  get maxSkill(): number {
    return this.map.properties.maxSkill || 1;
  }

  get allPossibleTargets(): Character[] {
    return (<any>this.players).concat(this._mapNPCs);
  }

  get allPlayers(): Player[] {
    return this.players;
  }

  constructor(opts) {
    extend(this, opts);
    this.initFov();
    this.findSecretWalls();
  }

  private findSecretWalls() {
    const allPossibleLayers = this.map.layers[MapLayer.OpaqueDecor].objects;
    const secretWalls = filter(allPossibleLayers, { type: 'SecretWall' });
    secretWalls.forEach(({ x, y }) => {
      this.secretWallHash[x / 64] = this.secretWallHash[x / 64] || {};
      this.secretWallHash[x / 64][(y / 64) - 1] = true;
    });
  }

  private initFov() {
    const denseLayer = this.map.layers[MapLayer.Walls].data;
    const opaqueObjects = this.map.layers[MapLayer.OpaqueDecor].objects;
    opaqueObjects.forEach(obj => obj.opacity = 1);

    const denseObjects = this.map.layers[MapLayer.DenseDecor].objects;
    denseObjects.forEach(obj => obj.density = 1);

    const interactables = this.map.layers[MapLayer.Interactables].objects;
    interactables.forEach(obj => {
      if(obj.type === 'Door') {
        obj.opacity = 1;
        obj.density = 1;
      }
    });

    const checkObjects = opaqueObjects.concat(interactables);

    this.fov = new Mrpas(this.map.width, this.map.height, (x, y) => {
      const tile = denseLayer[(y * this.map.width) + x];
      if(tile === TilesWithNoFOVUpdate.Empty || tile === TilesWithNoFOVUpdate.Air) {
        const object = find(checkObjects, { x: x * 64, y: (y + 1) * 64 });
        return !object || (object && !object.opacity);
      }
      return false;
    });
  }

  tick() {
    // tick effects for every player and npc
    this.tickAllEffects();
  }

  resetPlayerHash() {
    this.playerHash = this.createPlayerHash();
  }

  private tickAllEffects() {
    this._mapNPCs.forEach(npc => {
      npc.effects.forEach(eff => eff.tick(npc));
      this.updateNPCVolatile(npc);
    });

    this.players.forEach(player => {
      player.effects.forEach(eff => eff.tick(player));
    });
  }

  private createPlayerHash() {
    return reduce(this.players, (prev, p) => {
      prev[p.username] = p;
      p._party = p.party ? p.party : null;
      return prev;
    }, {});
  }

  isSuccorRestricted(player: Player): boolean {
    const succorRegion = filter(this.map.layers[MapLayer.Succorport].objects, reg => this.isInRegion(player, reg))[0];

    return get(succorRegion, 'properties.restrictSuccor', false);
  }

  getSuccorRegion(player: Player): string {
    const succorRegion = filter(this.map.layers[MapLayer.Succorport].objects, reg => this.isInRegion(player, reg))[0];

    return succorRegion ? succorRegion.name : 'the wilderness';
  }

  private trimNPC(npc: NPC): any {
    const baseObj = pick(npc, [
      'agro', 'uuid', 'name',
      'hostility', 'alignment', 'allegiance', 'allegianceReputation',
      'dir', 'sprite',
      'leftHand', 'rightHand', 'gear.Armor', 'gear.Robe1', 'gear.Robe2',
      'hp', 'level',
      'x', 'y', 'z',
      'effects',
      'totalStats.stealth'
    ]);
    if(!baseObj.gear) baseObj.gear = {};
    return baseObj;
  }

  addNPC(npc: NPC): void {
    npc.$$map = this.map;
    this._mapNPCs.push(npc);
    this.mapNPCs[npc.uuid] = npc;
    this.trimmedNPCs[npc.uuid] = this.trimNPC(npc);

    this.updateNPCVolatile(npc);
  }

  syncNPC(npc: NPC): void {
    if(!this.trimmedNPCs[npc.uuid]) return;
    this.trimmedNPCs[npc.uuid] = this.trimNPC(npc);
  }

  findNPC(uuid: string): NPC {
    return this.mapNPCs[uuid];
  }

  removeNPC(npc: NPC): void {
    pull(this._mapNPCs, npc);
    delete this.mapNPCs[npc.uuid];
    delete this.trimmedNPCs[npc.uuid];

    if(!this.isDisposing) {
      delete this.npcVolatile[npc.uuid];
    }
  }

  updateNPCVolatile(char: Character): void {
    if(!this.mapNPCs[char.uuid] || this.isDisposing) return;
    this.npcVolatile[char.uuid] = { x: char.x, y: char.y, hp: char.hp, dir: char.dir, agro: char.agro, effects: char.effects };
  }

  addPlayer(player, clientId: string): void {
    player.$$map = this.map;
    this.maintainedPlayerHash[player.username] = player;
    this.playerClientIdHash[clientId] = player;
    this.players.push(player);
    this.resetPlayerStatus(player);
  }

  findPlayer(username): Player {
    return this.maintainedPlayerHash[username];
  }

  findPlayerByClientId(clientId): Player {
    return this.playerClientIdHash[clientId];
  }

  removePlayer(clientId): void {
    const playerRef = this.findPlayerByClientId(clientId);
    delete this.maintainedPlayerHash[playerRef.username];
    delete this.playerClientIdHash[clientId];
    this.players = reject(this.players, p => p.username === playerRef.username);
  }

  addInteractable(obj: any): void {
    this.map.layers[MapLayer.Interactables].objects.push(obj);
    this.environmentalObjects.push(obj);
  }

  getInteractable(x: number, y: number, useOffset = true, typeFilter?: string): any {
    const findObj: any = { x: x * 64, y: (y + (useOffset ? 1 : 0)) * 64 };

    if(typeFilter) findObj.type = typeFilter;

    return find(this.map.layers[MapLayer.Interactables].objects, findObj);
  }

  getInteractableByName(name: string) {
    return find(this.map.layers[MapLayer.Interactables].objects, { name });
  }

  removeInteractable(obj: any): void {
    const check = x => x === obj;
    this.map.layers[MapLayer.Interactables].objects = reject(this.map.layers[MapLayer.Interactables].objects, check);
    this.environmentalObjects = reject(this.environmentalObjects, check);
  }

  resetFOV(player): void {
    Object.keys(player.fov).forEach(x => {
      Object.keys(player.fov[x]).forEach(y => {
        player.fov[x][y] = false;
      });
    });
  }

  calculateFOV(player): void {
    const affected = {};

    const dist = 4;

    // darkness obscures all vision
    if(this.isDarkAt(player.x, player.y) && !player.hasEffect('DarkVision')) {
      for(let xx = player.x - dist; xx <= player.x + dist; xx++) {
        for(let yy = player.y - dist; yy <= player.y + dist; yy++) {
          affected[xx - player.x] = affected[xx - player.x] || {};
          affected[xx - player.x][yy - player.y] = false;
        }
      }

    // no dark, calculate fov
    } else {
      this.fov.compute(player.x, player.y, dist, (x, y) => {
        return affected[x - player.x] && affected[x - player.x][y - player.y];
      }, (x, y) => {
        affected[x - player.x] = affected[x - player.x] || {};
        affected[x - player.x][y - player.y] = true;
      });

      if(!player.hasEffect('DarkVision')) {
        for(let xx = player.x - dist; xx <= player.x + dist; xx++) {
          for(let yy = player.y - dist; yy <= player.y + dist; yy++) {
            if(!this.isDarkAt(xx, yy)) continue;
            affected[xx - player.x] = affected[xx - player.x] || {};
            affected[xx - player.x][yy - player.y] = false;
          }
        }
      }
    }

    player.fov = affected;
  }

  private getInRange(arr: Character[], ref, radius, except: string[] = [], useSight = true): Character[] {

    const { x, y } = ref;

    return reject(arr, p => {

      if(ref.fov && useSight) {
        const offsetX = p.x - x;
        const offsetY = p.y - y;
        if(!ref.canSee(offsetX, offsetY)) return true;
      }

      return p.x < x - radius
        || p.x > x + radius
        || p.y < y - radius
        || p.y > y + radius
        || includes(except, p.uuid);
    });
  }

  getPlayersInRange(ref, radius, except: string[] = [], useSight = true): Character[] {
    return this.getInRange(this.players, ref, radius, except, useSight);
  }

  getAllInRange(ref, radius, except: string[] = [], useSight = true): Character[] {
    return this.getInRange(this.allPossibleTargets, ref, radius, except, useSight);
  }

  getAllHostilesInRange(ref: Character, radius): Character[] {
    const targets = this.getInRange(this.allPossibleTargets, ref, radius, this.players.map(p => p.uuid));
    return filter(targets, target => this.checkTargetForHostility(target, ref));
  }

  private checkTargetForHostility(me: NPC, target: Character): boolean {
    if(target.allegiance === 'NaturalResource' || target.allegiance === 'GM') return false;
    if(me.agro[target.uuid] || target.agro[me.uuid]) return true;
    if(me.hostility === 'Faction' && (
         me.isHostileTo(target.allegiance)
      || target.isHostileTo(me.allegiance))) return true;
    if(me.allegiance === target.allegiance) return false;
    if(me.hostility === 'Always') return true;
    if(me.alignment === 'Evil' && target.alignment === 'Good') return true;
    return false;
  }

  getPossibleTargetsFor(me: NPC, radius): Character[] {
    return filter(this.allPossibleTargets, char => {

      // no hitting myself
      if(me === char) return false;

      // no hitting dead people
      if(char.isDead()) return false;

      // if they can't attack, they're not worth fighting
      if(char.hostility === 'Never') return false;

      // they have to be visible
      const inRadius = char.x > me.x - radius
        && char.x < me.x + radius
        && char.y > me.y - radius
        && char.y < me.y + radius;

      if(!inRadius) return false;

      const offsetX = char.x - me.x;
      const offsetY = char.y - me.y;
      if(!me.canSee(offsetX, offsetY)) return false;

      if(!me.canSeeThroughStealthOf(char)) return false;

      if(this.checkTargetForHostility(me, char)) return true;

      return false;
    });
  }

  isInRegion(player, reg) {
    const x = (reg.x / 64);
    const y = (reg.y / 64);
    const width = reg.width / 64;
    const height = reg.height / 64;
    return player.x >= x
      && player.x < x + width
      && player.y >= y
      && player.y < y + height;
  };

  resetPlayerStatus(player: Player, ignoreMessages = false): void {
    this.calculateFOV(player);

    const mapLayers = this.map.layers;
    const playerOffset = (player.y * this.map.width) + player.x;

    const swimTile = mapLayers[MapLayer.Fluids].data[playerOffset];
    const swimInfo = GetSwimLevel(swimTile);
    if(swimInfo) {
      player.$$swimElement = swimInfo.element;
      player.swimLevel = swimInfo.swimLevel;
    } else {
      player.swimLevel = 0;
    }

    if(ignoreMessages) return;

    const regionObjs = filter(this.map.layers[MapLayer.RegionDescriptions].objects, reg => this.isInRegion(player, reg));

    const regionObj = minBy(regionObjs, 'width');
    let regionDesc = '';

    if(regionObj && regionObj.properties.desc) {
      regionDesc = regionObj.properties.desc;
    }

    const descObjs = this.map.layers[MapLayer.Interactables].objects.concat(this.map.layers[MapLayer.Decor].objects);
    const descObj = find(descObjs, { x: player.x * 64, y: (player.y + 1) * 64 });
    const intDesc = GetGidDescription(descObj ? descObj.gid : 0);

    const swimDesc = GetGidDescription(swimTile);
    const foliageDesc = mapLayers[MapLayer.Foliage].data[playerOffset] ? 'You are near some trees.' : '';
    const floorDesc = GetGidDescription(mapLayers[MapLayer.Floors].data[playerOffset]);
    const terrainDesc = GetGidDescription(mapLayers[MapLayer.Terrain].data[playerOffset]);

    const desc = intDesc || swimDesc || foliageDesc || floorDesc || terrainDesc;

    const hasNewRegion = regionDesc && regionDesc !== player.$$lastRegion;

    const bgmObj = filter(this.map.layers[MapLayer.BackgroundMusic].objects, reg => this.isInRegion(player, reg))[0];
    player.bgmSetting = bgmObj ? bgmObj.name : 'wilderness';

    if(hasNewRegion) {
      player.$$lastRegion = regionDesc;
      player.sendClientMessage({ message: regionDesc, subClass: 'env' });

    } else if(!regionDesc) {
      player.$$lastRegion = '';

    }

    if(!hasNewRegion && desc !== player.$$lastDesc) {
      player.$$lastDesc = desc;
      player.sendClientMessage({ message: desc, subClass: 'env' });
    }
  }

  toggleDoor(door): void {
    door.isOpen = !door.isOpen;
    door.opacity = !door.isOpen;
    door.density = !door.isOpen;

    this.mapData.openDoors[door.id] = { isOpen: door.isOpen, baseGid: door.gid, x: door.x, y: door.y - 64 };
  }

  // returns the stacked item if the item stacked
  addItemToGround({ x, y }, item: Item): Item {
    if(!item) return;

    item.x = x;
    item.y = y;

    const xKey = `x${x}`;
    const yKey = `y${y}`;

    this.groundItems[xKey] = this.groundItems[xKey] || {};
    this.groundItems[xKey][yKey] = this.groundItems[xKey][yKey] || {};
    this.groundItems[xKey][yKey][item.itemClass] = this.groundItems[xKey][yKey][item.itemClass] || [];

    this.simpleGroundItems[xKey] = this.simpleGroundItems[xKey] || {};
    this.simpleGroundItems[xKey][yKey] = this.simpleGroundItems[xKey][yKey] || {};
    this.simpleGroundItems[xKey][yKey][item.itemClass] = this.simpleGroundItems[xKey][yKey][item.itemClass] || [];

    const typeList = this.groundItems[xKey][yKey][item.itemClass];
    const simpleTypeList = this.simpleGroundItems[xKey][yKey][item.itemClass];

    if(LootHelper.isItemValueStackable(item) && typeList[0]) {
      typeList[0].value += item.value;
      simpleTypeList[0].value += item.value;
      return typeList[0];
    } else {
      typeList.push(item);
      simpleTypeList.push(this.simplifyItem(item));
    }

    return null;
  }

  removeItemFromGround(item: Item): void {
    if(!item.x || !item.y) return;

    const xKey = `x${item.x}`;
    const yKey = `y${item.y}`;

    // initalize array if not exist
    this.getGroundItems(item.x, item.y);

    this.groundItems[xKey][yKey][item.itemClass] = reject(this.groundItems[xKey][yKey][item.itemClass], i => i.uuid === item.uuid);

    if(size(this.groundItems[xKey][yKey][item.itemClass]) === 0) delete this.groundItems[xKey][yKey][item.itemClass];
    if(size(this.groundItems[xKey][yKey]) === 0) delete this.groundItems[xKey][yKey];
    if(size(this.groundItems[xKey]) === 0) delete this.groundItems[xKey];

    this.simpleGroundItems[xKey][yKey][item.itemClass] = reject(this.simpleGroundItems[xKey][yKey][item.itemClass], i => i.uuid === item.uuid);

    if(size(this.simpleGroundItems[xKey][yKey][item.itemClass]) === 0) delete this.simpleGroundItems[xKey][yKey][item.itemClass];
    if(size(this.simpleGroundItems[xKey][yKey]) === 0) delete this.simpleGroundItems[xKey][yKey];
    if(size(this.simpleGroundItems[xKey]) === 0) delete this.simpleGroundItems[xKey];

    delete item.x;
    delete item.y;
  }

  setGround(ground: any): void {
    this.groundItems = ground;
    Object.keys(this.groundItems).forEach(x => {

      this.simpleGroundItems[x] = this.simpleGroundItems[x] || {};

      Object.keys(this.groundItems[x]).forEach(y => {

        this.simpleGroundItems[x][y] = this.simpleGroundItems[x][y] || {};

        Object.keys(this.groundItems[x][y]).forEach(itemClass => {
          this.groundItems[x][y][itemClass] = this.groundItems[x][y][itemClass].map(i => new Item(i));
          this.simpleGroundItems[x][y][itemClass] = this.groundItems[x][y][itemClass].map(i => this.simplifyItem(i));
        });
      });
    });
  }

  public simplifyItem(item: Item): any {
    return pick(item, ['uuid', 'desc', 'sprite', 'itemClass', 'owner', 'quality', 'value', 'ounces', 'isSackable', 'isBeltable']);
  }

  serializableGroundItems() {
    const groundItems = cloneDeep(this.groundItems);
    Object.keys(groundItems).forEach(x => {
      Object.keys(groundItems[x]).forEach(y => {
        delete groundItems[x][y].Corpse;

        Object.keys(groundItems[x][y]).forEach(cat => {
          groundItems[x][y][cat].forEach(item => {
            delete item.$heldBy;
          });
        });
      });
    });
    return groundItems;
  }

  getGroundItems(x, y): any {

    const xKey = `x${x}`;
    const yKey = `y${y}`;

    if(!this.groundItems[xKey]) this.groundItems[xKey] = {};
    if(!this.groundItems[xKey][yKey]) this.groundItems[xKey][yKey] = {};
    return this.groundItems[xKey][yKey];
  }

  findChest(x, y): any {
    const chest = this.getInteractable(x, y, true,'TreasureChest');
    if(!chest) return null;

    return chest;
  }

  tickPlayers(): void {

    this.players.forEach(p => {
      p.tick();

      if(p.swimLevel > 0) {
        const hpPercentLost = p.swimLevel * 4;
        const hpLost = Math.floor(p.hp.maximum * (hpPercentLost / 100));
        CombatHelper.dealOnesidedDamage(p, { damage: hpLost, damageClass: p.$$swimElement || 'water', damageMessage: 'You are drowning!', suppressIfNegative: true });
      }
    });

    this.resetPlayerHash();
  }

  checkIfActualWall(x: number, y: number): boolean {
    const adjustedY = y * this.map.width;
    return this.map.layers[MapLayer.Walls].data[x + adjustedY];
  }

  checkIfDenseWall(x: number, y: number): boolean {
    const adjustedY = y * this.map.width;
    return this.checkIfActualWall(x, y)
        || this.map.layers[MapLayer.Foliage].data[x + adjustedY];
  }

  checkIfCanPutDarknessAt(x: number, y: number): boolean {
    const adjustedY = y * this.map.width;
    return !(this.map.layers[MapLayer.Walls].data[x + adjustedY] || get(this.secretWallHash, [x, y]));
  }

  isDarkAt(x: number, y: number): boolean {
    const xKey = `x${x}`;
    const yKey = `y${y}`;

    if(!this.darkness[xKey]) return false;
    return this.darkness[xKey][yKey];
  }

  addDarkness(x: number, y: number, radius: number, timestamp: number): void {
    for(let xx = x - radius; xx <= x + radius; xx++) {
      for(let yy = y - radius; yy <= y + radius; yy++) {

        if(!this.checkIfCanPutDarknessAt(xx, yy)) continue;

        const xKey = `x${xx}`;
        const yKey = `y${yy}`;

        this.darkness[xKey] = this.darkness[xKey] || {};

        const currentValue = this.darkness[xKey][yKey];

        // dont overwrite old, stronger darkness with new, weaker darkness
        if(!currentValue || (currentValue && currentValue < timestamp)) {
          this.darkness[xKey][yKey] = timestamp;

          this.getPlayersInRange({ x, y }, 4).forEach((player: Player) => {
            this.calculateFOV(player);
            player.$$room.updateFOV(player);
          });
        }
      }
    }
  }

  removeDarkness(x: number, y: number, radius: number, timestamp: number, force = false): void {
    for(let xx = x - radius; xx <= x + radius; xx++) {
      for(let yy = y - radius; yy <= y + radius; yy++) {

        const xKey = `x${xx}`;
        const ykey = `y${yy}`;

        this.darkness[xKey] = this.darkness[xKey] || {};

        // only remove my specific darkness
        if(force || this.darkness[xKey][ykey] === timestamp) {
          this.darkness[xKey][ykey] = false;

          this.getPlayersInRange({ x, y }, 4).forEach((player: Player) => {
            this.calculateFOV(player);
            player.$$room.updateFOV(player);
          });
        }

      }
    }
  }
}
