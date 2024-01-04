import Tool from "../tool.interface";
import { customsearch } from "@googleapis/customsearch";

const googleTool: Tool = {
    definition: {
        name: "google_search",
        description: "Search on google",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "search query",
                },
            },
            required: ["query"],
        },
    },
    execute: async (parameters: any) => {
        const results = await customsearch("v1").cse.list({
            auth: process.env.GOOGLE_API_KEY,
            cx: process.env.GOOGLE_CSE_ID,
            q: parameters.query,
        });
        const resultsFormatted = results.data.items?.map((item) => {
            return {
                title: item.title,
                link: item.link,
                text: item.snippet,
            };
        });
        return JSON.stringify(resultsFormatted || 'No results', null, 2);
    },
};

export default googleTool;
