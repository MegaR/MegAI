import { BufferResolvable } from "discord.js";
import { Stream } from "stream";

export interface Session {
    channelId: string;
    userId: string;
    responses: string[];
    attachments: { name: string; file: BufferResolvable | Stream }[];
    footer: string[];
}
