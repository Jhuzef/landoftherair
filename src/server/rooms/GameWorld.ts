
import { isObject, cloneDeep, find, get, set, clone, pull, merge, pullAll } from 'lodash';

import { Parser } from 'mingy';

import { Room } from 'colyseus';
import { GameState } from '../../shared/models/gamestate';
import { MapLayer } from '../../shared/models/maplayer';

import { DB } from '../database';
import { Redis } from '../redis';
import { Player } from '../../shared/models/player';

import { CommandExecutor } from '../helpers/command-executor';
import { NPC } from '../../shared/models/npc';
import { Logger } from '../logger';
import { Spawner } from '../base/Spawner';

import { Character } from '../../shared/models/character';
import { ItemCreator } from '../helpers/world/item-creator';
import { Item } from '../../shared/models/item';
import { Locker } from '../../shared/models/container/locker';
import { VISUAL_EFFECTS, VisualEffect } from '../helpers/world/visual-effects';

import { PartyManager } from '../helpers/party/party-manager';
import { BonusHelper } from '../helpers/bonus/bonus-helper';
import { NPCLoader } from '../helpers/character/npc-loader';
import { AccountHelper } from '../helpers/account/account-helper';
import { DeathHelper } from '../helpers/character/death-helper';
import { CharacterHelper } from '../helpers/character/character-helper';
import { GroundHelper } from '../helpers/world/ground-helper';
import { LockerHelper } from '../helpers/world/locker-helper';
import { BankHelper } from '../helpers/character/bank-helper';
import { SubscriptionHelper } from '../helpers/account/subscription-helper';
import { PouchHelper } from '../helpers/character/pouch-helper';
import { MoveHelper } from '../helpers/character/move-helper';
import { TeleportHelper } from '../helpers/world/teleport-helper';
import { Signal } from 'signals.js';
import { SkillTreeHelper } from '../helpers/skill-trees/skill-tree-helper';
import { MarketHelper } from '../helpers/world/market-helper';
import { AnalyticsHelper } from '../helpers/world/analytics-helper';
import { globalResponses, globalSetup } from '../scripts/npc/global-responses';
import { Holiday, HolidayHelper } from '../../shared/helpers/holiday-helper';

export type CombatEffect = 'hit-min' | 'hit-mid' | 'hit-max' | 'hit-magic' | 'hit-heal' | 'hit-buff'
| 'block-dodge' | 'block-armor' | 'block-miss' | 'block-shield' | 'block-weapon' | 'block-offhand';

const TICK_TIMER = 1000;

const TickRatesPerTimer = {

  BuffTick: 1,

  // tick players every second
  CharacterAction: 1,

  // tick spawners every second
  SpawnerTick: 1,

  // save players every minute
  PlayerSave: 60
};

export class GameWorld extends Room<GameState> {

  private allMapNames = {};

  private spawners: Spawner[] = [];

  private dropTables = {
    region: [],
    map: []
  };

  private ticks = 0;

  public partyManager: PartyManager;
  private bonusHelper: BonusHelper;
  private groundHelper: GroundHelper;
  public itemCreator: ItemCreator;
  public teleportHelper: TeleportHelper;
  public skillTreeHelper: SkillTreeHelper;
  public subscriptionHelper: SubscriptionHelper;
  public npcLoader: NPCLoader;
  public lockerHelper: LockerHelper;
  private marketHelper: MarketHelper;
  public analyticsHelper: AnalyticsHelper;

  public get groundItemCount(): number {
    return this.groundHelper.numberOfItems;
  }

  private itemGC: any;

  private usernameClientHash = {};

  private events: { [key: string]: Signal } = {};

  public totalCreaturesInWorld = 0;

  get allSpawners() {
    return this.spawners;
  }

  get mapWidth(): number {
    return this.state.map.width;
  }

  get mapHeight(): number {
    return this.state.map.height;
  }

  get mapRegion(): string {
    return this.state.map.properties.region;
  }

  get mapName(): string {
    return this.state.mapName;
  }

  get mapHoliday(): Holiday {
    return this.state.map.properties.holiday;
  }

  get maxSkill() {
    return this.state.map.properties.maxSkill || 1;
  }

  private get maxCreatures() {
    return this.state.map.properties.maxCreatures || 0;
  }

  get disableCreatureSpawn(): boolean {
    return this.state.map.properties.disableCreatureRespawn;
  }

  get canSpawnCreatures(): boolean {
    return !this.disableCreatureSpawn; // && this.totalCreaturesInWorld < this.maxCreatures;
  }

  get decayRateHours() {
    return this.state.map.properties.itemExpirationHours || 6;
  }

