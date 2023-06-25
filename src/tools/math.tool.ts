import Tool from "../tool.interface";
import { evaluate } from "mathjs";

const mathTool: Tool = {
    definition: {
        name: "math",
        description: "Calculate a math expression",
        parameters: {
            type: "object",
            properties: {
                expression: {
                    type: "string",
                    description: "The math expression to calculate",
                },
            },
            required: ["expression"],
        },
    },
    execute: async (parameters: any) => {
        const result = evaluate(parameters.expression);
        return result.toString();
    },
};

export default mathTool;
