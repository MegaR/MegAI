import Tool from "../tool.interface";
import { Session } from "../session.interface";
import { getLogger } from "../logger";
import { ai } from "../openaiwrapper";

const dalleTool: Tool = {
    adminOnly: true,
    definition: {
        name: "image_generator",
        description: "Generate an image based on a prompt",
        parameters: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description:
                        "Prompt describing the image. Be very descriptive.",
                },
            },
            required: ["prompt"],
        },
    },
    execute: async (parameters: any, session?: Session) => {
        const image = await ai.dalle(parameters.prompt);
        const data = Buffer.from(image, "base64");
        if (session) {
            session.attachments.push({ file: data, name: "image.png" });
        }
        return "Image is attached to response.";
    },
};

export default dalleTool;