  get decayChecksMinutes() {
    return this.state.map.properties.itemGarbageCollection || 60;
  }

  get maxItemsOnGround() {
    return this.state.map.properties.maxItemsOnGround || 1000;
  }

  get mapRespawnPoint(): { map: string, x: number, y: number } {
    return {
      map: this.state.map.properties.respawnMap || this.mapName,
      x: this.state.map.properties.respawnX,
      y: this.state.map.properties.respawnY
    };
  }

  get mapSubscriberOnly(): boolean {
    return this.state.map.properties.subscriberOnly;
  }

  get script(): string {
    return this.state.map.properties.script;
  }

  get canMemorize(): boolean {
    return true;
  }

  get exitPoint() {
    const { kickMap, kickX, kickY } = this.state.map.properties;
    if(!kickMap || !kickX || !kickY) return null;
    return { kickMap, kickX, kickY };
  }

  get canPartyAction(): boolean {
    return true;
  }

  private redis: Redis;
  public get redisClient() {
    return this.redis.client;
  }

  async onInit(opts) {
    this.redis = new Redis();

    this.allMapNames = opts.allMapNames;

    this.itemCreator = new ItemCreator();
    this.groundHelper = new GroundHelper(this);
    this.teleportHelper = new TeleportHelper(this);
    this.skillTreeHelper = new SkillTreeHelper();
    this.subscriptionHelper = new SubscriptionHelper();
    this.npcLoader = new NPCLoader();
    this.lockerHelper = new LockerHelper();
    this.marketHelper = new MarketHelper();
    this.analyticsHelper = new AnalyticsHelper();

    const mapData = this.formatMapData(cloneDeep(require(opts.mapPath)));

    this.setPatchRate(1000);
    this.setSeatReservationTime(30);
    this.setSimulationInterval(this.tick.bind(this), TICK_TIMER);
    this.setState(new GameState({
      players: [],
      map: mapData,
      mapName: opts.mapName
    }));

    const finishLoad = async () => {
      if(opts.skipMostOfLoad) return;

      this.initPartyManager();
      this.initBonusHelper();

      const timerData = await this.loadBossTimers();
      const spawnerTimers = timerData ? timerData.spawners : [];

      this.clock.setTimeout(() => {
        this.loadSpawners(spawnerTimers);
        this.loadDropTables();

        this.clock.setTimeout(() => {
          this.loadNPCsFromMap();
        }, 1000);

      }, 0);

      this.initGround();

      this.state.tick();

      if(this.script) {
        const { setup, events } = require(__dirname + '/../scripts/dungeons/' + this.script);
        if(setup) setup(this);
        if(events) events(this);
      }

      this.addEvent('kill:npc', () => {});
    };

    finishLoad();
  }

  private sendTo(client, data) {
    // do not send to CLOSING or CLOSED sockets
    if(client.readyState > 1) return;
    this.send(client, data);
  }

