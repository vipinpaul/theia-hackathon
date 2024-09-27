import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import React = require('react');
import { marked } from 'marked';

@injectable()
export class OBSWidget extends ReactWidget {
    static readonly ID = 'obs-widget';
    static readonly LABEL = 'OBS Widget';

    protected storyTitle: string = '01'; // default title
    protected markdownContent: string = ''; // Markdown content
    protected isLoading: boolean = true; // Loading state

    @postConstruct()
    protected init(): void {
        this.id = OBSWidget.ID;
        this.title.label = OBSWidget.LABEL;
        this.title.caption = OBSWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-file'; // Icon for the widget

        this.update(); // Trigger the initial rendering
    }

    protected async onAfterAttach(): Promise<void> {
        this.isLoading = true; // Set loading state to true
        this.markdownContent = await this.fetchStoryContent(this.storyTitle); // Fetch initial content
        this.isLoading = false; // Set loading state to false
        this.update(); // Update the widget view
    }

    setStoryTitle(title: string): void {
        this.storyTitle = title;
        this.fetchStoryContent(title).then(content => {
            this.markdownContent = content; // Update the markdown content
            this.update(); // Trigger re-render
        });
    }

    protected async fetchStoryContent(title: string): Promise<string> {
        try {
            const response = await fetch(`https://git.door43.org/Door43-Catalog/hi_obs/raw/branch/master/content/${title}.md`);
            if (response.ok) {
                const content = await response.text();
                return marked(content); // Return the parsed markdown content
            } else {
                return 'Failed to load content.';
            }
        } catch (error) {
            console.error('Error fetching story content:', error);
            return 'Error fetching content.';
        }
    }

    render(): React.ReactElement {
        return (
            <div style={{ height: '100%', overflow: 'hidden' }}>
                {this.isLoading ? (
                    <div className="loader">Loading content...</div>
                ) : (
                    <div style={{ height: '100%', overflowY: 'auto', padding: '10px' }}>
                        <div dangerouslySetInnerHTML={{ __html: this.markdownContent }} />
                    </div>
                )}
            </div>
        );
    }
}
