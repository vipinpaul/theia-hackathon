import {
  inject,
  injectable,
  postConstruct,
} from "@theia/core/shared/inversify";
import { ReactWidget } from "@theia/core/lib/browser/widgets/react-widget";
import React = require("react");
import { MessageService } from "@theia/core";
import { FFmpegServer } from "../common/audio-backend-service";

@injectable()
export class OBSWidget extends ReactWidget {
  static readonly ID = "obs-widget";
  static readonly LABEL = "OBS Widget";

  @inject(FFmpegServer)
  protected readonly server: FFmpegServer;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  protected storyTitle: string = "01";
  protected isLoading: boolean = true;
  protected isRecording: boolean = false;
  protected recordingStoryId: number | null = null;
  protected recordingPart: string | null = null;
  protected audioElements: { [key: string]: HTMLAudioElement } = {};
  protected playingAudio: { [key: string]: boolean } = {};
  public obsStory: any[] = [];

  // public TTSinstance = new Texttospeech(this.messageService);
  protected showDevicePopup: boolean = false;
  protected availableDevices: string[] = [];

  @postConstruct()
  protected init(): void {
    this.id = OBSWidget.ID;
    this.title.label = OBSWidget.LABEL;
    this.title.caption = OBSWidget.LABEL;
    this.title.closable = true;
    this.title.iconClass = "fa fa-file";
    this.update();
  }

  protected async onAfterAttach(): Promise<void> {
    this.isLoading = true;
    this.obsStory = await this.fetchStoryContent(this.storyTitle);
    await this.checkExistingRecordings();
    this.isLoading = false;
    this.update();
  }

  protected async checkExistingRecordings(): Promise<void> {
    for (const story of this.obsStory) {
      const types = ["title", "text", "end"];
      for (const type of types) {
        if (story[type]) {
          const recordingPath = `../../../audio-recordings/story-${this.storyTitle}-${story.id}.wav`;
          try {
            const response = await fetch(recordingPath);
            if (response.ok) {
              story[`${type}Recording`] = recordingPath;
            }
          } catch (error) {}
        }
      }
    }
  }

  protected handlePlayPause = (filename: string) => {
    const audioKey = `audio-${filename}`;

    if (!this.audioElements[audioKey]) {
      const audio = new Audio(filename);
      this.audioElements[audioKey] = audio;

      audio.addEventListener("ended", () => {
        this.playingAudio[audioKey] = false;
        this.update();
      });
    }

    const audio = this.audioElements[audioKey];

    if (this.playingAudio[audioKey]) {
      audio.pause();
      this.playingAudio[audioKey] = false;
    } else {
      Object.entries(this.audioElements).forEach(([key, otherAudio]) => {
        if (key !== audioKey) {
          otherAudio.pause();
          this.playingAudio[key] = false;
        }
      });

      audio.play().catch((error) => {
        console.error("Error playing audio:", error);
        this.messageService.error("Failed to play audio");
      });
      this.playingAudio[audioKey] = true;
    }
    this.update();
  };

  protected deleteRecording(recordingPath: string): void {
    const story = this.obsStory.find(
      (s) =>
        s.titleRecording === recordingPath ||
        s.textRecording === recordingPath ||
        s.endRecording === recordingPath
    );

    if (story) {
      if (story.titleRecording === recordingPath)
        story.titleRecording = undefined;
      if (story.textRecording === recordingPath)
        story.textRecording = undefined;
      if (story.endRecording === recordingPath) story.endRecording = undefined;
    }

    const audioKey = `audio-${recordingPath}`;
    if (this.audioElements[audioKey]) {
      this.audioElements[audioKey].pause();
      delete this.audioElements[audioKey];
      delete this.playingAudio[audioKey];
    }

    this.update();
  }

