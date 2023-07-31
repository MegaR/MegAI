import { ChatCompletionFunctions } from "openai";
import { Session } from "./session.interface";
import { MegAI } from "./megai";

export default interface Tool {
    definition: ChatCompletionFunctions;
    execute: (parameters: any, session: Session, ai: MegAI) => Promise<string>;
}
