import "dotenv/config";
import {
    ApplicationCommandType,
    AttachmentBuilder,
    Client,
    EmbedBuilder,
    GatewayIntentBits,
    Message,
    MessageContextMenuCommandInteraction,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    Routes,
    SlashCommandBuilder,
} from "discord.js";
import { OpenAiWrapper } from "./openaiwrapper";
import { Session } from "./session.interface";
import { DateTime } from "luxon";

async function start() {
    const client = await setupDiscord();
    const ai = new OpenAiWrapper(client.user?.username!);
    await ai.setup();
    client.on("messageCreate", async (message) => {
        // if (message.author.bot) return;
        if (message.content === "!ping") {
            await message.reply("Pong!");
        }
        if (message.mentions.members?.has(client.user!.id)) {
            await handleMention(message, ai);
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand()) return;
        if (interaction.commandName === "reply") {
            if (
                (interaction as MessageContextMenuCommandInteraction)
                    .targetMessage.author === client.user
            ) {
                await interaction.reply({
                    content: "I can't reply to myself!",
                    ephemeral: true,
                });
                return;
            }
            await interaction.reply({ content: "Replying!", ephemeral: true });
            await handleMention(
                (interaction as MessageContextMenuCommandInteraction)
                    .targetMessage,
                ai
            );
        }
    });
}

function formatPrompt(user: string, message: Message<boolean>) {
    const timestamp = DateTime.fromJSDate(message.createdAt).toFormat(
        "yyyy-MM-dd HH:mm:ss"
    );
    return `[${timestamp}]${user}: ${message.cleanContent}`;
}

async function handleMention(message: Message<boolean>, ai: OpenAiWrapper) {
    const reply = await message.reply({
        embeds: [new EmbedBuilder().setTitle("I'm thinking...⌛")],
    });

    try {
        const user = message.author.username;
        const prompt = formatPrompt(user, message);
        console.log(prompt);

        await ai.reply(user, message.cleanContent, async (s) => {
            await updateMessage(reply, s);
        });
    } catch (error) {
        if ((error as any).response) {
            console.error("network error: ", (error as any)?.response?.data);
        } else {
            console.error(error);
        }
        reply.edit("❌ Something went wrong. 😢");
    }
}

async function updateMessage(message: Message<boolean>, session: Session) {
    let embed = new EmbedBuilder();
    let files: AttachmentBuilder[] = [];

    if (session.responses.length > 0) {
        embed = embed.setDescription(session.responses.join("\n"));
    }

    if (session.footer.length > 0) {
        embed = embed.setFooter({ text: session.footer.join("\n") });
    }

    if (session.attachments.length > 0) {
        for (let i = 0; i < session.attachments.length; i++) {
            const file = new AttachmentBuilder(session.attachments[i], {
                name: `image${i}.png`,
            });
            embed = embed.setImage(`attachment://image${i}.png`);
            files.push(file);
        }
    }

    await message.edit({
        embeds: [embed],
        files: files,
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

    const replyCommand = {
        name: "reply",
        type: ApplicationCommandType.Message,
    };
    replyCommand.type = ApplicationCommandType.Message;
    await client.rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: [replyCommand] }
    );
    return client;
}

start();
