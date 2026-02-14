declare module 'gif-frames' {
    interface FrameData {
        getImage(): any;
        frameIndex: number;
        frameInfo: any;
    }

    interface GifFramesOptions {
        url: string | Buffer;
        frames: 'all' | number | number[];
        outputType?: 'canvas' | 'jpeg' | 'png';
        cumulative?: boolean;
    }

    function gifFrames(options: GifFramesOptions): Promise<FrameData[]>;
    export = gifFrames;
}
