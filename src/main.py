import os
from dotenv import load_dotenv
load_dotenv()

import discord
from typing import Any, Dict
from langchain.callbacks.base import BaseCallbackHandler
from mylangchain import agent


class MyCallBackHandler(BaseCallbackHandler):
    def __init__(self):
        self.history = '';
    
    def on_tool_start(
        self, serialized: Dict[str, Any], input_str: str, **kwargs: Any
    ) -> Any:
        print(f"🔧 Tool {serialized['name']} started")
        self.history += f"🔧 Tool {serialized['name']} used: {input_str}\n"

class MyClient(discord.Client):
    async def on_ready(self):
        print(f'Logged on as {self.user}!')

    async def on_message(self, message):
        if message.author == self.user:
            return
        if message.mentions.__contains__(self.user) is False:
            return
        await self.handle_message(message)

    async def handle_message(self, message: discord.Message):
        if message.author is None:
            return
        if self.user is None:
            return
        print(f'Message from {message.author.display_name}: {message.content}')
        clean_message = f'{message.author.display_name}: ' + \
            message.clean_content.replace(
                f'@{self.user.display_name}', '').strip()
        print(clean_message)
        statusMessage: discord.Message = await message.reply("⏳Please wait⏳", mention_author=True);
        await message.channel.typing();
        try:
            handler = MyCallBackHandler()
            response = agent.run(input=clean_message, callbacks=[handler]);
            print(response)
            await statusMessage.edit(content=handler.history + '✅ Finished');
            await self.chunk_reply(message, response)
        except Exception as e:
            print(e)
            await statusMessage.reply("❌Sorry an error occured❌", mention_author=True)
        

    async def chunk_reply(self, replyMessage, response):
        chunks = [response[i:i+1999] for i in range(0, len(response), 1999)]
        for chunk in chunks:
            await replyMessage.reply(chunk, mention_author=True)


##################################################
# discord
intents = discord.Intents.default()
intents.message_content = True

client = MyClient(intents=intents)
client.run(os.getenv('DISCORD_TOKEN') or '')
##################################################
