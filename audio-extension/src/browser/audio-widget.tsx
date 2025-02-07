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
  constructor(
    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService,
    @inject(FileDialogService)
    protected readonly fileDialogService: FileDialogService,
    @inject(FFmpegServer) protected readonly server: FFmpegServer
  ) {
    super();
    this.id = AudioWidget.ID;
    this.title.label = AudioWidget.LABEL;
    this.title.caption = AudioWidget.LABEL;
    this.title.closable = true;
    this.title.iconClass = "fa fa-microphone";
    this.node.tabIndex = 0;
    this.init();
  }
  private async init(): Promise<void> {
    this.updateTimer = window.setTimeout(() => {
      this.update();
    }, 1000);
    await this.initialize();
    await this.initializeFileTree();
  }
  private isRecording: boolean = false;
  private isPlaying: boolean = false;
  private audioFile: string | undefined = undefined;
  private updateTimer?: number;
  private isPaused: boolean = false;
  dispose(): void {
    if (this.updateTimer) {
      window.clearTimeout(this.updateTimer);
    }
    super.dispose();
  }
  private async getWorkspaceDetails(): Promise<{
    roots: string[];
    rootCount: number;
    isWorkspaceOpen: boolean;
    primaryRootUri?: string;
  }> {
    try {
      await this.workspaceService.ready;
      const roots = await this.workspaceService.roots;
      if (!roots || roots.length === 0) {
        return {
          roots: [],
          rootCount: 0,
          isWorkspaceOpen: false,
        };
      }
      console.log("Workspace details:", roots);
      return {
        roots: roots.map((root) => root.resource.toString()),
        rootCount: roots.length,
        isWorkspaceOpen: roots.length > 0,
        primaryRootUri: roots[0].resource.toString(),
      };
    } catch (error) {
      console.error("Error retrieving workspace details:", error);
      return {
        roots: [],
        rootCount: 0,
        isWorkspaceOpen: false,
      };
    }
  }
  protected async initialize(): Promise<void> {
    try {
      await this.workspaceService.ready;
      const details = await this.getWorkspaceDetails();
      console.log("Workspace initialized:", details);
      if (details.primaryRootUri) {
        const fsPath = new URI(details.primaryRootUri).path.fsPath();
        await this.server.setWorkspacePath(fsPath);
        console.log("Workspace path set in backend:", fsPath);
      }
      await this.initializeFileTree();
      this.updateTimer = window.setTimeout(() => {
        this.update();
      }, 1000);
    } catch (error) {
      console.error("Failed to initialize AudioWidget:", error);
    }
  }
  private async initializeFileTree(): Promise<void> {
    try {
      await this.workspaceService.ready;
      const roots = await this.workspaceService.roots;
      if (!roots || roots.length === 0) {
        console.log("No workspace roots available");
        return;
      }
      const audioFolder = roots.find(
        (root) =>
          root.name === "audio-recordings" ||
          root.resource.path.toString().includes("audio-recordings")
      );
      console.log(audioFolder, "audioo");
      if (audioFolder) {
        this.update();
      }
    } catch (error) {
      console.error("Failed to initialize file tree:", error, "anu");
    }
  }
  private async togglePause(): Promise<void> {
    try {
      if (this.isRecording) {
        if (this.isPaused) {
          await this.server.resumeRecording();
          this.isPaused = false;
        } else {
          await this.server.pauseRecording();
          this.isPaused = true;
        }
        this.update();
      }
    } catch (error) {
      console.error("Error toggling pause:", error);
    }
  }
  private async toggleRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        console.log("Stopping recording...");
        const audioFilePath = await this.server.stopRecording();
        console.log("Received file path:", audioFilePath);
        if (!audioFilePath) {
          console.error(
            "Error: stopRecording returned an empty or undefined file path."
          );
          return;
        }
        this.audioFile = audioFilePath;
        this.isRecording = false;
        this.isPaused = false;
      } else {
        const options: RecordingOptions = {
          sampleRate: 48000,
          channels: 1,
          format: "wav",
          storyId: Date.now(),
        };
        console.log("Starting recording...");
        await this.server.startRecording(options);
        this.isRecording = true;
        this.isPaused = false;
        this.audioFile = undefined;
      }
      this.update();
    } catch (error) {
      console.error("Error toggling recording:", error);
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
        await this.server.setWorkspacePath(
          new URI(uri.toString()).path.toString()
        );
        await this.initializeFileTree();
        console.log(`Workspace changed to: ${uri.toString()}`);
        this.update();
      }
    } catch (error) {
      console.error("Workspace change failed:", error);
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
              ? this.isPaused
                ? "Recording paused..."
                : "Recording in progress..."
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
            onClick={() => this.togglePause()}
            disabled={!this.isRecording}
            style={{
              padding: "10px 20px",
              marginRight: "10px",
              backgroundColor: "#FFA500",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: !this.isRecording ? "not-allowed" : "pointer",
              opacity: !this.isRecording ? 0.6 : 1,
            }}
          >
            {this.isPaused ? "Resume Recording" : "Pause Recording"}
          </button>
          <button
            onClick={() => this.server.getAudioDevices()}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Devices
          </button>
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
          </div>
        </div>
      </div>
    );
  }
}
