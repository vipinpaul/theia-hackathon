import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { Message, WidgetManager } from '@theia/core/lib/browser';
// import { OBSEditorWidgetWidget } from 'OBSEditorWidget/src/browser/OBSEditorWidget-widget'

@injectable()
export class OBSExplorerWidget extends ReactWidget {
    static readonly ID = 'OBSExplorer:widget';
    static readonly LABEL = 'OBSExplorer Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

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
        this.title.iconClass = 'fa fa-microphone'; // Example widget icon.
        this.update();
    }

    protected async handleStoryButtonClick(storyTitle: string): Promise<void> {
        // Update the selected story
        this.selectedStory = storyTitle;

        // Create or retrieve the OBSEditorWidget and update its content
        // const obsEditorWidget = await this.widgetManager.getOrCreateWidget<OBSEditorWidgetWidget>(OBSEditorWidgetWidget.ID);
        // if (obsEditorWidget) {
        //     obsEditorWidget.displayStory(storyTitle); // Call displayStory to update the story
        //     this.update(); // Ensure the component updates after the widget is loaded.
        // } else {
        //     console.error('Unable to load the OBSEditor widget');
        // }
        
        this.messageService.info(`You clicked on: ${storyTitle}`);
        this.update(); // Update to reflect the selected story
    }

    render(): React.ReactElement {
        const storyTitles = [
    "1. The Creation", "2. Sin Enters the World", "3. The Flood", 
    "4. God’s Covenant with Abraham", "5. The Son of Promise",
    "6. God Provides for Isaac", "7. God Blesses Jacob", 
    "8. God Saves Joseph and His Family", "9. God Calls Moses", 
    "10. The Ten Plagues", "11. The Passover", "12. The Exodus", 
    "13. God’s Covenant with Israel", "14. Wandering in the Wilderness", 
    "15. The Promised Land", "16. The Deliverers", 
    "17. God’s Covenant with David", "18. The Divided Kingdom", 
    "19. The Prophets", "20. The Exile and Return", 
    "21. God Promises the Messiah", "22. The Birth of John", 
    "23. The Birth of Jesus", "24. John Baptizes Jesus", 
    "25. Satan Tempts Jesus", "26. Jesus Starts His Ministry", 
    "27. The Story of the Good Samaritan", "28. The Rich Young Ruler", 
    "29. The Story of the Unmerciful Servant", 
    "30. Jesus Feeds Thousands of People", "31. Jesus Walks on Water", 
    "32. Jesus Heals a Demon-Possessed Man & a Sick Woman", 
    "33. The Story of the Farmer", "34. Jesus Teaches Other Stories", 
    "35. The Story of the Compassionate Father", 
    "36. The Transfiguration", "37. Jesus Raises Lazarus from the Dead", 
    "38. Jesus Is Betrayed", "39. Jesus Is Put on Trial", 
    "40. Jesus Is Crucified", "41. God Raises Jesus from the Dead", 
    "42. Jesus Returns to Heaven", "43. The Church Begins", 
    "44. Peter and John Heal a Beggar", "45. Stephen and Philip", 
    "46. Saul Becomes a Follower of Jesus", "47. Paul and Silas in Philippi", 
    "48. Jesus Is the Promised Messiah", "49. God’s New Covenant", 
    "50. Jesus Returns"
];


return (
    <div className="obs-view">
        <h2>Open Bible Stories</h2>
        <div className="story-buttons">
            {storyTitles.map((title, index) => (
                <button
                    key={index}
                    id={`storyButton${index + 1}`}
                    onClick={() => this.handleStoryButtonClick(title)}
                    className={this.selectedStory === title ? 'selected' : ''} // Highlight selected button
                >
                    {title}
                </button>
            ))}
        </div>
    </div>
);
}

protected displayMessage(): void {
this.messageService.info('Congratulations: OBSExplorer Widget Successfully Created!');
}

protected onActivateRequest(msg: Message): void {
super.onActivateRequest(msg);
const firstButton = document.getElementById('storyButton1');
if (firstButton) {
    firstButton.focus();
}
}
}