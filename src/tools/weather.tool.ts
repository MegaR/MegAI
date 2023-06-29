import axios from "axios";
import { Session } from "../session.interface";
import Tool from "../tool.interface";

const weatherTool: Tool = {
    definition: {
        name: "weather",
        description: "Get the current weather for a given location",
        parameters: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "Location to get the weather for",
                },
            },
            required: ["location"],
        },
    },
    execute: async (parameters: any, session: Session) => {
        const apiKey = process.env.OPENWEATHERMAP_API_KEY;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${parameters.location}&appid=${apiKey}`;
        const response = await axios.get(url);
        const weatherData = response.data;
        const temperature = Math.round(weatherData.main.temp - 273.15);
        const description = weatherData.weather[0].description;
        return `The weather in ${parameters.location} is ${temperature}°C and ${description}.`;
    },
};

export default weatherTool;
