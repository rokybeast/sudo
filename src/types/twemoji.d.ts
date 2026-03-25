declare module 'twemoji-parser' {
    export interface TwemojiEntity {
        url: string;
        indices: [number, number];
        text: string;
        type: 'emoji';
    }
    export function parse(text: string, options?: any): TwemojiEntity[];
}
