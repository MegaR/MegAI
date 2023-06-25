import Tool from "../tool.interface";

const replyTool: Tool = {
    definition: {
        name: 'reply',
        description: 'Replies to the message',
        parameters: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    description: 'The message to reply with',
                }
            },
            required: ['message'],
        }
    },
    execute: async (parameters: any) => {
        console.log(parameters);
        return 'Reply send';
    }
};

export default replyTool;