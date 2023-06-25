import "dotenv/config";
import { Client, GatewayIntentBits, Message, Routes, hyperlink } from "discord.js";
import { OpenAiWrapper } from "./openaiwrapper";

// const personality = `Your name is BOTNAME`;

async function start() {
    const client = await setupDiscord();
    const ai = new OpenAiWrapper(client.user?.username!);
    await ai.setup();
    client.on("messageCreate", async (message) => {
        if(message.author.bot) return;
        if (message.content === "!ping") {
            await message.reply("Pong!");
        }
        if (message.mentions.has(client.user!)) {
            await handleMention(message, ai);
        }
    });
}

async function handleMention(message: Message<boolean>, ai: OpenAiWrapper) {
    const reply = await message.reply("I'm thinking...⌛");
    try {
        const user = message.member?.displayName || message.author.username;
        console.log(`[${user}] ${message.cleanContent}`);
        const response = await ai.reply(user, message.cleanContent);
        await chunkedReply(reply, response);
    } catch (error) {
        if ((error as any).response) {
            console.error((error as any).response.data);
        } else {
            console.error(error);
        }
        reply.edit("❌ Something went wrong. 😢");
    }
}

async function setupDiscord() {
    console.log("setting up Discord");
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    client.on("ready", () => {
        console.log(`Logged in as ${client.user?.tag}!`);
    });

    await client.login(process.env.DISCORD_TOKEN);
    // await client.rest.put(
    //     Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
    //     { body: [] }
    // );
    return client;
}

async function chunkedReply(message: Message<boolean>, reply: string) {
    const chunks = reply.match(/[\s\S]{1,2000}/g);
    if (!chunks) throw new Error("No failed chunk reply");
    for(const chunk of chunks) {
        await message.reply({ content: chunk});
    }
}

start();
