
import { reject, difference, values, isArray, isNumber } from 'lodash';

import { Stats } from '../../shared/interfaces/character';
import * as Classes from '../classes';
import * as Effects from '../effects';
import { AllTraits } from '../../shared/traits/trait-hash';

const argv = require('minimist')(process.argv.slice(2));
require('dotenv').config({ silent: true, path: argv.prod ? '.env.prod' : '.env' });

import { DB } from '../database';

import * as YAML from 'yamljs';
import * as recurse from 'recursive-readdir';
import * as path from 'path';

import { includes, flatten, isUndefined, capitalize } from 'lodash';

import {
  Item} from '../../shared/models/item';
import { SkillClassNames } from '../../shared/interfaces/character';
import { AmmoClasses, ArmorClasses, ShieldClasses, ValidItemTypes, WeaponClasses } from '../../shared/interfaces/item';

const ValidSkillNames = values(SkillClassNames);

class ItemLoader {

  static async loadAllItems() {
    await DB.init();

    let filePromises = [];

    try {
      const files = await recurse(`${__dirname}/../../content/items`);

      filePromises = files.map(file => {
        const basePath = file.split('items' + path.sep)[1];
        const basePathLeftSide = basePath.split(path.sep)[0];
        const itemClassRoot = path.basename(basePathLeftSide, path.extname(basePathLeftSide));

        let itemsOfType = null;
        try {
          itemsOfType = YAML.load(file);
        } catch(e) {
          console.error(`Failed to parse file: ${file}`);
          process.exit(-1);
        }

        const promises = itemsOfType.map(itemData => {
          itemData.itemClass = itemClassRoot;
          itemData.type = itemData.type || SkillClassNames.Martial;
          if(!itemData.stats) itemData.stats = {};

          return new Promise((resolve) => {
            ItemLoader.conditionallyAddInformation(itemData);
            if(!ItemLoader.validateItem(itemData)) return reject(new Error(`${itemData.name} failed validation.`));
            return resolve(itemData);
          });

        });

        return promises;
      });
    } catch(e) {
      console.error(e);
      process.exit(-1);
    }

    try {
      const allItemData = await Promise.all(flatten(filePromises));

      console.log('Validated all items.');

      await DB.$items.remove({}, { multi: true });

      console.log('Removed old items.');

      const allItemDataPromises = allItemData.map((itemData: any) => {
        return DB.$items.insert(itemData);
      });

      await Promise.all(flatten(allItemDataPromises));

      console.log('Inserted all items.');

    } catch(e) {
      console.error(e);
      process.exit(-1);
    }

    Promise.all(flatten(filePromises)).then(() => {
      console.log('Done');
      process.exit(0);
    });
  }

  static isWeapon(item: Item) {
    return includes(WeaponClasses, item.itemClass);
  }

  static isArmor(item: Item) {
    return includes(ArmorClasses, item.itemClass);
  }

  static conditionallyAddInformation(item: Item) {
    if(this.isWeapon(item)) {
      if(isUndefined(item.isBeltable))  item.isBeltable = true;
      if(isUndefined(item.isSackable))  item.isSackable = false;
    }

    if(this.isArmor(item)) {
      if(isUndefined(item.isBeltable))  item.isBeltable = false;
      if(isUndefined(item.isSackable))  item.isSackable = false;

      if(includes(['Tunic', 'Fur', 'Scaleplate'], item.itemClass)) {
        if(!item.stats.mitigation) item.stats.mitigation = 10;
      }

      if(includes(['Breastplate', 'Fullplate'], item.itemClass)) {
        if(!item.stats.mitigation) item.stats.mitigation = 25;
      }
    }

    if(item.itemClass === 'Twig') {
      item.type = 'Staff';
    }

    if(item.itemClass === 'Tunic' || item.itemClass === 'Fur') {
      item.isSackable = true;
    }

    if(includes(AmmoClasses, item.itemClass)) {
      item.isBeltable = true;
    }

    if(item.type === 'Polearm') {
      item.isBeltable = false;
      item.twoHanded = true;
      item.attackRange = 1;
    }

    if(includes(['Blunderbuss', 'Shortbow', 'Longbow', 'Greatmace', 'Greataxe'], item.itemClass)) {
      item.twoHanded = true;
      item.secondaryType = 'Twohanded';
    }

    if(includes(['Crossbow', 'Shortbow', 'Longbow', 'Blunderbuss'], item.itemClass)) {
      item.canShoot = true;
    }

    if(includes(['Crossbow', 'Shortbow', 'Longbow', 'Blunderbuss'], item.itemClass) || item.type === 'Ranged') {
      item.attackRange = 5;
    }

    if(includes(ShieldClasses, item.itemClass)) {
      item.type = 'Mace';
      if(!item.stats.accuracy) item.stats.accuracy = 0;
      if(!item.stats.mitigation) item.stats.mitigation = 5;
      if(!item.tier) item.tier = 1;
    }

    if(item.type === 'Twohanded' || item.secondaryType === 'Twohanded') {
      item.twoHanded = true;
      if(!item.proneChance && item.type !== 'Ranged') item.proneChance = 5;
    }

    if(includes(['Breastplate', 'Fullplate'], item.itemClass)) {
      item.isHeavy = true;
    }

    if(item.itemClass === 'Saucer') {
      item.isSackable = true;
    }

    if(item.itemClass === 'Bottle' || item.itemClass === 'Food') {
      item.ounces = isNumber(item.ounces) ? item.ounces : 1;
    }

    if(item.itemClass === 'Trap') {
      item.trapUses = item.trapUses || 1;
    }

    item.type = capitalize(item.type);
    if(item.secondaryType) item.secondaryType = capitalize(item.secondaryType);
  }

