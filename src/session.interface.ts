import { BufferResolvable } from "discord.js";
import { ChatCompletionRequestMessage } from "openai";
import { Stream } from "stream";

export interface Session {
    responses: string[];
    history: ChatCompletionRequestMessage[];
    attachments: BufferResolvable[] | Stream[];
    footer: string[];
}