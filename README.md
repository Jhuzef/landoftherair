# Land of the Rair [![Build Status](https://travis-ci.org/LandOfTheRair/landoftherair.svg?branch=master)](https://travis-ci.org/LandOfTheRair/landoftherair)

A high fantasy MORPG inspired by the MUDs of olde.

## Requirements

* Node.js (recommended: 8.0.0+)
* npm (needed: 5.x+)
* MongoDB (recommended: 3.4.4+, or a hosted service, like MLab)
* Redis (or a hosted redis service, like Redis Lab)

## Install

* `npm install`
* `npm run setup`
* `npm start` (or run `npm run start:client` and `npm run start:server` separately)

## Environment Variables

First, create a [`.env`](https://www.npmjs.com/package/dotenv) file in the root. Then, populate it with these values:

* `MONGODB_URI` - the URI that leads to a mongodb instance (for example: `mongodb://localhost:27017/rair`)
* `REDIS_URL` - a URI that leads to a redis cache (for example: `redis://localhost:6379`)

If you want to use Auth0, you can set this value (if you don't, see the section [Authenticating Locally](#authenticating-locally) below):

* `AUTH0_SECRET` - Auth0 server secret

If you want strict validation of users (ie, if you're doing anything sensitive like taking payments), set these values:

* `AUTH0_JWKS_URI` - the URI that leads to the Auth0 JWKS JSON file

If you want to test Discord integration, you can also add:

* `DISCORD_SECRET` - the discord secret for your discord bot
* `DISCORD_GUILD` - the discord guild for your discord bot
* `DISCORD_WATCHER_ROLE` - the watcher role for your discord bot (default: "Event Watcher")
* `DISCORD_VERIFIED_ROLE` - the role for a user to get when they connect their discord (default: "Verified")
* `DISCORD_MUTED_ROLE` - the role for a user who is muted in game (default: "Muted")
* `DISCORD_SUBSCRIBER_ROLE` - the role for a user to get when they subscribe (default: "Subscriber")
* `DISCORD_ONLINE_ROLE` - the role for a user who is "always online" (default: Online In Lobby)
* `DISCORD_CHANNEL` - the id of the channel for your discord bot to talk in
* `DISCORD_BOT_CHANNEL` - the id of the channel for your discord bot to listen for commands in
* `DISCORD_BOT_NAME` - the name of the bot as it was set up (default: "LandOfTheRairLobby")

Also, your bot will need a role that can assign roles.

If you want to test Stripe, you need to add:

* `STRIPE_TOKEN` - the Stripe secret key

If you want to test GameAnalytics, you need to add:

* `GAMEANALYTICS_GAME_KEY` - the GameAnalytics game key
* `GAMEANALYTICS_SECRET_KEY` - the GameAnalytics secret key

## Setup

### Initial Setup

For initial setup, run this:

* `npm run setup`

### Content Creation

For subsequent updates and specific changes, you can run these instead:

* `npm run seed:items` - this will populate the database with items
* `npm run seed:npcs`  - this will populate the database with npc data
* `npm run seed:drops` - this will populate the database with drop table data
* `npm run seed:recipes` - this will populate the database with recipe data
* `npm run task:macros`- this will generate the macro icon metadata. If you add new icons, please only take from [my repository](http://seiyria.com/gameicons-font/).

## Authenticating Locally

If you do not want to use Auth0 for some particular reason, you can bypass it by adding `?username=myusername` to the URL. This does not work in production mode.

## Making Yourself a GM

If you want to do any debugging, you'll need to make yourself a GM. To do that, you'll want to set your account to be a GM. Open up a mongo shell or run this query through an external tool:

```
db.accounts.update({ username: 'YOUR_ACCOUNT_NAME' }, { $set: { isGM: true } });
```

You only need to do this once.

## Testing Outside Of `localhost`

By default, the client is configured to connect to `localhost`. If you want to connect somewhere else (say, you're using a VM), you can change `src/client/environments/environment.ts` to reflect the location of your server. For example, if you're developing in a VM, you probably want to change the two instances of `localhost` to be the IP of the VM.

### Server Debug Routes

Some routes are enabled for debugging purposes and are otherwise unused. You can visit:

* `/server` for server stats
* `/premium-stats` for premium buying stats
* `/item-stats` for avg. item stats
* `/item-csv` for the item database dumped to a CSV
* `/logs` for server logs (log entries expire after 6h)
* `/maps` to see all of the maps in the game presently

### Commands

Some commands are hidden and don't really need to be used by players, but should be used when testing out moderation features. Commands have varying prefixes, such as:

* `~` - an internal command used by the UI
* `~~` - a debugging command for players
* `^` - a command for testers (and GMs)
* `@` - a command for GMs

#### Internal Commands

* `~clear` - clear the command buffer
* `~drink` - drink a potion from your potion slot
* `~interact` - called when clicking on something interactable
* `~look` - look at the ground (only used by `~search`)
* `~move` - called when clicking on the map to move
* `~restore` - be dead no more
* `~say` - talk to other players nearby
* `~search` - search corpses on the ground, then look
* `~talk` - called automatically when doing `xxx, message` - will trigger appropriate dialog for an npc if it has any
* `~trait` - buy traits
* `~unapply` - unapply a buff by name
* `~use` - use an item

#### Debugging Commands

* `~~bonuses` - see the current map bonuses
* `~~pos` - get your current x, y, and map
* `~~reset` - reset your buffs and additionalStats
* `~~items` - count the number of items in the world
* `~~mobs` - count the number of mobs in the world
* `~~ping` - check your ping
* `~~flagged` - check your flagged skills
* `~~lag` - run `pos`, `items`, `mobs`, and `ping`
* `~~combatlogstart <maxentries=1000>` - start logging combat data (this will clear any existing combat log data) - more than 1000 entries is not recommended
* `~~combatlogstop` - stop logging combat data
* `~~combatlogdownload` - download a CSV of your combat log data
* `~~togglefov` - toggle the FOV (dark spaces) on/off

#### Testing Commands

Certain accounts designated as testers get access to several in game commands:

* `^gold <gold>` - gain `<gold>` gold
* `^loadout <level>` - generate a loadout for your class level
* `^level <level>` - set your level to `<level>`
* `^owts <boost>` - increase all of your worn/held gear with an Owts enchantment by `<boost>`
* `^hp <newhp>` - set your hp to `<newhp>`
* `^mp <newmp>` - set your mp to `<newmp>`
* `^regen <newregen>` - set your hp/mp regen to `<newregen>`
* `^skills <level>` - set your skills to `<level>`
* `^stats <level>` set your stats to `<level>`
* `^traits` - reset your traits and gain 1000 TP

#### GM Commands

As a GM, you get access to several commands in the lobby:

* `/motd <motd>` - set the MOTD in the lobby
* `/resetmotd` - unset the MOTD
* `/alert <msg>` - alert every player with a certain message (very annoying!)
* `/subscribe <period> <account>` - set the account on a trial subscription lasting for `period` days
* `/unsubscribe <account>` - remove the accounts subscription
* `/silver <silver> <account>` - give `silver` silver to the target account
* `/tester <account>` - make `account` a test account
* `/kick <account>` - kick `account` from the lobby
* `/festival <festivalish>` - update the global festival data using festivalish (settings that can be changed are `GameSettings`, see below)

You also get access to some commands in-game:

* `@allegiance <allegiance>` - change your allegiance to `allegiance`. If `GM` is specified, then you will be non-hostle to everything, and they will be non-hostile to you
* `@gold <num>` - create <num> gold on your tile
* `@currency <type> <num>` - give yourself `num` of `type` currency
* `@item <item name>` - create a particular item on your tile
* `@itemdupe` - copy your right hand to your left hand
* `@copyplayer <name>` - copy the stats, skills, gear, and traits of `player`
* `@examine <nothing|npcish> <nothing|prop>` - if `npcish` is specified, will examine an npc (if `prop` is specified, it will print only that prop). Otherwise, it'll examine your right hand item
* `@itemforge propsish` - create an item using props syntax, for example: `sprite=1 type=Hammer stats.str=1`
* `@mapnpcstat propsish` - modify the stats of all NPCs on the map by `propsish`
* `@skill <skillname> <xpgain>` - gain `xpgain` skill for `skillname`
* `@tp <tpgain>` - gain `tpgain` trait points
* `@axp <axpgain>` gain `axp` AXP
* `@xp <xp>` - gain `xp` XP
* `@intercept <target>` - you will see log messages as this target (as well as your own).
* `@kill <target>` - will instantly kill `target`
* `@lootvortex <radius>` - pull every item in `radius` tiles to the current one
* `@itemmod propsish` - modify your rightHand item based on props specified, for example: `ounces=10`
* `@npcmod npcish propsish` - modify the npc based on propsish
* `@partyjoin partyname` - automatically join `partyname` if it exists, regardless of leader visibility
* `@respawn lairname` - respawn `lairname` on the current map
* `@searchitems itemname` - search all the items for itemname
* `@searchnpcs npcname` - search all the items for npcname
* `@spawnnpc npc.npcId="NPC Internal ID" spawner.*=*` - spawn a monster of the given id, with optional spawner props
* `@summon playerish` - summon any player who matches playerish
* `@teleport <x> <y> [map]` - teleport to X,Y, and if map is specified, you'll also change maps
* `@teleporttile <x> <y> <map>` - create a teleport tile to X, Y, Map that anyone can use
* `@teleportto npcish` - teleport to an npc matching a name like npcish
* `@sight` - give yourself the ability to see through walls

#### Game Settings

Internally, there are a large handful of game settings that control how players gain anything. They are pretty self-explanatory:

* `xpMult` - the xp multiplier, default 1
* `axpMult` - the ancient xp multiplier, default 1
* `skillMult` - the skill multiplier, default 1
* `goldMult` - the gold multiplier, default 1
* `itemFindMult` - the item find multiplier, default 1
* `numberOfRandomStatsForItems` - the number of random stats an item can generate with, default 0
* `randomStatMaxValue` - the max value a random stat can be on an item, default 0
* `randomStatChance` - the chance of an item generating with a random stat (1-1000000), default 0

## Creating a Local Development Environment with Docker

Note: This environment has only been tested with Docker on Windows

### Requirements

* Docker (Version: 2.1.0.4+)

### Environmental Variables

Create a .env file in the root directory and define the keys and values listed below:

* `MONGODB_URI` - `mongodb://database:27017/rair`
* `REDIS_URL` - `redis://server:6379`
* `AUTH0_SECRET` - get an Auth0 secret key from https://auth0.com/

### Launching the Development Environment

From the root directory type: `docker-compose up`

The containers will be built based off the current source code and launched.

Access the the running game by visiting `http://localhost:4567/?username=$STRING`

If you make changes to the source code, you will need to destroy the cached image by running: `docker-compose down --rmi 'all'` and then relaunching the containers with `docker-compose up` from the root directory