  static validateItem(item: Item): boolean {
    let hasBad = false;

    if(!item.name)                            { console.error(`ERROR: ${JSON.stringify(item)} has no name!`); hasBad = true; }
    if(!item.desc)                            { console.error(`ERROR: ${item.name} has no description!`); hasBad = true; }
    if(!item.sprite)                          { console.error(`ERROR: ${item.name} has no sprite!`); hasBad = true; }
    if(!includes(ValidItemTypes, item.type))  { console.error(`ERROR: ${item.name} has an invalid item type!`); hasBad = true; }

    if(item.requirements && item.requirements.profession) {
      const invalidClasses = reject(item.requirements.profession, testClass => Classes[testClass]);
      if(invalidClasses.length > 0) {
        console.error(`ERROR: ${item.name} has invalid class requirements: ${invalidClasses.join(', ')}`);
        hasBad = true;
      }
    }

    if(item.requirements && item.requirements.skill) {
      const { name, level } = item.requirements.skill;
      if(!name || !level || level < 0) {
        console.error(`ERROR: ${item.name} needs a name and a level for requirements`);
        hasBad = true;
      }

      if(!includes(ValidSkillNames, name)) {
        console.error(`ERROR: ${item.name} has an invalid skill type ${name}`);
        hasBad = true;
      }
    }

    if(item.trait) {
      const { name, level } = item.trait;
      if(!name || !level || level < 0) {
        console.error(`ERROR: ${item.name} needs a name and a level for trait`);
        hasBad = true;
      }
    }

    if(item.stats) {
      const statsTest = new Stats();
      let invalidStats = difference(Object.keys(item.stats), Object.keys(statsTest));

      invalidStats = invalidStats.filter(x => {
        if(!includes(x, 'Bonus')) return true;
        return !includes(ValidSkillNames, capitalize(x.substring(0, x.indexOf('Bonus'))));
      });

      if(invalidStats.length > 0 && invalidStats[0] !== 'effect') {
        console.error(`ERROR: ${item.name} has invalid stats: ${invalidStats.join(', ')}`);
        hasBad = true;
      }
    }

    // having potency = it's castable
    if(item.effect && !Effects[item.effect.name]) {
      console.error(`ERROR: ${item.name} has an invalid effect name: ${item.effect.name}`);
      hasBad = true;
    }

    if(item.effect && !Effects[item.effect.name] && (!item.effect.uses || !item.effect.potency)) {
      console.error(`ERROR: ${item.name} has an invalid effect: ${JSON.stringify(item.effect)}`);
      hasBad = true;
    }

    if(item.itemClass === 'Box' && (!item.containedItems || item.containedItems.length === 0)) {
      console.error(`ERROR: ${item.name} is a box but the contents aren't valid`);
      hasBad = true;
    }

    if(item.trait) {
      let found = false;
      Object.keys(AllTraits).forEach(traitCat => {
        if(isArray(item.trait.name)) {
          (<any>item.trait.name).forEach(traitName => {
            if(AllTraits[traitCat][traitName]) found = true;
          });
        } else {
          if(AllTraits[traitCat][item.trait.name]) found = true;
        }
      });

      if(!found) {
        console.error(`ERROR: ${item.name} has a bad trait ${item.trait.name}`);
        hasBad = true;
      }
    }

    if(hasBad) {
      throw new Error('Invalid item. Stopping.');
    }

    return true;
  }

}

ItemLoader.loadAllItems();
