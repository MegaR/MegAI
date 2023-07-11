import { Session } from "../session.interface";
import Tool from "../tool.interface";
import { OpenAiWrapper } from "../openaiwrapper";

const searchMemoriesTool: Tool = {
    definition: {
        name: "search_memories",
        description: "Search your memories for something.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Keywords or sentence to search for.",
                },
            },
            required: ["query"],
        },
    },
    execute: async (parameters: any, _: Session, ai: OpenAiWrapper) => {
        const memories = await ai.recall(parameters.query);
        return JSON.stringify(memories);
    },
};

export default searchMemoriesTool;
