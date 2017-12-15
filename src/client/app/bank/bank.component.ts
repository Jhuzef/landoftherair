import { Component } from '@angular/core';
import { ColyseusGameService } from '../colyseus.game.service';

@Component({
  selector: 'app-bank',
  templateUrl: './bank.component.html',
  styleUrls: ['./bank.component.scss']
})
export class BankComponent {

  public bankNumber = 0;

  constructor(public colyseusGame: ColyseusGameService) { }

  get allBanks() {
    return Object.keys(this.colyseusGame.character.banks || {}).sort();
  }

  get currentBankGold(): number {
    return this.colyseusGame.character.banks ? this.colyseusGame.character.banks[this.colyseusGame.showBank.bankId] : 0;
  }

}
