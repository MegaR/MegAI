import { ChatCompletionFunctions } from "openai";

export default interface Tool {
    definition: ChatCompletionFunctions,
    execute: (parameters: any) => Promise<string>,
}