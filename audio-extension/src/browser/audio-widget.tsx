import { inject, injectable } from "@theia/core/shared/inversify";
import { ReactWidget } from "@theia/core/lib/browser/widgets/react-widget";
import {
  FFmpegServer,
  RecordingOptions,
  FileNode,
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
  private waveformFile: string | undefined = undefined;
  private updateTimer?: number;
  private filepath: string | undefined;
  private fileTree: FileNode | null = null;
  private expandedFolders: Set<string> = new Set();

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
      this.filepath = roots[0].resource.toString();
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

      const rootPath = roots[0].resource.path.fsPath();
      console.log(rootPath, "rootsss");
      this.fileTree = await this.server.getFileTree(rootPath);
      const audioFolder = roots.find(
        (root) =>
          root.name === "audio-recordings" ||
          root.resource.path.toString().includes("audio-recordings")
      );
      console.log(audioFolder, "audioo");
      if (audioFolder) {
        this.fileTree = await this.server.getFileTree(
          audioFolder.resource.path.toString()
        );
        this.update();
      }
    } catch (error) {
      console.error("Failed to initialize file tree:", error, "anu");
    }
  }

  private async deleteNode(node: FileNode): Promise<void> {
    try {
      await this.server.deleteFile(node.path);
      if (node.type === "file" && this.audioFile === node.path) {
        this.audioFile = undefined;
        this.waveformFile = undefined;
      }
      await this.initializeFileTree();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  }

  private async toggleRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        console.log("stopping recording");
        const audioFilePath = await this.server.stopRecording();
        console.log(audioFilePath, "filee");
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

  private async addWorkspaceFolder(): Promise<void> {
    try {
      const props: OpenFileDialogProps = {
        title: "Select a Folder to Add",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
      };
      const uri = await this.fileDialogService.showOpenDialog(props);
      this.update();
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

  private renderFileTree(node: FileNode, level: number = 0): JSX.Element {
    const indent = level * 20;
    const isExpanded = this.expandedFolders.has(node.path);
    return (
      <div key={node.path}>
        <div
          style={{
            paddingLeft: `${indent}px`,
            display: "flex",
            alignItems: "center",
            padding: "5px",
            backgroundColor:
              this.audioFile === node.path ? "#e6e6e6" : "transparent",
          }}
        >
          {node.type === "folder" &&
            node.children &&
            node.children.length > 0 && (
              <button
                onClick={() => {
                  if (isExpanded) {
                    this.expandedFolders.delete(node.path);
                  } else {
                    this.expandedFolders.add(node.path);
                  }
                  this.update();
                }}
                style={{
                  marginRight: "5px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                {isExpanded ? "▼" : "▶"}
              </button>
            )}

          <span>{node.name}</span>

          <button
            onClick={() => this.deleteNode(node)}
            style={{
              marginLeft: "10px",
              padding: "2px 5px",
              backgroundColor: "#ff4444",
              color: "white",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>

        {/* Render children if folder is expanded */}
        {node.type === "folder" && isExpanded && node.children && (
          <div>
            {node.children.map((child) =>
              this.renderFileTree(child, level + 1)
            )}
          </div>
        )}
      </div>
    );
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
            <p>{this.filepath}</p>
          </div>
        </div>
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: "4px",
            marginTop: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#f5f5f5",
              padding: "10px",
              borderBottom: "1px solid #ccc",
            }}
          >
            <h3 style={{ margin: 0 }}>Audio Files</h3>
          </div>
          <div style={{ padding: "10px" }}>
            {this.fileTree ? (
              this.renderFileTree(this.fileTree)
            ) : (
              <p style={{ color: "#666", textAlign: "center" }}>
                No audio files found
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
}
