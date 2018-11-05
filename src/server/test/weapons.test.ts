
import test from 'ava-ts';
import { WeaponClasses } from '../../shared/interfaces/item';
import { BaseItemStatsPerTier } from '../helpers/world/combat-helper';

test('All weapon types have a tier associated with them', async t => {
  WeaponClasses.forEach(itemClass => {
    t.truthy(BaseItemStatsPerTier[itemClass], itemClass);
  });
});
