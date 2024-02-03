import Tool from "../tool.interface";
import { ai } from "../openaiwrapper";
import { getLogger } from "../logger";

const logger = getLogger('inspectImageTool');
const inspectImageTool: Tool = {
    definition: {
        name: 'inspect_image',
        description: 'The inspect_image tool allows you to view an image. You pass the tool an url and a prompt with a question about the image. Example prompts: \'Describe the image?\`, \'How many people are in this image?\'',
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description:
                        "url of the image",
                },
                prompt: {
                    type: "string",
                    description:
                        "Prompt with a question you have about the image",
                }
            },
            required: ["url", "prompt"],
        },
    },
    execute: async (parameters: any) => {
        try {
            const url = parameters.url;
            const prompt = parameters.prompt;
            if (!url || !prompt) {
                return 'Error: url and prompt are required';
            }

            logger.debug('Inspecting image:', url, 'with prompt:', prompt);
            const response = await ai.chatCompletion(
                [
                    {
                        role: 'user', content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url, detail: 'low' } },
                        ]
                    }
                ],
                {
                    model: 'gpt-4-vision-preview',
                    max_tokens: 250,
                },
            );
            logger.debug(`Inspecting image response: ${response.content}`);
            return response.content!;
        } catch (error: any) {
            logger.error(error);
            return error.toString();
        }
    },
};

export default inspectImageTool;
