
import { nonenumerable } from 'nonenumerable';
import { extend } from 'lodash';

export type Status = 'Available' | 'AFK';

export class Account {
  @nonenumerable
  _id?: any;

  colyseusId?: string;

  @nonenumerable
  createdAt: number;

  @nonenumerable
  userId: string;

  characterNames: string[] = [];

  @nonenumerable
  maxCharacters = 4;

  username: string;
  isGM = false;
  inGame = -1;
  status: Status = 'Available';

  constructor(opts) {
    extend(this, opts);
  }
}
