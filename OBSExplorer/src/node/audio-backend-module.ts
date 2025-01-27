import { injectable } from "@theia/core/shared/inversify";
import {
  FFmpegServer,
  RecordingOptions,
} from "../common/audio-backend-service";
import { spawn, execSync, ChildProcess } from "child_process";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";

@injectable()
export class FFmpegServerImpl implements FFmpegServer {
  private recordingProcess: ChildProcess | null = null;
  private playbackProcess: ChildProcess | null = null;
  private playlist: string[] = [];
  private currentPlaybackIndex: number = 0;
  private currentOutputFile: string | null = null;
  private readonly outputDir = path.join(
    __dirname,
    "../../../audio-recordings"
  );
  private readonly ffmpegPath = this.getPlatformSpecificFFmpegPath();

  private currentPlaybackFile: string | null = null;

  constructor() {
    this.setupOutputDirectory();
    this.checkFFmpegInstallation();
  }

  async getAudioFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.outputDir);
      return files
        .filter((file) => file.endsWith(".wav"))
        .map((file) => path.join(this.outputDir, file));
    } catch (error) {
      console.error("Error reading audio files:", error);
      return [];
    }
  }

  async mergeAudio(storyId: string): Promise<string> {
    const files = await this.getAudioFiles();
    const storyFiles = files.filter((f) => f.includes(storyId));
    if (storyFiles.length === 0) {
      throw new Error("No audio files found for story");
    }

    const outputFile = path.join(this.outputDir, `merged-${storyId}.wav`);
    const fileList = path.join(this.outputDir, "filelist.txt");

    await fs.writeFile(
      fileList,
      storyFiles.map((f) => `file '${f}'`).join("\n")
    );

    return new Promise((resolve, reject) => {
      const process = spawn(this.ffmpegPath, [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        fileList,
        "-c",
        "copy",
        outputFile,
      ]);

      process.on("close", (code) => {
        fs.unlink(fileList).catch(console.error);
        if (code === 0) {
          resolve(outputFile);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });
  }

  getFFmpegPath(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  setClient(client: void | undefined): void {
    throw new Error("Method not implemented.");
  }
  getClient?(): void | undefined {
    throw new Error("Method not implemented.");
  }

  private getPlatformSpecificFFmpegPath(): string {
    const ffmpegDir = path.resolve(__dirname, "../../../ffmpeg");
    switch (os.platform()) {
      case "win32":
        return path.join(ffmpegDir, "win", "ffmpeg.exe");
      case "darwin":
        return path.join(ffmpegDir, "mac", "ffmpeg");
      case "linux":
        return path.join(ffmpegDir, "linux", "ffmpeg");
      default:
        throw new Error("Unsupported OS platform for FFmpeg");
    }
  }

  private async setupOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create output directory:", err);
      throw new Error("Failed to create output directory");
    }
  }

  private async checkFFmpegInstallation(): Promise<void> {
    try {
      await fs.access(this.ffmpegPath, fs.constants.X_OK);
      execSync(`${this.ffmpegPath} -version`);
    } catch (err) {
      console.error("FFmpeg installation check failed:", err);
      throw new Error("FFmpeg is not installed or not functioning correctly");
    }
  }

  private getAudioInputFormat(): { format: string; device: string } {
    switch (os.platform()) {
      case "win32":
        return {
          format: "dshow",
          device:
            "audio=@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\\wave_{0891B2D9-6D3E-4A0B-8030-6E5118AA574B}",
        };
      case "linux":
        return { format: "alsa", device: "default" };
      case "darwin":
        return { format: "avfoundation", device: "0" };
      default:
        throw new Error("Unsupported OS platform for FFmpeg");
    }
  }

  async generateWaveform(audioFile: string): Promise<string> {
    const waveformOutput = audioFile.replace(".wav", "-waveform.png");

    return new Promise((resolve, reject) => {
      try {
        const command = [
          "-i",
          audioFile,
          "-filter_complex",
          "aformat=channel_layouts=mono,showwavespic=s=2560x480:colors=#4CAF50",
          "-frames:v",
          "1",
          "-y",
          waveformOutput,
        ];

        const process = spawn(this.ffmpegPath, command);

        process.stderr?.on("data", (data) => {
          console.error("FFmpeg waveform stderr:", data.toString());
        });

        process.on("error", (err) => {
          console.error("Waveform generation error:", err);
          reject(new Error(`Waveform generation failed: ${err.message}`));
        });

        process.on("exit", (code) => {
          if (code === 0) {
            resolve(waveformOutput);
          } else {
            reject(new Error("Failed to generate waveform image"));
          }
        });
      } catch (error) {
        console.error("Failed to generate waveform:", error);
        reject(error);
      }
    });
  }

  async playAudio(filePath: string): Promise<void> {
    console.log("Starting playAudio function");
    console.log("File path:", filePath);
    console.log("Platform:", os.platform());

    try {
      await fs.access(filePath);
      console.log("File exists and is accessible");
    } catch (error) {
      console.error("File access error:", error);
      throw new Error(`Audio file not accessible: ${filePath}`);
    }

    if (this.playbackProcess) {
      console.log("Stopping existing playback");
      await this.stopAudio();
    }

    return new Promise((resolve, reject) => {
      try {
        let command: string;
        let args: string[];

        switch (os.platform()) {
          case "win32":
            command = "powershell";
            args = [
              "-c",
              `(New-Object System.Media.SoundPlayer '${filePath}').PlaySync()`,
            ];
            console.log("Windows command:", command);
            console.log("Windows args:", args);
            break;
          case "darwin":
            command = "afplay";
            args = [filePath];
            break;
          case "linux":
            command = "aplay";
            args = [filePath];
            break;
          default:
            throw new Error("Unsupported platform for audio playback");
        }

        console.log("Spawning process with command:", command);
        console.log("Arguments:", args);

        this.currentPlaybackFile = filePath;
        this.playbackProcess = spawn(command, args);

        this.playbackProcess.stdout?.on("data", (data) => {
          console.log("Playback stdout:", data.toString());
        });

        this.playbackProcess.stderr?.on("data", (data) => {
          console.error("Playback stderr:", data.toString());
        });

        this.playbackProcess.on("error", (err) => {
          console.error("Playback spawn error:", err);
          console.error("Error code:", (err as NodeJS.ErrnoException).code);
          console.error("Error path:", (err as NodeJS.ErrnoException).path);
          console.error(
            "Error syscall:",
            (err as NodeJS.ErrnoException).syscall
          );
          this.playbackProcess = null;
          reject(err);
        });

        this.playbackProcess.on("close", (code, signal) => {
          console.log("Playback process closed");
          console.log("Exit code:", code);
          console.log("Signal:", signal);
          this.playbackProcess = null;
          if (code === 0 || code === null) {
            resolve();
          } else {
            reject(new Error(`Playback process exited with code ${code}`));
          }
        });
      } catch (error) {
        console.error("Unexpected error in playAudio:", error);
        this.playbackProcess = null;
        reject(error);
      }
    });
  }
  async startRecording(options: RecordingOptions = {}): Promise<string> {
    if (this.recordingProcess) {
      throw new Error("Recording already in progress");
    }

    const audioInput = this.getAudioInputFormat();
    this.currentOutputFile = path.join(
      this.outputDir,
      `story-${options.storyId ?? "default"}.wav`
    );

    const command = [
      "-f",
      audioInput.format,
      "-i",
      audioInput.device,
      "-acodec",
      "pcm_s24le",
      "-ar",
      "48000",
      "-ac",
      "1",
      "-y",
      this.currentOutputFile,
    ];

    if (os.platform() === "win32") {
      command.splice(2, 0, "-audio_buffer_size", "50");
    }

    return new Promise((resolve, reject) => {
      try {
        this.recordingProcess = spawn(this.ffmpegPath, command);

        this.recordingProcess.stderr?.on("data", (data) => {
          console.error("FFmpeg stderr:", data.toString());
        });

        this.recordingProcess.on("error", (err) => {
          console.error("Recording process error:", err);
          this.recordingProcess = null;
          this.currentOutputFile = null;
          reject(new Error(`Recording failed: ${err.message}`));
        });

        if (this.currentOutputFile) {
          resolve(this.currentOutputFile);
        } else {
          reject(new Error("Output file path is null"));
        }
      } catch (error) {
        console.error("Failed to start recording:", error);
        this.recordingProcess = null;
        this.currentOutputFile = null;
        reject(error);
      }
    });
  }

  async stopRecording(): Promise<string> {
    if (!this.recordingProcess) {
      throw new Error("No recording in progress");
    }

    const outputFile = this.currentOutputFile;
    if (!outputFile) {
      throw new Error("No output file path available");
    }

    return new Promise((resolve, reject) => {
      try {
        const signal = os.platform() === "win32" ? "SIGTERM" : "SIGINT";

        this.recordingProcess?.on("exit", async (code) => {
          this.recordingProcess = null;
          this.currentOutputFile = null;
          if (code === 0 || code === null) {
            try {
              await this.generateWaveform(outputFile);
              resolve(outputFile);
            } catch (error) {
              console.error("Failed to generate waveform:", error);
              resolve(outputFile);
            }
          } else {
            reject(new Error(`Recording process exited with code ${code}`));
          }
        });

        this.recordingProcess?.on("error", (err) => {
          this.recordingProcess = null;
          this.currentOutputFile = null;
          reject(err);
        });

        if (this.recordingProcess) {
          this.recordingProcess.kill(signal);
        }
      } catch (error) {
        console.error("Failed to stop recording:", error);
        this.recordingProcess = null;
        this.currentOutputFile = null;
        reject(error);
      }
    });
  }

  async stopAudio(): Promise<void> {
    if (!this.playbackProcess) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const signal = os.platform() === "win32" ? "SIGTERM" : "SIGINT";

        this.playbackProcess?.on("exit", (code) => {
          this.playbackProcess = null;
          if (code !== 0 && code !== null) {
            console.error(`Audio stop process exited with code ${code}`);
            reject(new Error(`Audio stop process exited with code ${code}`));
          } else {
            resolve();
          }
        });

        this.playbackProcess?.on("error", (err) => {
          this.playbackProcess = null;
          reject(err);
        });

        this.playbackProcess?.kill(signal);
      } catch (error) {
        console.error("Failed to stop audio:", error);
        this.playbackProcess = null;
        reject(error);
      }
    });
  }

  async pausePlayback(): Promise<void> {
    if (!this.playbackProcess) throw new Error("No playback in progress");

    if (os.platform() === "win32") {
      await this.stopAudio();
    } else {
      this.playbackProcess.kill("SIGSTOP");
    }
  }

  async resumePlayback(): Promise<void> {
    if (!this.playbackProcess) {
      if (this.currentPlaybackFile) {
        await this.playAudio(this.currentPlaybackFile);
      } else {
        throw new Error("No audio file to resume");
      }
    } else {
      if (os.platform() !== "win32") {
        this.playbackProcess.kill("SIGCONT");
      }
    }
  }

  async seekPlayback(position: number): Promise<void> {
    if (!this.currentPlaybackFile) throw new Error("No audio file to seek");

    await this.stopAudio();
    this.playbackProcess = spawn(this.ffmpegPath, [
      "-ss",
      position.toString(),
      "-i",
      this.currentPlaybackFile,
      "-f",
      os.platform() === "win32" ? "dshow" : "alsa",
      "default",
    ]);
  }

  async forwardPlayback(seconds: number = 5): Promise<void> {
    if (!this.playbackProcess) throw new Error("No playback in progress");
    this.seekPlayback(seconds);
  }

  async backwardPlayback(seconds: number = 5): Promise<void> {
    if (!this.playbackProcess) throw new Error("No playback in progress");
    this.seekPlayback(-seconds);
  }

  async addToPlaylist(filePath: string): Promise<void> {
    this.playlist.push(filePath);
  }

  async clearPlaylist(): Promise<void> {
    this.playlist = [];
    this.currentPlaybackIndex = 0;
  }

  async playNext(): Promise<void> {
    if (this.playlist.length === 0) throw new Error("Playlist is empty");

    this.currentPlaybackIndex =
      (this.currentPlaybackIndex + 1) % this.playlist.length;
    await this.playAudio(this.playlist[this.currentPlaybackIndex]);
  }

  async playPrevious(): Promise<void> {
    if (this.playlist.length === 0) throw new Error("Playlist is empty");

    this.currentPlaybackIndex =
      (this.currentPlaybackIndex - 1 + this.playlist.length) %
      this.playlist.length;
    await this.playAudio(this.playlist[this.currentPlaybackIndex]);
  }

  dispose(): void {
    if (this.recordingProcess) {
      this.recordingProcess.kill();
      this.recordingProcess = null;
    }
    if (this.playbackProcess) {
      this.playbackProcess.kill();
      this.playbackProcess = null;
    }
  }
}
