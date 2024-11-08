import * as React from "react";
import {
  injectable,
  postConstruct,
  inject,
} from "@theia/core/shared/inversify";
import { ReactWidget } from "@theia/core/lib/browser/widgets/react-widget";
import { MessageService } from "@theia/core";
import { Message, WidgetManager } from "@theia/core/lib/browser";
import { ApplicationShell } from "@theia/core/lib/browser/shell/application-shell";
// import { OBSEditorWidgetWidget } from 'OBSEditorWidget/src/browser/OBSEditorWidget-widget'
import { OBSWidget } from "./obs-widget";
import { FFmpegServer } from "../common/audio-backend-service";
@injectable()
export class OBSExplorerWidget extends ReactWidget {
  static readonly ID = "OBSExplorer:widget";
  static readonly LABEL = "OBSExplorer Widget";
  @inject(FFmpegServer)
  protected readonly server: FFmpegServer;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(WidgetManager)
  protected readonly widgetManager!: WidgetManager;
  @inject(ApplicationShell)
  protected readonly applicationShell!: ApplicationShell;

  // State to keep track of the selected story
  protected selectedStory: string | null = null;

  @postConstruct()
  protected init(): void {
    this.initializeWidget();
  }

  protected async initializeWidget(): Promise<void> {
    this.id = OBSExplorerWidget.ID;
    this.title.label = OBSExplorerWidget.LABEL;
    this.title.caption = OBSExplorerWidget.LABEL;
    this.title.closable = true;
    this.title.iconClass = "fa fa-microphone"; // Example widget icon.
    this.update();
  }

  protected async handleStoryButtonClick(storyTitle: string): Promise<void> {
    this.selectedStory = storyTitle;

    // Check if the OBSWidget is already open
    const widgets = this.applicationShell.getWidgets("main");
    const existingOBSWidget = widgets.find(
      (widget) => widget.id === OBSWidget.ID
    ) as OBSWidget | undefined;

    if (existingOBSWidget) {
      this.messageService.info("OBS Widget is already open.");
      existingOBSWidget.setStoryTitle(storyTitle); // Set the story title in the existing widget
      this.applicationShell.activateWidget(existingOBSWidget.id);
    } else {
      this.messageService.info("Opening OBS Widget...");
      const obsWidget = (await this.widgetManager.getOrCreateWidget(
        OBSWidget.ID
      )) as OBSWidget;
      obsWidget.setStoryTitle(storyTitle); // Set the story title in the new widget
      this.applicationShell.addWidget(obsWidget, { area: "main" });
      this.applicationShell.activateWidget(obsWidget.id);
    }

    this.messageService.info(`You clicked on: ${storyTitle}`);
    this.update();
  }
  render(): React.ReactElement {
    const storyTitles = Array.from({ length: 50 }, (_, i) =>
      (i + 1).toString().padStart(2, "0")
    );

    return (
      <div className="obs-view">
        <h2>Open Bible Stories</h2>
        <div className="story-buttons">
          {storyTitles.map((title, index) => (
            <button
              key={index}
              id={`storyButton${index + 1}`}
              onClick={() => this.handleStoryButtonClick(title)}
              className={this.selectedStory === title ? "selected" : ""} // Highlight selected button
            >
              {title}
            </button>
          ))}
        </div>
      </div>
    );
  }

  protected displayMessage(): void {
    this.messageService.info(
      "Congratulations: OBSExplorer Widget Successfully Created!"
    );
  }

  protected onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    const firstButton = document.getElementById("storyButton1");
    if (firstButton) {
      firstButton.focus();
    }
  }
}
