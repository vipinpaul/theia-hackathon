import { inject, injectable } from "@theia/core/shared/inversify";
import { ReactWidget } from "@theia/core/lib/browser/widgets/react-widget";
import {
  FFmpegServer,
  RecordingOptions,
} from "OBSExplorer/lib/common/audio-backend-service";
import React = require("react");
import { WorkspaceService } from "@theia/workspace/lib/browser/workspace-service";
import {
  FileDialogService,
  OpenFileDialogProps,
} from "@theia/filesystem/lib/browser";
import { URI } from "@theia/core";

@injectable()
export class AudioWidget extends ReactWidget {
  static readonly ID = "audio-recorder-widget";
  static readonly LABEL = "Audio Recorder";

  @inject(FFmpegServer)
  protected readonly server: FFmpegServer;
  @inject(WorkspaceService)
  private workspaceService: WorkspaceService;
  @inject(FileDialogService)
  protected readonly fileDialogService: FileDialogService;

  private isRecording: boolean = false;
  private isPlaying: boolean = false;

  private audioFile: string | undefined = undefined;
  private waveformFile: string | undefined = undefined;
  private updateTimer?: number;

  constructor() {
    super();
    this.id = AudioWidget.ID;
    this.title.label = AudioWidget.LABEL;
    this.title.caption = AudioWidget.LABEL;
    this.title.closable = true;
    this.title.iconClass = "fa fa-microphone";
    this.node.tabIndex = 0;

    this.updateTimer = window.setTimeout(() => {
      this.update();
    }, 1000);
  }

  dispose(): void {
    if (this.updateTimer) {
      window.clearTimeout(this.updateTimer);
    }
    super.dispose();
  }

