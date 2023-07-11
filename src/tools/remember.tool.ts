import { Session } from "../session.interface";
import Tool from "../tool.interface";
import { OpenAiWrapper } from "../openaiwrapper";

const rememberTool: Tool = {
    definition: {
        name: "save_memory",
        description: "Save something to memory. Use this to save information about users.",
        parameters: {
            type: "object",
            properties: {
                memory: {
                    type: "string",
                    description: "Text you want to store written in third person",
                },
            },
            required: ["memory"],
        },
    },
    execute: async (parameters: any, _: Session, ai: OpenAiWrapper) => {
        await ai.remember(parameters.memory);
        return `I will remember ${parameters.memory}!`;
    },
};

export default rememberTool;
