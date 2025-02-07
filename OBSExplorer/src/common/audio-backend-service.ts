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


export interface FileNode {
    name: string;
    type: 'file' | 'folder';
    path: string;
    children?: FileNode[];
}


export interface FFmpegServer extends RpcServer<void> {
    startRecording(options?: RecordingOptions): Promise<string>;
    stopRecording(): Promise<string>;
    getFFmpegPath(): Promise<string>; 
    getAudioFiles(): Promise<string[]>;  
    deleteFile(path: string): Promise<void>;
    createFolder(path: string): Promise<void>;
    getFileTree(rootPath: string): Promise<any>;
    setWorkspacePath(path: string): Promise<void>;
    resumeRecording(): Promise<string>;
    pauseRecording(): Promise<string>;
    getAudioDevices(): Promise<string[]>;
}