import { MessageService } from '@theia/core';
import { inject } from '@theia/core/shared/inversify';

export class Texttospeech {
	public headersList: any = {
		Authorization: 'Bearer ory_st_2ZhoMsqBsVKzniqjhmE2jK8M23m9mpq7',
		'Content-Type': 'application/json',
	};

	constructor(
		@inject(MessageService) private readonly messageService: MessageService,
	) {}

	downloadAudioFile = async (jobId: any) => {
		try {
			const downloadUrl = `https://api.vachanengine.org/v2/ai/assets?job_id=${jobId}`;
			let response = await fetch(downloadUrl, {
				method: 'GET',
				headers: this.headersList,
			});

			if (!response.ok) {
				throw new Error('Failed to download the audio file');
			}

			let audioBlob = await response.blob();

			const url = window.URL.createObjectURL(audioBlob);
			const a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.download = `audio_${jobId}.mp3`;

			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			console.log('Audio file downloaded successfully!');
			this.messageService.info('Audio file downloaded successfully!');
		} catch (error) {
			console.error('Error downloading audio file:', error);
		}
	};

	checkJobStatus = async (jobId: any) => {
		console.log(jobId, 'Job ID for status check');
		try {
			const statusUrl = `https://api.vachanengine.org/v2/ai/model/job?job_id=${jobId}`;

			while (true) {
				let response = await fetch(statusUrl, {
					method: 'GET',
					headers: this.headersList,
				});
				console.log('Response', await response);

				let result = await response.json();
				console.log(
					JSON.stringify(result),
					result.data.status,
					'Job Status',
				);

				if (result.data.status === 'job finished') {
					// this.messageService.info(
					// 	'Job is finished! Preparing to download the audio...',
					// );
					console.log(
						'Job is finished! Preparing to download the audio...',
					);

					this.downloadAudioFile(jobId);
					// this.downloadAudioFile(377);

					break;
				} else if (result.data.status === 'failed') {
					console.error('Job failed.');
					break;
				} else {
					console.log(
						'Job is still processing, checking again in 5 seconds...',
					);
					await new Promise((resolve) => setTimeout(resolve, 5000));
				}
			}
		} catch (error) {
			console.error('Error checking job status:', error);
		}
	};

	fetchData = async (bodyContent: string) => {
		console.log('bodycontent', bodyContent);

		try {
			let response = await fetch(
				'https://api.vachanengine.org/v2/ai/model/audio/generate?model_name=mms-tts-hin&language=hin',
				{
					method: 'POST',
					body: JSON.stringify([bodyContent]),
					headers: this.headersList,
				},
			);

			let jobid = await response.json();
			console.log('Job ID:', jobid.data.jobId);

			this.checkJobStatus(jobid.data.jobId);
		} catch (error) {
			console.error('Error fetching data:', error);
		}
	};
}
