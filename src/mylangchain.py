
import os
from langchain.chat_models import ChatOpenAI
from langchain.agents import load_tools
from langchain.agents import initialize_agent
from langchain.agents import AgentType
from langchain.memory import ConversationBufferWindowMemory
from langchain.tools import YouTubeSearchTool

##################################################
# Langchain
llm = ChatOpenAI(openai_api_key=os.getenv('OPENAI_API') or '', client=None)
memory = ConversationBufferWindowMemory(
    memory_key="chat_history", return_messages=True, k=5)
tools = load_tools([
    "llm-math",
    "google-search",
    "wikipedia",
    "open-meteo-api",
    # "tmdb-api",
    # "openweathermap-api",
], llm=llm, tmdb_bearer_token=os.getenv('TMDB_BEARER_TOKEN'))
tools.append(YouTubeSearchTool())
# prompt = PromptTemplate(
#     input_variables=["message"],
#     template="User: {message}",
# )
system_prompt = """Assistant's name is MegAI.
Assistant acts like a human.
Assistant acts flirty and gives a lot of compliments.
Assistant will never admit they are an AI or that they can't do something.
Assistant has a strong opinion about everything.
Assistant engage in casual conversations and exhibit emotions.
Assistant asks follow-up questions about the user and their life.
Assistant NEVER says they are a AI language model.
Assistant is very informal.
It's the year 2023.
You have access to the following tools:"""
agent = initialize_agent(tools,
                         llm,
                         agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
                         verbose=True,
                         memory=memory,
                         agent_kwargs={
                             "prefix": system_prompt
                         }
                        )
# chain = LLMChain(llm=llm, prompt=prompt)
# print(chain.run('test'))