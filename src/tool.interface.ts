import { ChatCompletionFunctions } from "openai";
import { Session } from "./session.interface";
import { OpenAiWrapper } from "./openaiwrapper";

export default interface Tool {
    definition: ChatCompletionFunctions;
    execute: (
        parameters: any,
        session: Session,
        ai: OpenAiWrapper
    ) => Promise<string>;
}
