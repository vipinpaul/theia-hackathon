import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { CommandService, MessageService } from '@theia/core';
import { WidgetManager } from '@theia/core/lib/browser';
import { BibleExplorerWidget } from 'BibleExplorer/src/browser/BibleExplorer-widget';
import { OBSExplorerWidget } from 'OBSExplorer/src/browser/OBSExplorer-widget';

@injectable()
export class ObsExtensionWidget extends ReactWidget {
    static readonly ID = 'widget:widget';
    static readonly LABEL = 'Select Mode';
    
    protected activeTab: string = 'Bible';
    protected bibleExplorerWidgetNode: HTMLElement | null = null;
    protected obsExplorerWidgetNode: HTMLElement | null = null;

    @inject(MessageService)
    protected readonly messageService!: MessageService;
    
    @inject(CommandService)
    protected readonly commandService!: CommandService;
    
    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    @postConstruct()
    protected init(): void {
        this.id = ObsExtensionWidget.ID;
        this.title.label = ObsExtensionWidget.LABEL;
        this.title.caption = ObsExtensionWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-microphone'; // Example icon.
        this.update();
    }

    protected switchTab(tab: string): void {
        this.activeTab = tab;
        this.update(); // Re-render when switching tabs.
    }

    protected async loadBibleExplorer(): Promise<void> {
        if (!this.bibleExplorerWidgetNode) {
            const bibleExplorerWidget = await this.widgetManager.getOrCreateWidget<BibleExplorerWidget>('BibleExplorer:widget');
            if (bibleExplorerWidget) {
                this.bibleExplorerWidgetNode = bibleExplorerWidget.node;
                this.update(); // Ensure the component updates after the widget is loaded.
            } else {
                console.error('Unable to load the BibleExplorer widget');
            }
        }
    }

    protected async loadOBSExplorer(): Promise<void> {
        if (!this.obsExplorerWidgetNode) {
            const obsExplorerWidget = await this.widgetManager.getOrCreateWidget<OBSExplorerWidget>('OBSExplorer:widget');
            if (obsExplorerWidget) {
                this.obsExplorerWidgetNode = obsExplorerWidget.node;
                this.update(); // Ensure the component updates after the widget is loaded.
            } else {
                console.error('Unable to load the OBSExplorer widget');
            }
        }
    }

    protected renderBibleContent(): React.ReactNode {
        if (!this.bibleExplorerWidgetNode) {
            this.loadBibleExplorer();
            return <div>Loading Bible Explorer...</div>;
        }
        return (
            <div>
                <div ref={element => {
                    if (element && this.bibleExplorerWidgetNode) {
                        // First, clear the element's innerHTML to avoid rendering multiple instances
                        element.innerHTML = '';
                        // Append the BibleExplorer widget node to the current DOM element
                        element.appendChild(this.bibleExplorerWidgetNode);
                    }
                }} />
            </div>
        );
    }

    protected renderOBSContent(): React.ReactNode {
        if (!this.obsExplorerWidgetNode) {
            this.loadOBSExplorer();
            return <div>Loading OBS Explorer...</div>;
        }
        return (
            <div>
                <div ref={element => {
                    if (element && this.obsExplorerWidgetNode) {
                        // First, clear the element's innerHTML to avoid rendering multiple instances
                        element.innerHTML = '';
                        // Append the OBSExplorer widget node to the current DOM element
                        element.appendChild(this.obsExplorerWidgetNode);
                    }
                }} />
            </div>
        );
    }

    render(): React.ReactElement {
        return (
            <div className="tabs-container">
                <div className="tabs">
                    <button
                        className={`tab ${this.activeTab === 'Bible' ? 'active' : ''}`}
                        onClick={() => this.switchTab('Bible')}
                    >
                        Bible
                    </button>
                    <button
                        className={`tab ${this.activeTab === 'OBS' ? 'active' : ''}`}
                        onClick={() => this.switchTab('OBS')}
                    >
                        OBS
                    </button>
                </div>

                {/* Render only the selected tab's content */}
                <div className="tab-content">
                    {this.activeTab === 'Bible' ? this.renderBibleContent() : this.renderOBSContent()}
                    {/* { this.renderOBSContent()} */}
                </div>
            </div>
        );
    }
}
