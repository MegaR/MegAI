import { ChatCompletionRequestMessage } from "openai";
import { IncomingMessage } from "node:http";

export interface Session {
    responses: string[];
    history: ChatCompletionRequestMessage[];
    attachments: IncomingMessage[];
    footer: string[];
}
