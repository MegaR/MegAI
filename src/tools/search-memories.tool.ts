import { Session } from "../session.interface";
import Tool from "../tool.interface";
import { MegAI } from "../megai";

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
    execute: async (parameters: any, _: Session, ai: MegAI) => {
        const memories = await ai.recall(parameters.query);
        return JSON.stringify(memories);
    },
};

export default searchMemoriesTool;
