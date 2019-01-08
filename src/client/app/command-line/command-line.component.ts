import { Component, Input, OnInit, OnDestroy, ViewChild, EventEmitter, Output } from '@angular/core';
import { LocalStorage } from 'ngx-webstorage';
import { ColyseusGameService } from '../colyseus.game.service';
import { ColyseusLobbyService } from '../colyseus.lobby.service';

import { startsWith } from 'lodash';

import { environment } from '../../environments/environment';
import { MacroService } from '../macros.service';

type Mode = 'cmd' | 'say' | 'party' | 'global';

@Component({
  selector: 'app-command-line',
  templateUrl: './command-line.component.html',
  styleUrls: ['./command-line.component.scss']
})
export class CommandLineComponent implements OnInit, OnDestroy {

  @Input()
  public rightClickSend: boolean;

  @Output()
  public visibility = new EventEmitter();

  @ViewChild('cmdEntry')
  public cmdEntryInput;

  @LocalStorage()
  public cmdMode: Mode;

  private listener: any;
  private sendListener: any;
  private macro$: any;

  private curIndex = -1;

  public get placeholder(): string {
    if(this.cmdMode === 'say') return 'Type your message here...';
    if(this.cmdMode === 'party') return 'Chat to your party here...';
    if(this.cmdMode === 'global') return 'Type your message to share to lobby here...';
    if(this.cmdMode === 'cmd') return 'Enter your command here...';
  }

  public get buttonText(): string {
    if(this.cmdMode === 'say') return 'Say';
    if(this.cmdMode === 'party') return 'Party';
    if(this.cmdMode === 'global') return 'Global';
    if(this.cmdMode === 'cmd') return 'Cmd';
  }

  public get nextMode(): Mode {
    if(this.cmdMode === 'say') return 'party';
    if(this.cmdMode === 'party') return 'global';
    if(this.cmdMode === 'global') return 'cmd';
    if(this.cmdMode === 'cmd') return 'say';
  }

  constructor(
    public colyseusGame: ColyseusGameService,
    public colyseusLobby: ColyseusLobbyService,
    public macroService: MacroService
  ) {}

  ngOnInit() {
    this.listener = (ev) => {

      if(this.cmdEntryInput.nativeElement === document.activeElement && ev.key === 'Tab') {
        this.cmdMode = this.nextMode;
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }

      if(this.cmdEntryInput.nativeElement === document.activeElement && ev.key === 'Enter' && !this.colyseusGame.currentCommand) {
        this.visibility.emit(false);
        this.cmdEntryInput.nativeElement.blur();
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }

      if(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if(this.macroService.hasMacroMatching(ev.key)) return;
      if(ev.key !== 'Enter') return;

      this.visibility.emit(true);

      this.focusSelf();
    };

    document.addEventListener('keydown', this.listener);

    this.sendListener = (ev) => {
      if(environment.production) {
        ev.preventDefault();
      }
      if(!this.rightClickSend) return;
      this.sendCommand();
    };

    document.addEventListener('contextmenu', this.sendListener);

    if(!this.cmdMode) this.cmdMode = 'cmd';

    this.macro$ = this.colyseusGame.macroCommand.subscribe(command => {
      this.colyseusGame.currentCommand = command;
      this.visibility.emit(true);

      this.focusSelf();
    });
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.listener);
    document.removeEventListener('contextmenu', this.sendListener);
    this.macro$.unsubscribe();
  }

  private focusSelf() {
    setTimeout(() => {
      this.cmdEntryInput.nativeElement.focus();
    }, 0);
  }

  sendCommand() {
    if(!this.colyseusGame.currentCommand || !this.colyseusGame.currentCommand.trim()) return;

    const shouldBypassOthers = startsWith(this.colyseusGame.currentCommand, '#');

    if(!shouldBypassOthers && this.cmdMode === 'say') {
      this.colyseusGame.sendCommandString(`~say ${this.colyseusGame.currentCommand}`);
      this.colyseusGame.currentCommand = '';
      return;
    }

    if(!shouldBypassOthers && this.cmdMode === 'party') {
      this.colyseusGame.sendCommandString(`~partysay ${this.colyseusGame.currentCommand}`);
      this.colyseusGame.currentCommand = '';
      return;
    }

    if(!shouldBypassOthers && this.cmdMode === 'global') {
      this.colyseusLobby.sendMessage(this.colyseusGame.currentCommand);
      this.colyseusGame.currentCommand = '';
      return;
    }

    if(shouldBypassOthers) {
      this.colyseusGame.currentCommand = this.colyseusGame.currentCommand.substring(1);
    }

    this.curIndex = -1;

    if(this.colyseusGame.currentCommand === '.' && this.colyseusGame.lastCommands[0]) {
      this.colyseusGame.sendCommandString(this.colyseusGame.lastCommands[0]);
      this.colyseusGame.currentCommand = '';
      return;
    }

    this.colyseusGame.sendCommandString(this.colyseusGame.currentCommand);

    this.colyseusGame.doCommand(this.colyseusGame.currentCommand);

    this.colyseusGame.currentCommand = '';

    (<HTMLElement>document.activeElement).blur();
    this.visibility.emit(false);
  }

  setCommandFromIndex() {
    if(this.curIndex === -1) this.colyseusGame.currentCommand = '';
    if(!this.colyseusGame.lastCommands[this.curIndex]) return;

    const cmd = this.colyseusGame.lastCommands[this.curIndex];
    this.colyseusGame.currentCommand = cmd;
  }

  prevCommand($event) {
    $event.preventDefault();
    if(this.curIndex >= this.colyseusGame.lastCommands.length) return;
    this.curIndex++;
    this.setCommandFromIndex();
  }

  nextCommand($event) {
    $event.preventDefault();
    if(this.curIndex <= -1) return;
    this.curIndex--;
    this.setCommandFromIndex();
  }
}