  public sendRawData(player: Player, data) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, data);
  }

  async onDispose() {
    this.state.isDisposing = true;

    if(this.itemGC) {
      this.itemGC.cancel();
    }

    this.saveBossTimers();
    if(this.partyManager) {
      this.partyManager.stopEmitting();
    }

    await this.saveGround();
  }

  async onJoin(client, options) {
    const { charSlot, username } = options;

    let account = null;

    try {
      account = await AccountHelper.getAccountByUsername(username);
    } catch(e) {
      Logger.error(e);
    }

    if(!account || account.colyseusId !== client.id) {
      this.sendTo(client, {
        error: 'error_invalid_token',
        prettyErrorName: 'Invalid Session Id',
        prettyErrorDesc: 'You\'re either trying to say you\'re someone else, or your token is bad. To set this right, refresh the page.'
      });
      return false;
    }

    let playerData = null;

    try {
      playerData = await DB.$players.findOne({ username, map: this.mapName, charSlot });
    } catch(e) {
      Logger.error(e);
    }

    if(!playerData) {
      this.sendTo(client, { error: 'invalid_char', prettyErrorName: 'Invalid Character Data', prettyErrorDesc: 'No idea how this happened!' });
      return false;
    }

    if(playerData.inGame === true) {
      this.sendTo(client, { error: 'already_in_game', prettyErrorName: 'Already In Game', prettyErrorDesc: 'You are already in game! Maybe you hit join too fast?' });
      return false;
    }

    // needs to be available when player.init() is called
    playerData.$$account = account;
    playerData.$$room = this;
    const player = new Player(playerData);
    player.z = player.z || 0;

    this.usernameClientHash[player.username] = { client };

    try {
      await player.initServer();
    } catch(e) {
      Logger.error(e);
    }

    this.state.addPlayer(player, client.id);
    CharacterHelper.setUpClassFor(player);

    player.inGame = true;
    player.respawnPoint = clone(this.mapRespawnPoint);

    try {
      await this.savePlayer(player);
    } catch(e) {
      Logger.error(e);
    }

    this.sendTo(client, { action: 'set_map', map: this.state.formattedMap });

    if(this.mapSubscriberOnly && !this.subscriptionHelper.isSubscribed(player)) {
      player.sendClientMessage('Magical forces push you out of the rift!');
      await this.teleport(player, { newMap: 'Rylt', x: 68, y: 13 });
      return;
    }

    if(this.mapHoliday && !HolidayHelper.isHoliday(this.mapHoliday)) {
      player.sendClientMessage('Magical forces push you out of the rift!');
      await this.kickOut(player);
      return false;
    }

    this.analyticsHelper.startGameSession(player, options.userAgent);
  }

  async onLeave(client) {
    const player = this.state.findPlayerByClientId(client.id);
    if(!player) return;

    delete this.usernameClientHash[player.username];
    this.analyticsHelper.stopGameSession(player);

    this.state.removePlayer(client.id);
    player.inGame = false;

    // do not leave party if you're teleporting between maps
    if(this.partyManager && !player.$$doNotSave && player.partyName) {
      this.partyManager.leaveParty(player);
    }

    try {
      await this.prePlayerMapLeave(player);
      await this.savePlayer(player);
    } catch(e) {
      Logger.error(e);
    }
  }

  onMessage(client, data) {
    const player = this.state.findPlayerByClientId(client.id);

    // intercept ready flag and send data to player
    if(data.ready) {
      this.flagClientReady(client, player);
      return;
    }

    if(!data.command || !player || !player.$$ready) return;

    data.gameState = this.state;
    data.room = this;
    data.client = client;

    data.command = (data.command || '').trim();
    data.args = (data.args || '').trim().split('  ').join(' ');

    CommandExecutor.queueCommand(player, data.command, data);
  }

  private formatMapData(mapData) {
    const layer = mapData.layers[MapLayer.SpawnerZones];

    let currentSpawnId = 1;

    if(!layer.objects.length) {
      layer.objects.push({
        x: 0,
        y: 0,
        width: mapData.width * 64,
        height: mapData.height * 64
      });
    }

    layer.objects.forEach(obj => {
      const spawnRegionId = get(obj, 'properties.spawnerRegionId');
      if(!spawnRegionId) {
        set(obj, 'properties.spawnerRegionId', currentSpawnId++);
      }
    });

    return mapData;
  }

  public flagClientReady(client, player) {

    this.setPlayerXY(player, player.x, player.y);

    // 0,0 move to get info on the current tile
    this.clock.setTimeout(() => {

      if(this.mapName === 'Tutorial') {
        this.givePlayerBasicAbilities(player);
        this.sendTo(client, { action: 'take_tour' });
      }

      this.state.resetPlayerStatus(player);
      MoveHelper.move(player, { room: this, gameState: this.state, x: 0, y: 0 });
    }, 0);

    this.clock.setTimeout(() => {
      this.sendTo(client, { action: 'sync_npcs', npcs: this.state.trimmedNPCs });
    }, 0);

    this.clock.setTimeout(() => {
      this.sendTo(client, { action: 'sync_ground', ground: this.state.simpleGroundItems });
    }, 0);

    this.updateSkillTree(player);

    player.$$ready = true;
    client.$$ready = true;
  }

  public async kickOut(player: Player) {
    if(!this.exitPoint) return;

    const { kickMap, kickX, kickY } = this.exitPoint;
    await this.teleport(player, { newMap: kickMap, x: kickX, y: kickY });
  }

  public saveGround(): Promise<any> {
    return this.groundHelper.saveGround();
  }

  private syncNPCToClients(npcUUID: string) {

    this.clients.forEach(client => {
      if(!(<any>client).$$ready) return;

      this.sendTo(client, { action: 'add_npc', npc: this.state.trimmedNPCs[npcUUID] });
    });
  }

  public addNPC(npc: NPC) {
    this.state.addNPC(npc);

    this.syncNPCToClients(npc.uuid);
  }

  public syncNPC(npc: NPC) {
    this.state.syncNPC(npc);

    this.syncNPCToClients(npc.uuid);
  }

  public removeNPC(npc: NPC) {
    this.state.removeNPC(npc);

    this.broadcast({
      action: 'remove_npc',
      npcUUID: npc.uuid
    });
  }

  private async savePlayer(player: Player, extraOpts: any = {}, forceSave = false) {
    if(!forceSave && player.$$doNotSave) return;

    const savePlayer = player.toSaveObject();
    savePlayer.fov = null;
    savePlayer._party = null;

    // cross-map teleport
    if(extraOpts.x && extraOpts.y) {
      savePlayer.inGame = false;
    }

    merge(savePlayer, extraOpts);

    if(player.leftHand && player.leftHand.itemClass === 'Corpse') {
      savePlayer.leftHand = null;
    }

    if(player.rightHand && player.rightHand.itemClass === 'Corpse') {
      savePlayer.rightHand = null;
    }

    await this.savePlayerPouch(savePlayer);
    await this.skillTreeHelper.saveSkillTree(player);

    return DB.$players.update({ username: savePlayer.username, charSlot: savePlayer.charSlot }, { $set: savePlayer });
  }

  public sendMessageToUsernames(usernames: string[], message: string|any) {
    usernames.forEach(username => {
      const usernameObj = { username };
      const client = this.findClient(<Player>usernameObj);
      if(!client) return;

      this.sendClientLogMessage(client, message);
    });
  }

  private findClient(player: Player) {
    return get(this.usernameClientHash, [player.username, 'client']);
  }

  sendPlayerLogMessage(player: Player, messageData, rootCharacter?: Character) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendClientLogMessage(client, messageData, rootCharacter);
  }

  sendPlayerLogMessageBatch(player: Player, messages: any[]) {
    const client = this.findClient(player);
    if(!client) return;

    const messagesFormatted = messages.map(msg => this.formatClientLogMessage(msg));

    this.sendTo(client, { action: 'log_message_b', messages: messagesFormatted });
  }

  public updateLogSettings(player: Player, logSettings) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'combat_log', ...logSettings });
  }

  formatClientLogMessage(messageData, rootCharacter?: Character) {
    let overMessage = messageData;
    let overName = '';
    let overClass = '';
    let overTarget = '';
    let overDir = '';
    let overSfx = '';
    let overExtraData = null;

    let grouping = 'always';

    if(isObject(messageData)) {
      const { message, name, subClass, target, dirFrom, extraData, sfx } = messageData;
      overMessage = message;
      overName = name;
      overClass = subClass;
      overTarget = target;
      overDir = dirFrom;
      overExtraData = extraData;
      overSfx = sfx;

      if(overClass) {
        grouping = overClass.split(' ')[0];
      }
    }

    if(rootCharacter) overName = `as ${rootCharacter.name}`;

    const opts: any = {};
    if(overName) opts.name = overName;
    if(overMessage) opts.message = overMessage;
    if(overClass) opts.subClass = overClass;
    if(overDir) opts.dirFrom = overDir;
    if(overExtraData) opts.extraData = overExtraData;
    if(overSfx) opts.sfx = overSfx;
    if(grouping) opts.grouping = grouping;

    // explicit null set = cancel target
    if(overTarget || overTarget === null) opts.target = overTarget;

    return opts;

  }

  sendClientLogMessage(client, messageData, rootCharacter?: Character) {

    const overMessage: any = this.formatClientLogMessage(messageData, rootCharacter);
    if(!overMessage) return;

    overMessage.action = 'log_message';
    this.sendTo(client, overMessage);
  }

  showGroundWindow(player: Player) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_ground' });
  }

  showTrainerWindow(player: Player, npc: NPC) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_trainer', trainSkills: npc.trainSkills, classTrain: npc.classTrain, uuid: npc.uuid });
  }

  showShopWindow(player: Player, npc: NPC, items: Item[]) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_shop', vendorItems: items, uuid: npc.uuid, vendorCurrency: npc.$$vendorCurrency });
  }

  showBankWindow(player: Player, npc: NPC, banks: any) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_bank', uuid: get(npc || {}, 'uuid'), bankId: get(npc || {}, 'bankId'), banks });
  }

  showAlchemyWindow(player: Player, npc: NPC) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_ts', tradeskill: 'Alchemy', uuid: npc.uuid });
  }

  showSpellforgingWindow(player: Player, npc: NPC) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_ts', tradeskill: 'Spellforging', uuid: npc.uuid });
  }

  showMarketBoard(player: Player, npc: NPC) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_mb', uuid: npc.uuid, mapRegion: this.mapRegion });
  }

  showMetalworkingWindow(player: Player, npc: NPC) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_ts', tradeskill: 'Metalworking', uuid: npc.uuid });
  }

  showLockerWindow(player: Player, lockers, lockerId) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'show_lockers', lockers, lockerId });
  }

  openLocker(player: Player, lockerName, lockerId) {
    this.lockerHelper.openLocker(player, lockerName, lockerId);
  }

  updateLocker(player: Player, locker: Locker) {
    this.lockerHelper.saveLocker(player, locker);
    this.savePlayer(player);
    const client = player.$$room.findClient(player);
    if(!client) return;

    this.sendTo(client, { action: 'update_locker', locker });
  }

  async openBank(player: Player, npc: NPC) {
    const banks = await BankHelper.openBank(player, npc);
    player.$$banks = banks;
    this.showBankWindow(player, npc, player.$$banks);
  }

  depositBankMoney(player: Player, region: string, amount: number) {
    if(!player.$$banks) return false;

    amount = Math.round(+amount);
    if(isNaN(amount)) return false;

    if(amount < 0) return false;
    if(amount > player.currentGold) amount = player.currentGold;

    player.$$banks = player.$$banks || {};
    player.$$banks[region] = player.$$banks[region] || 0;
    player.$$banks[region] += amount;

    player.spendGold(amount, 'Service:Bank');

    BankHelper.saveBank(player);
    this.savePlayer(player);
    this.showBankWindow(player, null, player.$$banks);
    return amount;
  }

  withdrawBankMoney(player: Player, region: string, amount: number) {
    if(!player.$$banks) return false;

    amount = Math.round(+amount);
    if(isNaN(amount)) return false;
    if(amount < 0) return false;
    player.$$banks = player.$$banks || {};
    player.$$banks[region] = player.$$banks[region] || 0;

    if(amount > player.$$banks[region]) amount = player.$$banks[region];

    player.$$banks[region] -= amount;
    player.earnGold(amount, 'Service:Bank');
    BankHelper.saveBank(player);
    this.savePlayer(player);
    this.showBankWindow(player, null, player.$$banks);
    return amount;
  }

  setPlayerXY(player, x, y) {
    const oldPos = { x: player.x, y: player.y };
    player.x = x;
    player.y = y;
    this.state.updatePlayerInQuadtree(player, oldPos);
    this.state.calculateFOV(player);
    this.updatePos(player);
  }

  async teleport(player, opts: { newMap: string, x: number, y: number, zChange?: number, zSet?: number, extraMergeOpts?: any }) {

    const { newMap, x, y, zChange, zSet } = opts;

    if(!newMap || player.map === newMap) {
      this.setPlayerXY(player, x, y);
    }

    const client = this.findClient(player);
    if(!client) return;

    if(newMap && !this.allMapNames[newMap]) {
      this.sendClientLogMessage(client, `Warning: map "${newMap}" does not exist.`);
      return;
    }

    if(zChange) {
      player.z += zChange;
    }

    if(zSet) {
      player.z = zSet;
    }

    this.state.resetPlayerStatus(player, true);

    if(newMap && player.map !== newMap) {
      player.map = newMap;
      player.$$doNotSave = true;
      player.$$ready = false;

      const saveOpts = { x, y, map: newMap };
      merge(saveOpts, opts.extraMergeOpts || {});

      await this.savePlayer(player, saveOpts, true);
      this.state.resetFOV(player);
      this.sendTo(client, { action: 'set_character', character: player });
      this.sendTo(client, { action: 'change_map', map: newMap, party: player.partyName });
    }
  }

  addItemToGround(ref, item) {
    // invalid items *do* not belong on the ground. fumbling f.ex. gloves is fine, they'll be a potato til they respawn
    // but graphical glitches are a no no!
    if(item.sprite < 0) return;

    // drop items on destroy if they're supposed to, or if they're a tester.
    if(ref.isPlayer && ref.isPlayer() && item.isOwnedBy(ref) && this.subscriptionHelper.isTester(ref)) return;

    if(item.destroyOnDrop) {

      // legacy code for legacy players :P
      if(item.name === 'Succor Blob' && item.succorInfo && ref.isPlayer && ref.isPlayer()) {
        ref.doSuccor(item.succorInfo);
      }

      return;
    }

    if(item.itemClass !== 'Corpse') {
      this.itemCreator.setItemExpiry(item, item.owner ? this.decayRateHours * 4 : this.decayRateHours);
    }

    item.$heldBy = null;
    const stackedItem = this.state.addItemToGround(ref, item);
    this.groundHelper.addItemToGround(ref, item, stackedItem);

    this.broadcast({ action: 'add_gitem', x: ref.x, y: ref.y, item: this.state.simplifyItem(item) });
  }

  removeItemFromGround(item, fromGH = false) {
    const { x, y } = item;

    // inf loop protection - only do this if it wasn't called from the ground helper
    if(!fromGH) {
      // only need to remove expiry from real items, which will not be the case if called here
      this.itemCreator.removeItemExpiry(item);
      this.groundHelper.removeItemFromGround(item, true);
    }

    this.state.removeItemFromGround(item);

    this.broadcast({ action: 'remove_gitem', x, y, item: this.state.simplifyItem(item) });
  }

  private async prePlayerMapLeave(player: Player) {
    DeathHelper.corpseCheck(player);
    await DeathHelper.autoReviveAndUncorpse(player);
    this.doorCheck(player);
    player.z = 0;
  }

  async executeCommand(player: Player, commandString, args: string) {
    const data = {
      gameState: this.state,
      room: this,
      args,
      command: commandString
    };

    const { wasSuccess, command } = await CommandExecutor.executeCommand(player, data.command, data);

    if(wasSuccess) {
      this.analyticsHelper.trackSkill(player, command);
    }
  }

  private initGround() {
    this.groundHelper.loadGround();
    this.itemGC = this.groundHelper.watchForItemDecay();
  }

  private initPartyManager() {
    this.partyManager = new PartyManager(this);
  }

  private initBonusHelper() {
    this.bonusHelper = new BonusHelper(this);
  }

  private async loadBossTimers() {
    return DB.$mapBossTimers.findOne({ mapName: this.state.mapName });
  }

  protected saveBossTimers() {
    const timestamp = Date.now();

    const spawners = this.spawners.filter(spawner => {
      return spawner.shouldSerialize && spawner.currentTick > 0 && !spawner.hasAnyAlive();
    });

    const saveSpawners = spawners.map(spawner => ({
      x: spawner.x,
      y: spawner.y,
      currentTick: spawner.currentTick,
      timestamp
    }));

    if(saveSpawners.length > 0) {
      DB.$mapBossTimers.update({ mapName: this.state.mapName }, { $set: { spawners: saveSpawners } }, { upsert: true });
    }
  }

  public createDarkness(startX: number, startY: number, radius: number, durationInMinutes: number): void {
    const darkTimestamp = Date.now();

    this.clock.setTimeout(() => {
      this.state.removeDarkness(startX, startY, radius, darkTimestamp);
    }, durationInMinutes * 1000 * 15);

    this.state.addDarkness(startX, startY, radius, darkTimestamp);
  }

  public removeDarkness(startX: number, startY: number, radius: number, lightSeconds: number) {
    this.state.removeDarkness(startX, startY, radius, 0, true, lightSeconds);
  }

  private async loadDropTables() {
    this.dropTables.map = (await DB.$mapDrops.findOne({ mapName: this.state.mapName }) || {}).drops || [];
    if(this.mapRegion) {
      this.dropTables.region = (await DB.$regionDrops.findOne({ regionName: this.mapRegion }) || {}).drops || [];
    }
  }

  public createSpawner(spawnerOpts, locRef) {
    const spawner = new Spawner(this, locRef, spawnerOpts);
    this.addSpawner(spawner);
  }

  public addSpawner(spawner: Spawner) {
    this.spawners.push(spawner);
  }

  public removeSpawner(spawner: Spawner) {
    pull(this.spawners, spawner);
  }

  private loadNPCsFromMap() {
    const npcs = this.state.map.layers[MapLayer.NPCs].objects;

    if(npcs.length === 0) return;
    const normalNPCSpawner = new Spawner(this, { x: 0, y: 0, map: this.state.mapName, name: 'NPC Green Spawner' }, {
      leashRadius: -1,
      canSlowDown: false,
      shouldBeActive: false,
      respawnRate: 0
    });

    this.addSpawner(normalNPCSpawner);

    npcs.forEach(async npcData => {
      const data: any = npcData.properties || {};
      data.name = npcData.name || this.npcLoader.determineNPCName(npcData);
      data.sprite = npcData.gid - this.state.map.tilesets[3].firstgid;
      data.x = npcData.x / 64;
      data.y = (npcData.y / 64) - 1;
      const npc = new NPC(data);
      npc.$$room = this;

      CharacterHelper.setUpClassFor(npc);

      try {
        if(npc.script) {
          const { setup, responses } = require(`${__dirname}/../scripts/npc/${npc.script}`);
          await globalSetup(npc);
          await setup(npc);

          if(npc.hostility === 'Never') {
            npc.parser = new Parser();
            globalResponses(npc);
            responses(npc);
          }
        }
      } catch(e) {
        Logger.error(e);
      }

      if(!npc.name) this.npcLoader.determineNPCName(npc);

      normalNPCSpawner.addNPC(npc);
    });
  }

  private loadSpawners(timerData: any[]) {
    const deadSpawner = new Spawner(this, { x: 0, y: 0, map: this.state.mapName, name: 'Dead NPC Spawner' }, {
      leashRadius: -1,
      canSlowDown: false,
      shouldBeActive: false,
      respawnRate: 0
    });

    this.addSpawner(deadSpawner);

    const spawners = this.state.map.layers[MapLayer.Spawners].objects;

    const now = Date.now();

    spawners.forEach(spawnerData => {
      const spawner = require(`${__dirname}/../scripts/spawners/${spawnerData.properties.script}`);
      const spawnerProto = spawner[Object.keys(spawner)[0]];
      const properties = spawnerData.properties;
      const spawnerX = spawnerData.x / 64;
      const spawnerY = (spawnerData.y / 64) - 1;
      const spawnerFindArgs: any = { x: spawnerX, y: spawnerY };
      const spawnerOldData: any = find(timerData, spawnerFindArgs);

      if(spawnerOldData) {
        const difference = Math.floor((now - spawnerOldData.timestamp) / 1000);
        properties.currentTick = spawnerOldData.currentTick + difference;
      }

      const spawnerObject = new spawnerProto(this, { map: this.state.mapName, x: spawnerX, y: spawnerY, name: spawnerData.name }, properties);
      this.addSpawner(spawnerObject);
    });
  }

  private tick() {
    if(this.state.allPlayers.length === 0) return;

    this.ticks++;

    const ACTIVE_PLAYER_RANGE = 6;

    const playerLocations = {};
    this.state.allPlayers.forEach(player => {
      for(let x = player.x - ACTIVE_PLAYER_RANGE; x < player.x + ACTIVE_PLAYER_RANGE; x++) {
        for(let y = player.y - ACTIVE_PLAYER_RANGE; y < player.y + ACTIVE_PLAYER_RANGE; y++) {
          set(playerLocations, [x, y], true);
        }
      }
    });

    if((this.ticks % TickRatesPerTimer.CharacterAction) === 0) {
      this.broadcast({ action: 'tick' });
      this.state.tickPlayers();
      this.spawners.forEach(spawner => spawner.npcTick(this.ticks % 2 === 0, playerLocations));
    }

    if((this.ticks % TickRatesPerTimer.BuffTick) === 0) {
      this.state.tick();
      this.spawners.forEach(spawner => spawner.buffTick());
    }

    if((this.ticks % TickRatesPerTimer.SpawnerTick) === 0) {
      this.spawners.forEach(spawner => spawner.tick());
    }

    // save players every minute or so
    if((this.ticks % TickRatesPerTimer.PlayerSave) === 0) {
      this.state.allPlayers.forEach(player => this.savePlayer(player));

      this.saveGround();
      // reset ticks
      this.ticks = 0;
    }

  }

  dropCorpseItems(corpse: Item, searcher?: Player) {
    if(!corpse || !corpse.searchItems) return;

    const removedItems = [];

    const removeItemFromCorpse = (item) => {
      // if items are dropping from the corpse from someones hands, that means we have to do it at the players loc
      const ref = corpse.$heldBy ? this.state.findPlayer(corpse.$heldBy) : corpse;

      this.addItemToGround(ref, item);
      removedItems.push(item);
    };

    corpse.searchItems.forEach(item => {
      if(searcher && item.itemClass === 'Coin') {
        searcher.earnGold(item.value, 'Game:SearchCorpse');
        searcher.sendClientMessage(`You loot ${item.value} gold coins from the corpse.`);
        removedItems.push(item);

      } else {

        const requiredQuest = get(item, 'requirements.quest');
        if(requiredQuest) {
          if(searcher
          && searcher.hasQuestName(requiredQuest)
          && !searcher.hasPermanentCompletionFor(requiredQuest)) removeItemFromCorpse(item);

        } else {
          removeItemFromCorpse(item);
        }

      }
    });

    pullAll(corpse.searchItems, removedItems);

    if(corpse.searchItems.length === 0) {
      corpse.searchItems = null;
    }

    if(corpse.x && corpse.y) {
      this.broadcast({ action: 'update_gitem', x: corpse.x, y: corpse.y, item: this.state.simplifyItem(corpse) });
    }
  }

  dropChestItems(chest: any, searcher?: Player) {
    if(!chest || !chest.searchItems) return;

    chest.searchItems.forEach(item => {
      if(searcher && item.itemClass === 'Coin') {
        searcher.earnGold(item.value, 'Game:SearchChest');
        searcher.sendClientMessage(`You loot ${item.value} gold coins from the chest.`);

      } else {
        this.addItemToGround({ x: chest.x / 64, y: (chest.y / 64) - 1 }, item);
      }
    });

    chest.searchItems = null;
  }

  removeCorpse(corpseRef: Item): void {
    if(corpseRef.$heldBy) {
      const player = this.state.findPlayer(corpseRef.$heldBy);
      player.sendClientMessage('The corpse fizzles from your hand.');
      DeathHelper.corpseCheck(player, corpseRef);
    }

    this.removeItemFromGround(corpseRef);
  }

  private doorCheck(player) {
    const interactable = this.state.getInteractable(player.x, player.y);
    if(interactable && interactable.type === 'Door') {
      player.teleportToRespawnPoint();
    }
  }

  public drawEffect(player: Character, center: any, effect: VisualEffect, radius = 0) {
    if(!player.isPlayer()) return;

    const client = this.findClient(<Player>player);
    if(!client) return;

    const effectId = VISUAL_EFFECTS[effect];
    this.sendTo(client, { action: 'draw_effect_r', effect: effectId, center, radius });
  }

  public combatEffect(player: Character, effect: CombatEffect, enemyUUID: string) {
    if(!player.isPlayer()) return;

    const client = this.findClient(<Player>player);
    if(!client) return;

    this.sendTo(client, { action: 'draw_effect_c', effect, enemyUUID });
  }

  public updatePos(player: Character) {
    if(player.isPlayer && !player.isPlayer()) return;

    const client = this.findClient(<Player>player);
    if(!client) return;

    this.sendTo(client, {
      action: 'update_pos',
      x: player.x,
      y: player.y,
      dir: player.dir,
      swimLevel: player.swimLevel,
      fov: player.fov
    });
  }

  public updateFOV(player: Player) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, {
      action: 'update_fov',
      fov: player.fov
    });
  }

  public resetMacros(player: Player) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, {
      action: 'update_macros'
    });
  }

  public updateSkillTree(player: Player) {
    const client = this.findClient(player);
    if(!client) return;

    this.sendTo(client, {
      action: 'skill_tree',
      skillTree: player.skillTree
    });
  }

  public calcAdjustedGoldGain(gold: number) {
    return Math.floor(gold * this.bonusHelper.settings.goldMult);
  }

  public calcAdjustedSkillGain(skill: number) {
    return Math.floor(skill * this.bonusHelper.settings.skillMult);
  }

  public calcAdjustedXPGain(xp: number) {
    return Math.floor(xp * this.bonusHelper.settings.xpMult);
  }

  public calcAdjustedItemFindGain(itemFindBonus: number) {
    return Math.floor(itemFindBonus * this.bonusHelper.settings.itemFindMult);
  }

  public calcAdjustedPartyXPGain(xpGain: number) {
    return Math.floor(xpGain * this.bonusHelper.settings.partyXPMult);
  }

  public getRandomStatInformation() {
    return {
      numberOfRandomStatsForItems: this.bonusHelper.settings.numberOfRandomStatsForItems,
      randomStatMaxValue: this.bonusHelper.settings.randomStatMaxValue,
      randomStatChance: this.bonusHelper.settings.randomStatChance
    };
  }

  public savePlayerPouch(player: Player) {
    return PouchHelper.savePouch(player);
  }

  public getInteractableByName(name: string) {
    return this.state.getInteractableByName(name);
  }

  public getSpawnerByName(name: string): Spawner {
    return find(this.spawners, { name });
  }

  public addEvent(name: string, callback: (args: any) => void) {
    this.events[name] = this.events[name] || new Signal();
    this.events[name].add(callback);
  }

  public dispatchEvent(name: string, args: any) {
    if(!this.events[name]) throw new Error(`Event ${name} is not created on world!`);

    this.events[name].dispatch(args);
  }

  public broadcastBoughtListing(listingId: string) {
    this.broadcast({ action: 'mb_bought', listingId });
  }

  public givePlayerBasicAbilities(player: Player) {
    if(Object.keys(player.skillTree.nodesClaimed).length > 0) return;

    player.skillTree.calculateNewTPFromSkills(player);
    player.skillTree.syncWithPlayer(player);
    player.$$room.updateSkillTree(player);

    if(player.baseClass === 'Mage')   player.skillTree.buyNode(player, 'MagicMissile', true);
    if(player.baseClass === 'Healer') player.skillTree.buyNode(player, 'Afflict', true);
  }

}