  async toggleRecording(
    storyId: number,
    partType: "title" | "text" | "end"
  ): Promise<void> {
    try {
      const filename = `${this.storyTitle}-${storyId}`;

      const isCurrentlyRecording =
        this.recordingStoryId === storyId && this.recordingPart === partType;

      if (isCurrentlyRecording) {
        await this.server.stopRecording();
        this.isRecording = false;
        this.recordingStoryId = null;
        this.recordingPart = null;
        await this.checkExistingRecordings();
      } else {
        if (this.isRecording) {
          await this.server.stopRecording();
        }
        await this.server.startRecording({ storyId, filename });
        this.isRecording = true;
        this.recordingStoryId = storyId;
        this.recordingPart = partType;
      }
      this.update();
    } catch (error) {
      console.error("Recording error:", error);
    }
  }

  setStoryTitle(title: string): void {
    this.storyTitle = title;
    this.fetchStoryContent(title).then((content) => {
      this.obsStory = content;
      this.update();
    });
  }

  MdToJson(data: string) {
    let story: any = [];
    let id = 0;
    const allLines = data.split(/\r\n|\n/);
    let title = "",
      end = "",
      error = "";

    try {
      allLines.forEach((line) => {
        if (line) {
          if (line.match(/^#/gm)) {
            const hash = line.match(/# (.*)/);
            title = hash ? hash[1] : "";
          } else if (line.match(/^_/gm)) {
            const underscore = line.match(/_(.*)_/);
            end = underscore ? underscore[1] : "";
          } else if (line.match(/^!/gm)) {
            id += 1;
            const imgUrl = line.match(/\((.*)\)/);
            story.push({ id, url: imgUrl ? imgUrl[1] : "", text: "" });
          } else {
            story[id - 1].text = line;
          }
        }
      });
    } catch (e) {
      error = "Error parsing OBS md file text";
      title = "";
      end = "";
      story = [];
    }
    return { title, story, end, error };
  }

  async fetchStoryContent(title: string): Promise<any[]> {
    try {
      const response = await fetch(
        `https://git.door43.org/Door43-Catalog/hi_obs/raw/branch/master/content/${title}.md`
      );
      if (response.ok) {
        const content = await response.text();
        const json = this.MdToJson(content);
        json.story.unshift({ id: 0, title: json.title });
        json.story.push({ id: json.story.length + 1, end: json.end });
        return json.story;
      } else {
        return [{ text: "Failed to load content." }];
      }
    } catch (error) {
      console.error("Error fetching story content:", error);
      return [{ text: "Error fetching content." }];
    }
  }

  render(): React.ReactElement {
    return (
      <div style={{ height: "100%", overflowY: "auto" }}>
        {this.obsStory.map((story, index) => (
          <div key={story.id}>
            {story.title && (
              <div
                className="flex m-4 p-1 rounded-md min-h-0"
                style={{ display: "flex", margin: "10px 0 10px 0" }}
                key={story.id}
              >
                <textarea
                  name={story.title}
                  value={story.title}
                  data-id={story.id}
                  style={{
                    fontFamily: "sans-serif",
                    fontSize: `1rem`,
                    flexGrow: 1,
                    resize: "none",
                    margin: "0 5px",
                    padding: "10px",
                    border: "none",
                    boxShadow:
                      "0 2px 6px 0 rgba(0, 0, 0, 0.2), 0 2px 10px 0 rgba(0, 0, 0, 0.19)",
                    maxWidth: "995px",
                  }}
                />
                <button
                  style={{
                    margin: "auto 0 auto 5px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#fff",
                    backgroundColor: "#2e86de",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "background-color 0.3s ease",
                    textTransform: "capitalize",
                  }}
                  // onClick={() =>
                  //   this.TTSinstance.fetchData(
                  //     story.title,
                  //     story.id,
                  //     this.storyTitle
                  //   )
                  // }
                >
                  <img
                    width="15px"
                    height="15px"
                    src="../../../icons/volume-high-solid.svg"
                  ></img>
                </button>
                <button
                  style={{
                    margin: "auto 0 auto 5px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#fff",
                    backgroundColor: "#2e86de",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "background-color 0.3s ease",
                    textTransform: "capitalize",
                  }}
                  onClick={() => this.toggleRecording(story.id, "title")}
                >
                  {this.isRecording &&
                  this.recordingPart === "title" &&
                  this.recordingStoryId === story.id ? (
                    <img
                      width="15px"
                      height="15px"
                      src="../../../icons/stop-solid.svg"
                    ></img>
                  ) : (
                    <img
                      width="15px"
                      height="15px"
                      src="../../../icons/microphone-solid.svg"
                    ></img>
                  )}
                </button>
                {story.titleRecording && (
                  <>
                    <button
                      style={{
                        margin: "auto 0 auto 5px",
                        padding: "10px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#fff",
                        backgroundColor: "#2e86de",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                      onClick={() => this.handlePlayPause(story.titleRecording)}
                    >
                      {this.playingAudio[`audio-${story.titleRecording}`] ? (
                        <img
                          width="15px"
                          height="15px"
                          src="../../../icons/pause-solid.svg"
                        ></img>
                      ) : (
                        <img
                          width="15px"
                          height="15px"
                          src="../../../icons/play-solid.svg"
                        ></img>
                      )}
                    </button>
                    <button
                      style={{
                        margin: "auto 0 auto 5px",
                        padding: "10px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#fff",
                        backgroundColor: "#ff4757",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                      onClick={() => this.deleteRecording(story.titleRecording)}
                    >
                      <img
                        width="15px"
                        height="15px"
                        src="../../../icons/trash-solid.svg"
                      ></img>
                    </button>

                      {/* <button onClick={()=>this.server.mergeAudio("01")}>Merge</button> */}
                  </>
                )}
              </div>
            )}
            {story.text && (
              <div
                style={{ display: "flex", margin: "10px 0 10px 0" }}
                key={story.id}
              >
                <span
                  style={{
                    margin: "auto 0 auto 0",
                    padding: "10px",
                    width:"10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#2e86de",
                  }}
                >
                  {index}
                </span>
                <img
                  src={story.url}
                  alt="OBS Image"
                  style={{ height: "150px" }}
                />
                <textarea
                  name={story.text}
                  value={story.text}
                  data-id={story.id}
                  style={{
                    fontFamily: "sans-serif",
                    fontSize: `1rem`,
                    flexGrow: 1,
                    resize: "none",
                    margin: "0 5px",
                    border: "none",
                    boxShadow:
                      " 0 2px 6px 0 rgba(0, 0, 0, 0.2), 0 2px 10px 0 rgba(0, 0, 0, 0.19)",
                    maxWidth: "678px",
                    padding: "20px",
                  }}
                  rows={4}
                />
                <button
                  style={{
                    margin: "auto 0 auto 5px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#fff",
                    backgroundColor: "#2e86de",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "background-color 0.3s ease",
                    textTransform: "capitalize",
                  }}
                  // onClick={() =>
                  //   this.TTSinstance.fetchData(
                  //     story.title,
                  //     story.id,
                  //     this.storyTitle
                  //   )
                  // }
                >
                  <img
                    width="15px"
                    height="15px"
                    src="../../../icons/volume-high-solid.svg"
                  ></img>
                </button>
                <button
                  style={{
                    margin: "auto 0 auto 5px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#fff",
                    backgroundColor: "#2e86de",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "background-color 0.3s ease",
                    textTransform: "capitalize",
                  }}
                  onClick={() => this.toggleRecording(story.id, "text")}
                >
                  {this.isRecording &&
                  this.recordingPart === "text" &&
                  this.recordingStoryId === story.id ? (
                    <img
                      width="15px"
                      height="15px"
                      src="../../../icons/stop-solid.svg"
                    ></img>
                  ) : (
                    <img
                      width="15px"
                      height="15px"
                      src="../../../icons/microphone-solid.svg"
                    ></img>
                  )}
                </button>
                {story.textRecording && (
                  <>
                    <button
                      style={{
                        margin: "auto 0 auto 5px",
                        padding: "10px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#fff",
                        backgroundColor: "#2e86de",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                      onClick={() => this.handlePlayPause(story.textRecording)}
                    >
                      {this.playingAudio[`audio-${story.textRecording}`] ? (
                        <img
                          width="15px"
                          height="15px"
                          src="../../../icons/pause-solid.svg"
                        ></img>
                      ) : (
                        <img
                          width="15px"
                          height="15px"
                          src="../../../icons/play-solid.svg"
                        ></img>
                      )}
                    </button>
                    <button
                      style={{
                        margin: "auto 0 auto 5px",
                        padding: "10px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#fff",
                        backgroundColor: "#ff4757",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                      onClick={() => this.deleteRecording(story.textRecording)}
                    >
                      <img
                        width="15px"
                        height="15px"
                        src="../../../icons/trash-solid.svg"
                      ></img>
                    </button>
                  </>
                )}
              </div>
            )}
            {story.end && (
              <div
                style={{ display: "flex", margin: "10px 0 10px 0" }}
                key={story.id}
              >
                <textarea
                  name={story.end}
                  style={{
                    fontFamily: "sans-serif",
                    fontSize: `1rem`,
                    flexGrow: 1,
                    resize: "none",
                    margin: "0 5px",
                    padding:"10px",
                    border: "none",
                    boxShadow:
                      "0 2px 6px 0 rgba(0, 0, 0, 0.2), 0 2px 10px 0 rgba(0, 0, 0, 0.19)",
                    maxWidth: "1010px",
                  }}
                  value={story.end}
                  data-id={story.id}
                />
                <button
                  style={{
                    margin: "auto 0 auto 5px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#fff",
                    backgroundColor: "#2e86de",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "background-color 0.3s ease",
                    textTransform: "capitalize",
                  }}
                  // onClick={() =>
                  //   this.TTSinstance.fetchData(
                  //     story.title,
                  //     story.id,
                  //     this.storyTitle
                  //   )
                  // }
                >
                  <img
                    width="15px"
                    height="15px"
                    src="../../../icons/volume-high-solid.svg"
                  ></img>
                </button>
                <button
                  style={{
                    margin: "auto 0 auto 5px",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#fff",
                    backgroundColor: "#2e86de",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "background-color 0.3s ease",
                    textTransform: "capitalize",
                  }}
                  onClick={() => this.toggleRecording(story.id, "end")}
                >
                  {this.isRecording &&
                  this.recordingPart === "end" &&
                  this.recordingStoryId === story.id ? (
                    <img
                      width="15px"
                      height="15px"
                      src="../../../icons/stop-solid.svg"
                    ></img>
                  ) : (
                    <img
                      width="15px"
                      height="15px"
                      src="../../../icons/microphone-solid.svg"
                    ></img>
                  )}
                </button>
                {story.endRecording && (
                  <>
                    <button
                      style={{
                        margin: "auto 0 auto 5px",
                        padding: "10px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#fff",
                        backgroundColor: "#2e86de",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                      onClick={() => this.handlePlayPause(story.endRecording)}
                    >
                      {this.playingAudio[`audio-${story.endRecording}`] ? (
                        <img
                          width="15px"
                          height="15px"
                          src="../../../icons/pause-solid.svg"
                        ></img>
                      ) : (
                        <img
                          width="15px"
                          height="15px"
                          src="../../../icons/play-solid.svg"
                        ></img>
                      )}
                    </button>
                    <button
                      style={{
                        margin: "auto 0 auto 5px",
                        padding: "10px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#fff",
                        backgroundColor: "#ff4757",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                      onClick={() => this.deleteRecording(story.endRecording)}
                    >
                      <img
                        width="15px"
                        height="15px"
                        src="../../../icons/trash-solid.svg"
                      ></img>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
}
