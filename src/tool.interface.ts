import { Session } from "./session.interface";
import { MegAI } from "./megai";
import { ChatCompletionCreateParams } from "openai/resources";

export default interface Tool {
    definition: ChatCompletionCreateParams.Function;
    execute: (parameters: any, session: Session, ai: MegAI) => Promise<string>;
    adminOnly?: true;
}
