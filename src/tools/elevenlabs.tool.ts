import axios from "axios";
import { Session } from "../session.interface";
import Tool from "../tool.interface";

const elevenLabsTool: Tool = {
    definition: {
        name: "text_to_speech",
        description: "Convert text to speech",
        parameters: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "text to convert",
                },
            },
            required: ["text"],
        },
    },
    execute: async (parameters: any, session: Session) => {
        const buffer = await textToSpeech(parameters.text);
        session.attachments.push({file: buffer, name: 'audio.wav'});
        return 'Audio attached to message.';
    },
};

async function textToSpeech(text: string) {
    const voiceID = "21m00Tcm4TlvDq8ikWAM";
    const response = await axios.post(
        "https://api.elevenlabs.io/v1/text-to-speech/" + voiceID,
        JSON.stringify({
            text: text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.5,
                use_speaker_boost: true,
            },
        }),
        {
            headers: {
                "xi-api-key": process.env.ELEVENLABS,
                "content-type": "application/json",
            },
            responseType: "arraybuffer",
        }
    );
    return response.data;
}

export default elevenLabsTool;
