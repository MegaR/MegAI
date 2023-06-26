import Tool from "../tool.interface";
import axios from "axios";

interface Model {
    name: string;
    model: string;
    token?: string;
}

const stableHordeApiKey = process.env.STABLE_HORDE;

const models: Model[] = [
    {
        name: "default",
        model: "stable_diffusion",
    },
    {
        name: "anime",
        model: "Anything Diffusion",
    },
    {
        name: "photography",
        model: "ICBINP - I Can't Believe It's Not Photography",
    },
];

async function requestImage(prompt: string, model: Model): Promise<string> {
    if (model.token) {
        prompt = `${prompt}, ${model.token}`;
    }
    const request = await axios.post(
        "https://stablehorde.net/api/v2/generate/async",
        {
            prompt: prompt,
            params: {
                steps: 60,
                width: 768,
                height: 768,
                hires_fix: true,
                karras: true,
            },
            models: [model.model],
        },
        {
            headers: {
                apikey: stableHordeApiKey,
            },
        }
    );

    return request.data.id;
}

async function waitForResult(id: string): Promise<string> {
    const request = await axios.get(
        `https://stablehorde.net/api/v2/generate/status/${id}`
    );
    if (request.data.done === true) {
        return request.data.generations[0].img;
    }

    console.log(
        `image not ready. Waiting for ${request.headers["retry-after"]} seconds`
    );
    await sleep(request.headers["retry-after"] * 1000);
    return await waitForResult(id);
}

async function sleep(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time || 10000));
}

const stableHordeTool: Tool = {
    definition: {
        name: "image_generator",
        description: "Generate an image based on a prompt",
        parameters: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description:
                        "prompt describing the image. Each part should be separated by a comma. Use aleast 5 keywords. For example: 'beautiful woman, red hair, smiling, walking in a park, photo-realistic, portrait'",
                },
                model: {
                    type: "string",
                    description:
                        "The model defines the style of the image. Use 'photography' for pictures of real things",
                    enum: models.map((model) => model.name),
                },
            },
            required: ["prompt", "model"],
        },
    },
    execute: async (parameters: any) => {
        let model = models[0];
        if (parameters.prompt) {
            model =
                models.find((model) => model.name === parameters.model) ||
                models[0];
        }
        const id = await requestImage(parameters.prompt, model);
        console.log(`StableHorde image id: ${id}`);
        const image = await waitForResult(id);
        return image;
    },
};

export default stableHordeTool;
