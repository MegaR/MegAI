import { BufferResolvable } from "discord.js";
import { ChatCompletionMessageParam } from "openai/resources";
import { Stream } from "stream";

export interface Session {
    userId: string;
    responses: string[];
    history: ChatCompletionMessageParam[];
    attachments: { name: string; file: BufferResolvable | Stream }[];
    footer: string[];
}
