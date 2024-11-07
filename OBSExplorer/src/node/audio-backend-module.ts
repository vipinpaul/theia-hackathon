import { injectable } from "@theia/core/shared/inversify";
import {
  FFmpegServer,
  RecordingOptions,
} from "../common/audio-backend-service";
import { spawn, ChildProcess, execSync } from "child_process";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";

@injectable()
export class FFmpegServerImpl implements FFmpegServer {
  private recordingProcess: ChildProcess | null = null;
  private readonly outputDir: string;
  private readonly ffmpegPath: string;

  constructor() {
    this.outputDir = path.join(__dirname, "../../../audio-recordings");
    this.ffmpegPath = this.getPlatformSpecificFFmpegPath();
    this.setupOutputDirectory().catch(console.error);
    this.checkFFmpegInstallation().catch(console.error);
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
      console.log("Output directory created/verified at:", this.outputDir);
    } catch (err) {
      console.error("Error creating output directory:", err);
      throw new Error("Failed to create output directory");
    }
  }

  async getFFmpegPath(): Promise<string> {
    if (!this.ffmpegPath) {
      throw new Error("FFmpeg binary not found");
    }
    console.log("FFmpeg path:", this.ffmpegPath);
    return this.ffmpegPath;
  }

  private async checkFFmpegInstallation(): Promise<void> {
    try {
      await fs.access(this.ffmpegPath, fs.constants.X_OK);
      const versionOutput = execSync(`${this.ffmpegPath} -version`).toString();
      console.log("FFmpeg is working:\n", versionOutput);
    } catch (error) {
      console.log(this.ffmpegPath, "path");
      console.error("Error accessing or executing FFmpeg:", error);
      throw new Error("FFmpeg binary is not accessible or not working");
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
        return {
          format: "alsa",
          device: "default",
        };
      case "darwin":
        return {
          format: "avfoundation",
          device: "0",
        };

      default:
        throw new Error("Unsupported OS platform for FFmpeg");
    }
  }

  async listAudioInputDevices(): Promise<void> {
    const listCommand = [
      this.ffmpegPath,
      "-list_devices",
      "true",
      "-f",
      "dshow",
      "-i",
      "dummy",
    ];
    console.log(
      "Listing audio input devices with command:",
      listCommand.join(" ")
    );

    try {
      const output = execSync(listCommand.join(" "), {
        stdio: "pipe",
      }).toString();
      console.log("Available audio input devices:\n", output);
    } catch (error) {
      console.error("Failed to list audio input devices:", error);
      throw new Error("Error listing audio input devices");
    }
  }

  async listAudioDevices(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const listCommand = [
        "-list_devices",
        "true",
        "-f",
        "dshow",
        "-i",
        "dummy",
      ];

      const process = spawn(this.ffmpegPath, listCommand);

      const devices: string[] = [];
      process.stderr.on("data", (data) => {
        const output = data.toString();
        if (output.includes("DirectShow")) {
          devices.push(output);
        }
      });

      process.on("exit", (code) => {
        if (code === 0) {
          resolve(devices);
        } else {
          reject("Failed to list devices");
        }
      });
    });
  }

  async startRecording(options: RecordingOptions = {}): Promise<string> {
    if (this.recordingProcess) {
      throw new Error("Recording already in progress");
    }

    try {
      await fs.access(this.ffmpegPath, fs.constants.X_OK);
    } catch (error) {
      throw new Error("FFmpeg binary not accessible");
    }

    // const outputFile = path.join(this.outputDir, `story-${storyId}.wav`);
    const audioInput = this.getAudioInputFormat();

    const outputFile = path.join(
      this.outputDir,
      options.filename
        ? `story-${options.filename}.wav`
        : `story-${options.storyId ?? "default"}.wav`
    );

    console.log("Starting recording with options:", {
      format: options.format || audioInput.format,
      device: options.device || audioInput.device,
      outputFile,
    });

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
      outputFile,
    ];

    if (os.platform() === "win32") {
      command.splice(2, 0, "-audio_buffer_size", "50");
    }

    console.log("Using FFmpeg binary at:", this.ffmpegPath);
    console.log("FFmpeg command:", command.join(" "));

    return new Promise((resolve, reject) => {
      try {
        this.recordingProcess = spawn(this.ffmpegPath, command);

        console.log(
          "Recording process started with PID:",
          this.recordingProcess.pid
        );

        this.recordingProcess.stderr?.on("data", (data: Buffer) => {
          const output = data.toString();
          if (!output.includes("frame=") && !output.includes("size=")) {
            console.log("FFmpeg output:", output);
          }
        });

        this.recordingProcess.on("error", (err: Error) => {
          this.recordingProcess = null;
          reject(new Error(`Recording failed: ${err.message}`));
        });

        this.recordingProcess.on(
          "exit",
          (code: number | null, signal: string | null) => {
            if (code !== null && code !== 0) {
              reject(new Error(`FFmpeg process exited with code ${code}`));
            } else {
              resolve(outputFile);
            }
          }
        );

        setTimeout(() => {
          if (this.recordingProcess?.exitCode !== null) {
            const error = new Error(
              "Recording process failed to start or exited prematurely"
            );
            this.recordingProcess = null;
            reject(error);
          } else {
            resolve(outputFile);
          }
        }, 2000);
      } catch (error) {
        reject(new Error(`Failed to start recording: ${error.message}`));
      }
    });
  }

  async stopRecording(): Promise<void> {
    if (!this.recordingProcess) {
      throw new Error("No recording in progress");
    }

    return new Promise<void>((resolve, reject) => {
      const signal = os.platform() === "win32" ? "SIGTERM" : "SIGINT";

      this.recordingProcess?.once(
        "exit",
        (code: number | null, signal: string | null) => {
          this.recordingProcess = null;
          resolve();
        }
      );

      this.recordingProcess?.once("error", (error: Error) => {
        this.recordingProcess = null;
        reject(error);
      });

      try {
        this.recordingProcess?.kill(signal);
      } catch (error) {
        reject(new Error(`Failed to stop recording: ${error.message}`));
      }
    });
  }

  setClient(): void {}
  getClient?(): void {
    return;
  }

  dispose(): void {
    if (this.recordingProcess) {
      this.recordingProcess.kill();
      this.recordingProcess = null;
    }
  }
}
