import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { Message } from '@theia/core/lib/browser';

@injectable()
export class OBSEditorWidgetWidget extends ReactWidget {
    static readonly ID = 'OBSEditorWidget:widget';
    static readonly LABEL = 'OBS Editor';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    protected storyTitle: string = '';

    @postConstruct()
    protected init(): void {
        this.doInit();
    }

    protected async doInit(): Promise<void> {
        this.id = OBSEditorWidgetWidget.ID;
        this.title.label = OBSEditorWidgetWidget.LABEL;
        this.title.caption = OBSEditorWidgetWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-book'; // Example widget icon.
        this.update();
    }

    public displayStory(storyTitle: string): void {
        this.storyTitle = storyTitle;
        this.messageService.info(`Selected story: ${storyTitle}`);
        this.update(); // Call update to re-render the widget view
    }

    render(): React.ReactElement {
        return (
            <div className="markdown-content">
                <h2>Story Title:</h2>
                <p>{this.storyTitle || 'No story selected'}</p>
            </div>
        );
    }

    protected displayMessage(): void {
        this.messageService.info('Congratulations: OBSEditorWidget Widget Successfully Created!');
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const htmlElement = document.getElementById('displayMessageButton');
        if (htmlElement) {
            htmlElement.focus();
        }
    }
}
