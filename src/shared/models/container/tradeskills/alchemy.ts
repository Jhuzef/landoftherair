
import { extend } from 'lodash';

import { Item } from '../../item';
import { Container } from '../container';
import { IAlchemyContainer } from '../../../interfaces/container';

export class AlchemyContainer extends Container implements IAlchemyContainer {

  protected autoFix = false;

  constructor(opts) {
    super({ size: 9 });
    extend(this, opts);
    this.initItems();
  }

  get reagents(): Item[] {
    return this.items.slice(0, 8);
  }

  get result(): Item {
    return this.items[8];
  }

  set result(item: Item) {
    this.items[8] = item;
  }

  clearReagents() {
    for(let i = 0; i < 8; i++) {
      this.items[i] = null;
    }
  }

  canAccept(item, index?: number) {
    return index >= 0 && index < 8 && super.canAccept(item);
  }
}
