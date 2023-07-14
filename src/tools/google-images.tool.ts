import axios from "axios";
import { Session } from "../session.interface";
import Tool from "../tool.interface";
import { customsearch } from "@googleapis/customsearch";

const googleImagesTool: Tool = {
    definition: {
        name: "google_images",
        description: "Search for images on google",
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
    execute: async (parameters: any, session: Session) => {
        const results = await customsearch("v1").cse.list({
            auth: process.env.GOOGLE_API_KEY,
            cx: process.env.GOOGLE_CSE_ID,
            searchType: "image",
            q: parameters.query,
        });
        const resultsFormatted = results.data.items!.slice(0, 5).map((item) => {
            return {
                title: item.title,
                link: item.image?.contextLink,
                imageLink: item.link,
                text: item.snippet,
            };
        });

        for(const result of resultsFormatted.filter(r => r.imageLink)) {
            const image = await downloadImage(result.imageLink!);
            session.attachments.push({file: image, name: 'image.png'});
        }

        return JSON.stringify(resultsFormatted, null, 2);
    },
};

async function downloadImage(url: string): Promise<any> {
    const response = await axios.get(url, {responseType: 'arraybuffer'});
    return response.data;
}

export default googleImagesTool;
