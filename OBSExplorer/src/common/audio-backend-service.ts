import { JsonRpcServer } from '@theia/core/lib/common/messaging/proxy-factory';

export const FFmpegPath = '/services/audio-recorder';
export const FFmpegServer = Symbol('FFmpegServer');

export interface RecordingOptions {
    sampleRate?: number;
    channels?: number;
    format?: string;
    device?: string;
    storyId?:number;
    filename?:string
}

export interface FFmpegServer extends JsonRpcServer<void> {
    startRecording(options?: RecordingOptions): Promise<string>;
    stopRecording(): Promise<void>;
    getFFmpegPath(): Promise<string>;
}
