import {
	inject,
	injectable,
	postConstruct,
} from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import React = require('react');
// import { fetchData } from './textTospeech';
import { Texttospeech } from 'audio-extension/lib/browser/Texttospeech';
// import { marked } from 'marked';
import { MessageService } from '@theia/core';
@injectable()
export class OBSWidget extends ReactWidget {
	static readonly ID = 'obs-widget';
	static readonly LABEL = 'OBS Widget';

	protected storyTitle: string = '01'; // default title
	// protected markdownContent: string = ''; // Markdown content
	protected isLoading: boolean = true; // Loading state
	public obsStory: [any];
	@inject(MessageService)
	protected readonly messageService!: MessageService;
	public TTSinstance = new Texttospeech(this.messageService);
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
		this.obsStory = await this.fetchStoryContent(this.storyTitle); // Fetch initial content
		console.log('this.obsStory', this.obsStory);

		this.isLoading = false; // Set loading state to false
		this.update(); // Update the widget view
	}

	setStoryTitle(title: string): void {
		this.storyTitle = title;
		this.fetchStoryContent(title).then((content) => {
			console.log(content);

			this.obsStory = content; // Update the markdown content
			this.update(); // Trigger re-render
		});
	}
	MdToJson = (data: string) => {
		//convert md file text into json object
		//render story from json array object
		let story: any = [];
		let id: number = 0;
		const allLines = data.split(/\r\n|\n/);
		let title = '';
		let end = '';
		let error = '';
		// Reading line by line
		try {
			allLines.forEach((line) => {
				if (line) {
					if (line.match(/^#/gm)) {
						const hash: any = line.match(/# (.*)/);
						title = hash[1];
					} else if (line.match(/^_/gm)) {
						const underscore: any = line.match(/_(.*)_/);
						end = underscore[1];
					} else if (line.match(/^!/gm)) {
						id += 1;
						const imgUrl: any = line.match(/\((.*)\)/);
						story.push({
							id,
							url: imgUrl[1],
							text: '',
						});
					} else {
						story[id - 1].text = line;
					}
				}
			});
		} catch (e) {
			error = 'Error parsing OBS md file text';
			title = '';
			end = '';
			story = [];
		}

		return { title, story, end, error };
	};

	protected async fetchStoryContent(title: string): Promise<any> {
		try {
			const response = await fetch(
				`https://git.door43.org/Door43-Catalog/hi_obs/raw/branch/master/content/${title}.md`,
			);
			if (response.ok) {
				const content = await response.text();
				console.log('content', content);
				const json = this.MdToJson(content);
				console.log('json', json);
				json.story.unshift({ id: 0, title: json.title });
				json.story.push({
					id: json.story.length + 1,
					end: json.end,
				});
				return json.story;

				// return marked(content); // Return the parsed markdown content
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
			<div style={{ height: '100%', overflowY: 'auto' }}>
				{this.obsStory.map((story, index) => (
					<div key={story.id}>
						{Object.prototype.hasOwnProperty.call(
							story,
							'title',
						) && (
							<div
								className='flex m-4 p-1 rounded-md min-h-0'
								style={{ display: 'flex' }}
								key={story.id}>
								<textarea
									name={story.title}
									// onChange={(e) =>
									// 	updateSection(e.target.value, story.id)
									// }
									// onKeyDown={avoidEnter}
									// onClick={() => setSelectedStory(scrollLock === true ? 0 : story.id)}
									value={story.title}
									data-id={story.id}
									className='flex-grow text-justify ml-2 p-2 text-xl'
									style={{
										fontFamily: 'sans-serif',
										fontSize: `1rem`,
										resize: 'none',
										margin: '0 5px 0 5px',
									}}
									rows={4}
									cols={65}
								/>
								<button
									style={{ margin: 'auto 0 auto 0' }}
									onClick={() =>
										this.TTSinstance.fetchData(story.title)
									}>
									TTS
								</button>
							</div>
						)}
						{Object.prototype.hasOwnProperty.call(
							story,
							'text',
						) && (
							<div
								className='flex m-4 p-1 rounded-md'
								style={{ display: 'flex' }}
								key={story.id}>
								<span className='w-5 h-5 bg-gray-800 rounded-full flex justify-center text-sm text-white items-center p-3 '>
									{/* {index} */}
									{index
										.toString()
										.split('')
										.map((num) => num)}
								</span>
								<img
									src={story.url}
									alt='OBS Image'
									style={{ height: '100px' }}
								/>
								<textarea
									name={story.text}
									// onChange={(e) =>
									// 	updateSection(e.target.value, story.id)
									// }
									// onKeyDown={avoidEnter}
									// onClick={() => setSelectedStory(scrollLock === true ? 0 : story.id)}
									value={story.text}
									data-id={story.id}
									className='flex-grow text-justify ml-2 p-2 text-sm'
									style={{
										fontFamily: 'sans-serif',
										fontSize: `1rem`,
										lineHeight: 1.5,
										resize: 'none',
										margin: '0 5px 0 5px',
									}}
									rows={4}
									cols={65}
								/>
								<button
									style={{ margin: 'auto 0 auto 0' }}
									onClick={() =>
										this.TTSinstance.fetchData(story.text)
									}>
									TTS
								</button>
							</div>
						)}
						{Object.prototype.hasOwnProperty.call(story, 'end') && (
							<div
								className='flex m-4 p-1 rounded-md min-h-0'
								style={{ display: 'flex' }}
								key={story.id}>
								<textarea
									name={story.end}
									// onChange={(e) =>
									// 	updateSection(e.target.value, story.id)
									// }
									// onKeyDown={avoidEnter}
									// onClick={() => setSelectedStory(scrollLock === true ? 0 : story.id)}
									value={story.end}
									data-id={story.id}
									className='flex-grow text-justify ml-2 p-2 text-sm'
									style={{
										fontFamily: 'sans-serif',
										fontSize: `1rem`,
										lineHeight: 1.5,
										resize: 'none',
										margin: '0 5px 0 5px',
									}}
									rows={4}
									cols={65}
								/>
								<button
									style={{ margin: 'auto 0 auto 0' }}
									onClick={() =>
										this.TTSinstance.fetchData(story.end)
									}>
									TTS
								</button>
							</div>
						)}
					</div>
				))}
			</div>
		);
	}
}
