import { Session } from "../session.interface";
import Tool from "../tool.interface";

const sayTool: Tool = {
    definition: {
        name: "say",
        description: "Say something without finalizing the message",
        parameters: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "Message to say to the user",
                },
            },
            required: ["message"],
        },
    },
    execute: async (parameters: any, session: Session) => {
        session.responses.push(parameters.message);
        return 'message sent';
    },
};

export default sayTool;
