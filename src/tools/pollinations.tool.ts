import Tool from "../tool.interface";
import axios from "axios";
import { Session } from "../session.interface";
import { getLogger } from "../logger";

const log = getLogger("pollinationsTool");

const pollinationsTool: Tool = {
    definition: {
        name: "image_generator",
        description: "Generate an image based on a prompt",
        parameters: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description:
                        "prompt describing the image. Each part should be separated by a comma. Use aleast 5 keywords. For example: 'beautiful woman, red hair, smiling, walking in a park, photo-realistic, portrait, bright colors'",
                },
            },
            required: ["prompt"],
        },
    },
    execute: async (parameters: any, session?: Session) => {
        const stream = await pollinations(parameters.prompt);
        if (session) {
            session.attachments.push({ file: stream, name: "image.png" });
        }
        return "image.png attached";
    },
};

export async function pollinations(prompt: string): Promise<string> {
    log.debug(`Getting image for prompt: ${prompt}`);
    const encoded = encodeURI(prompt);
    const request = await axios.get(
        `https://image.pollinations.ai/prompt/${encoded}`,
        { responseType: "arraybuffer" }
    );

    return request.data;
}

export default pollinationsTool;
