import { MessageService } from "@theia/core";
import { inject } from "@theia/core/shared/inversify";
export class Texttospeech {
  public headersList: any = {
    Authorization: "Bearer ory_st_2ZhoMsqBsVKzniqjhmE2jK8M23m9mpq7",
    "Content-Type": "application/json",
  };
  constructor(
    @inject(MessageService) private readonly messageService: MessageService
  ) {}

  downloadAudioFile = async (
    jobId: any,
    storyId: number,
    storyTitle: string
  ) => {
    try {
      const downloadUrl = `https://api.vachanengine.org/v2/ai/assets?job_id=${jobId}`;
      let response = await fetch(downloadUrl, {
        method: "GET",
        headers: this.headersList,
      });

      if (!response.ok) {
        throw new Error("Failed to download the audio file");
      }

      let audioBlob = await response.blob();

      const url = window.URL.createObjectURL(audioBlob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `story-${storyTitle}-${storyId}.wav`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      console.log("Audio file downloaded successfully!");
      this.messageService.info("Audio file downloaded successfully!");
    } catch (error) {
      console.error("Error downloading audio file:", error);
    }
  };

  checkJobStatus = async (jobId: any, storyId: number, storyTitle: string) => {
    console.log(jobId, "Job ID for status check");
    try {
      const statusUrl = `https://api.vachanengine.org/v2/ai/model/job?job_id=${jobId}`;

      while (true) {
        let response = await fetch(statusUrl, {
          method: "GET",
          headers: this.headersList,
        });
        let result = await response.json();
        if (result.data.status === "job finished") {
          this.downloadAudioFile(jobId, storyId, storyTitle);
          break;
        } else if (result.data.status === "failed") {
          break;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error("Error checking job status:", error);
    }
  };

  fetchData = async (
    bodyContent: string,
    storyId: number,
    storyTitle: string
  ) => {
    try {
      let response = await fetch(
        "https://api.vachanengine.org/v2/ai/model/audio/generate?model_name=mms-tts-hin&language=hin",
        {
          method: "POST",
          body: JSON.stringify([bodyContent]),
          headers: this.headersList,
        }
      );

      let jobid = await response.json();
      this.checkJobStatus(jobid.data.jobId, storyId, storyTitle);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
}
