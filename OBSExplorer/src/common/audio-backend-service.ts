import { RpcServer } from "@theia/core/lib/common/messaging/proxy-factory";

export const FFmpegPath = "/services/audio-recorder"; 
export const FFmpegServer = Symbol("FFmpegServer");

export interface RecordingOptions {
    sampleRate?: number;
    channels?: number;
    format?: string;
    device?: string;
    storyId?: number;
    filename?: string;
}

export interface FFmpegServer extends RpcServer<void> {
    startRecording(options?: RecordingOptions): Promise<string>;
    stopRecording(): Promise<string>;
    getFFmpegPath(): Promise<string>; 
    mergeAudio(storyId: string): Promise<string>;
    generateWaveform(audioFile: string): Promise<string>;
    stopAudio(): Promise<void>;
    pausePlayback(): Promise<void>;
    resumePlayback(): Promise<void>;
    seekPlayback(position: number): Promise<void>;
    forwardPlayback(seconds:number): Promise<void>;
    backwardPlayback(seconds:number): Promise<void>;
    playNext(): Promise<void>;
    playPrevious(): Promise<void>;
    getAudioFiles(): Promise<string[]>;  
    playAudio(audioFile: string): Promise<void>;
}