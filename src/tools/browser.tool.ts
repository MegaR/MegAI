import Tool from "../tool.interface";
import { Session } from "../session.interface";
import puppeteer from "puppeteer";

const browserTool: Tool = {
    definition: {
        name: "browser",
        description: "Load a webpage",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "url of the webpage",
                },
            },
            required: ["url"],
        },
    },
    execute: async (parameters: any) => {
        const browser = await puppeteer.connect({
            browserWSEndpoint: process.env.BROWSERLESS_URL,
        });
        try {
            const page = await browser.newPage();
            await page.goto(parameters.url);
            return await page.$eval("*", (el) => {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNode(el);
                selection?.removeAllRanges();
                selection?.addRange(range);
                return (
                    window.getSelection()?.toString() ||
                    "Error: couldnt read website"
                );
            });
        } finally {
            await browser.close();
        }
    },
};

export default browserTool;
