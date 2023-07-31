import axios from "axios";
import MarkdownIt from "markdown-it";

export async function tts(text: string) {
    const url = `${process.env.LOCALAI}/tts`;
    const model = process.env.LOCALAI_TTS_MODEL;
    const response = await axios.post(
        url,
        JSON.stringify({
            input: convertMarkdownToText(text),
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

function convertMarkdownToText(markdown: string): string {
    const md = new MarkdownIt();
    const result = md.render(markdown);
    return result.replace(/<\/?[^>]+(>|$)/g, "");
}
