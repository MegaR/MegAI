import axios from "axios";

export async function tts(text: string) {
    const url = `${process.env.LOCALAI}/tts`;
    const model = process.env.LOCALAI_TTS_MODEL;
    const response = await axios.post(
        url,
        JSON.stringify({
            input: text,
            model: model,
        }),
        {
            headers: {
                "content-type": "application/json",
            },
            responseType: "arraybuffer",
        }
    );
    return response.data;
}
