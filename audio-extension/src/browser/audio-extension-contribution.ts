import { injectable, inject } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser';
import { AudioWidget } from './audio-widget';
import { FFmpegServer } from "OBSExplorer/lib/common/audio-backend-service";

export const AudioCommand: Command = { id: 'Audio:command' };

@injectable()
export class AudioContribution extends AbstractViewContribution<AudioWidget> {

    constructor(
        @inject(FFmpegServer) protected readonly server: FFmpegServer 
    ) {
        super({
            widgetId: AudioWidget.ID,
            widgetName: AudioWidget.LABEL,
            defaultWidgetOptions: { area: 'bottom' },
            toggleCommandId: AudioCommand.id,
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AudioCommand, {
            execute: () => super.openView({ activate: true }),
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
            commandId: AudioCommand.id,
            label: 'Audio Recorder',
        });
    }
}