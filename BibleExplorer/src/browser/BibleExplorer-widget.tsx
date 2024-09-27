import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
// import { AlertMessage } from '@theia/core/lib/browser/widgets/alert-message';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
// import { Message } from '@theia/core/lib/browser';

@injectable()
export class BibleExplorerWidget extends ReactWidget {

    static readonly ID = 'BibleExplorer:widget';
    static readonly LABEL = 'BibleExplorer Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @postConstruct()
    protected init(): void {
        this.doInit()
    }

    protected async doInit(): Promise <void> {
        this.id = BibleExplorerWidget.ID;
        this.title.label = BibleExplorerWidget.LABEL;
        this.title.caption = BibleExplorerWidget.LABEL;
        this.title.closable = true;
        // this.title.iconClass = 'fa fa-window-maximize'; // example widget icon.
        this.update();
    }

    render(): React.ReactElement {
        return (
            <div className="bible-view">
                <h3>Bible Explorer</h3>
                <p>This is a custom view that appears when the "Bible" tab is selected.</p>
            </div>
        );
    }

    // protected displayMessage(): void {
    //     this.messageService.info('Congratulations: BibleExplorer Widget Successfully Created!');
    // }

    // protected onActivateRequest(msg: Message): void {
    //     super.onActivateRequest(msg);
    //     const htmlElement = document.getElementById('displayMessageButton');
    //     if (htmlElement) {
    //         htmlElement.focus();
    //     }
    // }

}
