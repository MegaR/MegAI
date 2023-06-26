import "dotenv/config";
import {
    Client,
    EmbedBuilder,
    GatewayIntentBits,
    Message,
    Routes,
    hyperlink,
} from "discord.js";
import { OpenAiWrapper } from "./openaiwrapper";

async function start() {
    const client = await setupDiscord();
    const ai = new OpenAiWrapper(client.user?.username!);
    await ai.setup();
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (message.content === "!ping") {
            await message.reply("Pong!");
        }
        if (message.mentions.has(client.user!)) {
            await handleMention(message, ai);
        }
    });
}

async function handleMention(message: Message<boolean>, ai: OpenAiWrapper) {
    const reply = await message.reply({
        embeds: [new EmbedBuilder().setTitle("I'm thinking...⌛")],
    });

    try {
        const user = message.member?.displayName || message.author.username;
        console.log(`[${user}] ${message.cleanContent}`);
        let progress: string[] = [];
        const response = await ai.reply(
            user,
            message.cleanContent,
            async (p) => {
                progress.push(p);
                await progressUpdate(reply, progress);
            }
        );
        reply.delete();
        await chunkedReply(message, response, progress);
    } catch (error) {
        if ((error as any).response) {
            console.error((error as any).response.data);
        } else {
            console.error(error);
        }
        reply.edit("❌ Something went wrong. 😢");
    }
}

async function progressUpdate(message: Message<boolean>, progress: string[]) {
    await message.edit({
        embeds: [
            new EmbedBuilder()
                .setTitle("I'm thinking...⌛")
                .setDescription(progress.join("\n")),
        ],
    });
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
    await client.rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: [] }
    );
    return client;
}

async function chunkedReply(
    message: Message<boolean>,
    reply: string,
    progress: string[]
) {
    const chunks = reply.match(/[\s\S]{1,4096}/g);
    if (!chunks) throw new Error("Failed chunk reply");
    for (const chunk of chunks) {
        let embed = new EmbedBuilder().setDescription(chunk);
        if (progress.length > 0) {
            embed = embed.setFooter({ text: progress.join("\n") });
        }
        const regex = /\((https:\/\/.*?.cloudflarestorage\.com\/stable-horde.*?)\)/g;
        const match = regex.exec(chunk);
        if(match) {
            embed = embed.setImage(match[1]);
        }
        await message.reply({ embeds: [embed] });
    }
}

start();