  private async toggleRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        const audioFilePath = await this.server.stopRecording();
        this.audioFile = audioFilePath;
        this.isRecording = false;
        this.waveformFile = audioFilePath.replace(".wav", "-waveform.png");
      } else {
        const options: RecordingOptions = {
          sampleRate: 48000,
          channels: 1,
          format: "wav",
          storyId: Date.now(),
        };
        await this.server.startRecording(options);
        this.isRecording = true;
        this.audioFile = undefined;
        this.waveformFile = undefined;
      }
      this.update();
    } catch (error) {
      console.error("Error toggling recording:", error);
    }
  }

  private async playAudio(): Promise<void> {
    if (!this.audioFile) return;

    try {
      this.isPlaying = true;
      this.update();
      await this.server.playAudio(this.audioFile);
      this.isPlaying = false;
      this.update();
    } catch (error) {
      console.error("Error playing audio:", error);
      this.isPlaying = false;
      this.update();
    }
  }

  private async stopPlayback(): Promise<void> {
    try {
      await this.server.stopAudio();
      this.isPlaying = false;
      this.update();
    } catch (error) {
      console.error("Error stopping playback:", error);
    }
  }

  private async changeWorkspace(): Promise<void> {
    try {
      const props: OpenFileDialogProps = {
        title: "Select a Workspace",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
      };
      const uri = await this.fileDialogService.showOpenDialog(props);

      if (uri) {
        await this.workspaceService.open(new URI(uri.toString()));
        console.log(`Workspace changed to: ${uri.toString()}`);
        this.update();
      }
    } catch (error) {
      console.error("Workspace change failed:", error);
    }
  }

  private async addWorkspaceFolder(): Promise<void> {
    try {
      const props: OpenFileDialogProps = {
        title: "Select a Folder to Add",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
      };
      const uri = await this.fileDialogService.showOpenDialog(props);

      if (uri) {
        const folderUri = new URI(uri.toString());
        const existingRoots = await this.workspaceService.roots;
        const alreadyExists = existingRoots.some(
          (root) => root.resource.toString() === folderUri.toString()
        );

        if (!alreadyExists) {
          await this.workspaceService.addRoot(folderUri);
          console.log(`Folder added: ${folderUri.toString()}`);
          this.update();
        } else {
          console.warn("Folder already exists in workspace");
        }
      }
    } catch (error) {
      console.error("Failed to add workspace folder:", error);
    }
  }

  private async removeWorkspaceFolder(): Promise<void> {
    try {
      const props: OpenFileDialogProps = {
        title: "Select a Folder to Remove",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
      };
      const uri = await this.fileDialogService.showOpenDialog(props);

      if (uri) {
        const folderUri = new URI(uri.toString());
        await this.workspaceService.removeRoots([folderUri]);
        console.log(`Folder removed: ${folderUri.toString()}`);
        this.update();
      }
    } catch (error) {
      console.error("Failed to remove workspace folder:", error);
    }
  }

  render(): JSX.Element {
    if (!this.server) {
      return (
        <div style={{ color: "red", padding: "15px" }}>
          <h3>Error: FFmpegServer Unavailable</h3>
          <p>
            Please ensure the backend is running and the service is properly
            configured.
          </p>
        </div>
      );
    }

    return (
      <div style={{ padding: "15px", textAlign: "center" }}>
        <h2>Audio Recorder</h2>
        <div style={{ marginBottom: "20px" }}>
          <p className="status-text">
            {this.isRecording
              ? "Recording in progress..."
              : this.isPlaying
              ? "Playing audio..."
              : "Ready to record"}
          </p>
        </div>

        <div className="control-buttons" style={{ marginBottom: "20px" }}>
          <button
            onClick={() => this.toggleRecording()}
            disabled={this.isPlaying}
            style={{
              padding: "10px 20px",
              marginRight: "10px",
              backgroundColor: this.isRecording ? "#ff4444" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: this.isPlaying ? "not-allowed" : "pointer",
            }}
          >
            {this.isRecording ? "Stop Recording" : "Start Recording"}
          </button>

          <button
            onClick={() => this.playAudio()}
            disabled={!this.audioFile || this.isRecording || this.isPlaying}
            style={{
              padding: "10px 20px",
              marginRight: "10px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                !this.audioFile || this.isRecording || this.isPlaying
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Play Audio
          </button>

          <button
            onClick={() => this.stopPlayback()}
            disabled={!this.isPlaying}
            style={{
              padding: "10px 20px",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: !this.isPlaying ? "not-allowed" : "pointer",
            }}
          >
            Stop Playback
          </button>
        </div>
        <div className="waveform-container" style={{ marginBottom: "20px" }}>
          {this.waveformFile ? (
            <div>
              <h3>Audio Waveform</h3>
              <img
                src={this.waveformFile}
                alt="Audio Waveform"
                style={{
                  width: "100%",
                  maxWidth: "800px",
                  height: "auto",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>
          ) : (
            <p>No waveform available</p>
          )}
        </div>
        {this.audioFile && (
          <div className="audio-info" style={{ marginBottom: "20px" }}>
            <h3>Current Audio File</h3>
            <p style={{ wordBreak: "break-all" }}>{this.audioFile}</p>
          </div>
        )}
        <div
          className="workspace-controls"
          style={{
            marginTop: "20px",
            borderTop: "1px solid #ccc",
            paddingTop: "20px",
          }}
        >
          <h3>Workspace Management</h3>
          <div style={{ marginTop: "10px" }}>
            <button
              onClick={() => this.changeWorkspace()}
              style={{
                padding: "8px 16px",
                marginRight: "10px",
                backgroundColor: "#607D8B",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Change Workspace
            </button>
            <button
              onClick={() => this.addWorkspaceFolder()}
              style={{
                padding: "8px 16px",
                marginRight: "10px",
                backgroundColor: "#009688",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Add Folder
            </button>
            <button
              onClick={() => this.removeWorkspaceFolder()}
              style={{
                padding: "8px 16px",
                backgroundColor: "#FF5722",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Remove Folder
            </button>
          </div>
        </div>
      </div>
    );
  }
}
