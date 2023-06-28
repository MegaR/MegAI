import { ChatCompletionFunctions } from "openai";
import { Session } from "./session.interface";

export default interface Tool {
    definition: ChatCompletionFunctions;
    execute: (parameters: any, session: Session) => Promise<string>;
}
