import Tool from "../tool.interface";
import wiki from "wikipedia";

const wikipediaTool: Tool = {
    definition: {
        name: "wikipedia",
        description: "Search on wikipedia",
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
        const summary = await wiki.summary(parameters.query);
        return JSON.stringify({
            title: summary.title,
            summary: summary.extract,
            link: summary.content_urls.desktop.page,
        });
    },
};

export default wikipediaTool;
