import { injectable } from "@theia/core/shared/inversify";
import {
  FFmpegServer,
  RecordingOptions,
  FileNode,
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
  private outputDir: string = "";
  private readonly ffmpegPath = this.getPlatformSpecificFFmpegPath();

  private currentPlaybackFile: string | null = null;

  private tempRecordings: string[] = [];
  private isRecordingPaused: boolean = false;
  private currentStoryId: string | null = null;
  private segmentCounter: number = 1; // A
  private mergeErrors: string = "";

  constructor() {
    this.checkFFmpegInstallation();
  }

  async setWorkspacePath(workspacePath: string): Promise<void> {
    try {
      this.outputDir = path.join(workspacePath, "audio-recordings");
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log("Audio recordings directory set to:", this.outputDir);
    } catch (error) {
      console.error("Failed to set workspace path:", error);
      throw error;
    }
  }

  async getFileTree(rootPath: string): Promise<FileNode> {
    const buildTree = async (dirPath: string): Promise<FileNode[]> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const items = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              const children = await buildTree(fullPath);
              return {
                name: entry.name,
                type: "folder" as const,
                path: fullPath,
                children,
              };
            } else {
              return {
                name: entry.name,
                type: "file" as const,
                path: fullPath,
              };
            }
          })
        );
        return items;
      } catch (error) {
        console.error("Error reading directory:", dirPath, error);
        return [];
      }
    };

    try {
      const audioFolder = path.join(rootPath, "audio-recordings");
      await fs.access(audioFolder);

      const children = await buildTree(audioFolder);
      return {
        name: "audio-recordings",
        type: "folder",
        path: audioFolder,
        children,
      };
    } catch (error) {
      console.error("Failed to get file tree:", error);
      throw error;
    }
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
  async startRecording(options: RecordingOptions = {}): Promise<string> {
    this.validateOutputDir();
    if (this.recordingProcess && !this.isRecordingPaused) {
      throw new Error("Recording already in progress");
    }

    const audioInput = this.getAudioInputFormat();
    this.currentStoryId = options.storyId?.toString() ?? "default";

    if (!this.isRecordingPaused && this.tempRecordings.length === 0) {
      this.segmentCounter = 1;
    }

    if (!this.isRecordingPaused) {
      this.currentOutputFile = path.join(
        this.outputDir,
        `temp_${this.segmentCounter.toString().padStart(3, "0")}_story-${
          this.currentStoryId
        }.wav`
      );
    }

    const command = [
      "-f",
      audioInput.format,
      "-i",
      audioInput.device,
      "-thread_queue_size",
      "4096",
      "-acodec",
      "pcm_s24le",
      "-ar",
      "48000",
      "-ac",
      "1",
      // "-af",
      // "highpass=f=50,lowpass=f=15000,silenceremove=1:0:-50dB",
      "-avoid_negative_ts",
      "make_zero",
      "-y",
      this.currentOutputFile!,
    ];

    if (os.platform() === "win32") {
      command.splice(2, 0, "-audio_buffer_size", "50");
    }

    return new Promise((resolve, reject) => {
      try {
        this.recordingProcess = spawn(this.ffmpegPath, command);
        this.isRecordingPaused = false;

        this.recordingProcess.stderr?.on("data", (data) => {
          console.log("FFmpeg stderr:", data.toString());
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

  // async stopRecording(): Promise<string> {
  //   if (!this.recordingProcess) {
  //     throw new Error("No recording in progress");
  //   }

  //   const killPromise = new Promise<void>((resolve, reject) => {
  //     const signal = os.platform() === "win32" ? "SIGTERM" : "SIGINT";

  //     this.recordingProcess?.on("exit", (code) => {
  //       if (code === 0 || code === null) {
  //         resolve();
  //       } else {
  //         reject(new Error(`Recording process exited with code ${code}`));
  //       }
  //       this.recordingProcess = null;
  //     });

  //     this.recordingProcess?.kill(signal);
  //   });

  //   const timeoutPromise = new Promise<void>((resolve) => {
  //     setTimeout(() => {
  //       console.warn(
  //         "FFmpeg process did not terminate gracefully. Forcing termination."
  //       );
  //       this.recordingProcess?.kill("SIGKILL");
  //       resolve();
  //     }, 1000);
  //   });

  //   await Promise.race([killPromise, timeoutPromise]);

  //   if (this.currentOutputFile) {
  //     this.tempRecordings.push(this.currentOutputFile);
  //     this.currentOutputFile = null;
  //   }

  //   if (this.tempRecordings.length > 0) {
  //     const finalOutputFile = path.join(
  //       this.outputDir,
  //       `story-${this.currentStoryId}.wav`
  //     );

  //     const sortedRecordings = [...this.tempRecordings].sort((a, b) => {
  //       const segmentA = parseInt(path.basename(a).split("_")[1]);
  //       const segmentB = parseInt(path.basename(b).split("_")[1]);
  //       return segmentA - segmentB;
  //     });

  //     console.log("Sorted recordings:", sortedRecordings);

  //     const fileListPath = path.join(this.outputDir, "filelist.txt");
  //     await fs.writeFile(
  //       fileListPath,
  //       sortedRecordings.map((f) => `file '${f}'`).join("\n")
  //     );

  //     try {
  //       await new Promise<void>((resolve, reject) => {
  //         console.log("Merging files in order:", sortedRecordings);

  //         const mergeProcess = spawn(this.ffmpegPath, [
  //           "-f",
  //           "concat",
  //           "-safe",
  //           "0",
  //           "-i",
  //           fileListPath,
  //           finalOutputFile,
  //         ]);

  //         mergeProcess.stderr?.on("data", (data) => {
  //           console.log("FFmpeg merge stderr:", data.toString());
  //           this.mergeErrors += data.toString();
  //         });

  //         mergeProcess.on("close", async (code) => {
  //           if (code === 0) {
  //             await Promise.all([
  //               ...sortedRecordings.map((f) => fs.unlink(f)),
  //               fs.unlink(fileListPath),
  //             ]);
  //             resolve();
  //           } else {
  //             reject(
  //               new Error(
  //                 `Merge process exited with code ${code}. Stderr: ${this.mergeErrors}`
  //               )
  //             );
  //           }
  //         });
  //       });

  //       this.tempRecordings = [];
  //       this.isRecordingPaused = false;
  //       this.currentStoryId = null;
  //       this.segmentCounter = 1;

  //       return finalOutputFile;
  //     } catch (error) {
  //       console.error("Failed to merge recordings:", error);
  //       throw error;
  //     }
  //   }

  //   throw new Error("No recordings to process");
  // }


  async stopRecording(): Promise<string> {
    if (!this.recordingProcess) {
        throw new Error("No recording in progress");
    }

    // Send SIGTERM first to allow graceful shutdown
    const killPromise = new Promise<void>((resolve, reject) => {
        let stdErrOutput = '';
        
        // Capture any error output
        this.recordingProcess?.stderr?.on('data', (data) => {
            stdErrOutput += data.toString();
        });

        // Send q command first (if platform supports it)
        if (os.platform() !== "win32") {
            this.recordingProcess?.stdin?.write('q');
        }

        // Wait a moment for the q command to take effect
        setTimeout(() => {
            const signal = os.platform() === "win32" ? "SIGTERM" : "SIGINT";

            this.recordingProcess?.on("exit", (code) => {
                if (code === 0 || code === null) {
                    resolve();
                } else {
                    reject(new Error(`Recording process exited with code ${code}\nError output: ${stdErrOutput}`));
                }
                this.recordingProcess = null;
            });

            // Send termination signal
            this.recordingProcess?.kill(signal);
        }, 500); // Give FFmpeg 500ms to process the q command
    });

    // Increased timeout to allow for proper file finalization
    const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
            console.warn("FFmpeg process did not terminate gracefully. Forcing termination.");
            this.recordingProcess?.kill("SIGKILL");
            reject(new Error("FFmpeg termination timeout"));
        }, 3000); // Increase timeout to 3 seconds
    });

    try {
        await Promise.race([killPromise, timeoutPromise]);

        // Add a small delay after process termination to ensure file system operations are complete
        await new Promise(resolve => setTimeout(resolve, 500));

        if (this.currentOutputFile) {
            // Verify the file exists and has content
            const stats = await fs.stat(this.currentOutputFile);
            if (stats.size === 0) {
                throw new Error("Recording file is empty");
            }
            
            this.tempRecordings.push(this.currentOutputFile);
            this.currentOutputFile = null;
        }

        if (this.tempRecordings.length > 0) {
            const finalOutputFile = path.join(
                this.outputDir,
                `story-${this.currentStoryId}.wav`
            );

            const sortedRecordings = [...this.tempRecordings].sort((a, b) => {
                const segmentA = parseInt(path.basename(a).split("_")[1]);
                const segmentB = parseInt(path.basename(b).split("_")[1]);
                return segmentA - segmentB;
            });

            console.log("Sorted recordings:", sortedRecordings);

            const fileListPath = path.join(this.outputDir, "filelist.txt");
            await fs.writeFile(
                fileListPath,
                sortedRecordings.map((f) => `file '${f}'`).join("\n")
            );

            try {
                await new Promise<void>((resolve, reject) => {
                    console.log("Merging files in order:", sortedRecordings);
                    
                    const mergeProcess = spawn(this.ffmpegPath, [
                        "-f",
                        "concat",
                        "-safe",
                        "0",
                        "-i",
                        fileListPath,
                        "-y",
                        finalOutputFile,
                    ]);

                    let mergeStderr = '';
                    mergeProcess.stderr?.on("data", (data) => {
                        console.log("FFmpeg merge stderr:", data.toString());
                        mergeStderr += data.toString();
                        this.mergeErrors += data.toString();
                    });

                    mergeProcess.on("close", async (code) => {
                        if (code === 0) {
                            // Verify the merged file
                            const stats = await fs.stat(finalOutputFile);
                            if (stats.size === 0) {
                                reject(new Error("Merged file is empty"));
                                return;
                            }

                            // Clean up temp files
                            await Promise.all([
                                ...sortedRecordings.map((f) => fs.unlink(f)),
                                fs.unlink(fileListPath),
                            ]);
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    `Merge process exited with code ${code}. Stderr: ${mergeStderr}`
                                )
                            );
                        }
                    });
                });

                this.tempRecordings = [];
                this.isRecordingPaused = false;
                this.currentStoryId = null;
                this.segmentCounter = 1;

                return finalOutputFile;
            } catch (error) {
                console.error("Failed to merge recordings:", error);
                throw error;
            }
        }

        throw new Error("No recordings to process");
    } catch (error) {
        console.error("Error in stopRecording:", error);
        throw error;
    }
}
  async pauseRecording(): Promise<string> {
    if (!this.recordingProcess || this.isRecordingPaused) {
      throw new Error("No active recording to pause");
    }

    return new Promise((resolve, reject) => {
      const signal = os.platform() === "win32" ? "SIGTERM" : "SIGINT";

      setTimeout(async () => {
        this.recordingProcess?.on("exit", async (code) => {
          if (code === 0 || code === null) {
            if (this.currentOutputFile) {
              this.tempRecordings.push(this.currentOutputFile);
              this.isRecordingPaused = true;
              this.segmentCounter++;
              this.recordingProcess = null;
              resolve(this.currentOutputFile);
            }
          } else {
            reject(new Error(`Recording process exited with code ${code}`));
          }
        });

        this.recordingProcess?.on("error", (err) => {
          this.recordingProcess = null;
          reject(err);
        });

        this.recordingProcess?.kill(signal);
      }, 500);
    });
  }

  async resumeRecording(): Promise<string> {
    if (!this.isRecordingPaused) {
      throw new Error("No paused recording to resume");
    }
    this.currentOutputFile = path.join(
      this.outputDir,
      `temp_${this.segmentCounter.toString().padStart(3, "0")}_story-${
        this.currentStoryId
      }.wav`
    );

    return this.startRecording({
      storyId: this.currentStoryId ? parseInt(this.currentStoryId) : undefined,
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

  private validateOutputDir(): void {
    if (!this.outputDir) {
      throw new Error(
        "Workspace path not set. Please call setWorkspacePath first."
      );
    }
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

  async getAudioDevices(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        try {
            const platform = os.platform();
            const command = [
                "-list_devices", "true",
                "-f", platform === "darwin"? "avfoundation": (platform === "win32"? "dshow": "alsa"),
                "-i", platform === "darwin"? "": "dummy"
            ];

            const process = spawn(this.ffmpegPath, command);
            let output = "";

            process.stdout?.on("data", (data) => {
                output += data.toString();
            });

            process.stderr?.on("data", (data) => {
                console.error("FFmpeg stderr:", data.toString());
                if (platform === "win32") {  // Capture stderr for Windows
                    output += data.toString();
                }
            });
            console.log(output,"output")
                  
            process.on("close", (code) => {
                if (code === 0) {
                  console.log(output,"jjooe")
                    const devices = output.split("\n")
                      .map(line => {
                        const match = line.match(/"(.*?)" \[/); // Extract device name between quotes and before [
                        return match ? match[1] : null; // Extract the device name from the match
                      })
                      .filter(device => device !== null) as string[];
                      console.log("Found audio devices:", devices); // Log the found devices
                    resolve(devices);
                } else {
                    reject(new Error("Failed to get audio devices"));
                }
            });
        } catch (error) {
            console.error("Error getting audio devices:", error);
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

  async deleteFile(path: string): Promise<void> {
    try {
      await fs.unlink(path);
    } catch (error) {
      console.error("Failed to delete file:", error);
      throw error;
    }
  }

  async createFolder(path: string): Promise<void> {
    this.validateOutputDir();
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (error) {
      console.error("Failed to create folder:", error);
      throw error;
    }
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
