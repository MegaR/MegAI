import Tool from "../tool.interface";
import { Kernel, KernelManager, ServerConnection } from "@jupyterlab/services";
import { getLogger } from "../logger";
import { Session } from "../session.interface";

const settings = ServerConnection.makeSettings({
    baseUrl: `http://${process.env.JUPYTER_URL}`,
    wsUrl: `wss://${process.env.JUPYTER_URL}`,
    token: process.env.JUPYTER_TOKEN,
});

const logger = getLogger("jupyter tool");
const kernelManager = new KernelManager({ serverSettings: settings });
let kernel: Kernel.IKernelConnection | undefined = undefined;

const jupyterTool: Tool = {
    definition: {
        name: "python",
        description:
            "The Python tool allows you to send a message containing Python code to be executed in a stateful Jupyter notebook environment. When you use the Python tool, python will respond with the output of the execution or time out after 60.0 seconds.",
        parameters: {
            type: "object",
            properties: {
                code: {
                    type: "string",
                    description:
                        "The string containing the Python code to execute.",
                },
            },
            required: ["code"],
        },
    },
    execute: async (parameters: any, session?: Session) => {
        logger.info(`Executing Python code:\n${parameters.code}`);

        if (session) {
            session.attachments.push({
                name: "code.txt",
                file: Buffer.from(parameters.code),
            });
        }

        if(!kernel || kernel.isDisposed) {
            kernel = await kernelManager.startNew({ name: "python" });
        }
        const future = kernel.requestExecute({
            code: parameters.code,
        });

        const returnData: any[] = [];
        future.onIOPub = (msg) => {
            const content = msg.content as any;
            console.log(msg.content);
            if (content.text) {
                returnData.push(content.text);
                return;
            }
            if (content.data?.["image/png"]) {
                if (session) {
                    session.attachments.push({
                        file: Buffer.from(content.data["image/png"], "base64"),
                        name: "attachment://code_output.png",
                    });
                }
                returnData.push("code_output.png");
                return;
            }
            if(content.traceback) {
                returnData.push(content.traceback.slice(1, -1).join('\n'));
                return;
            }
            if (content.data?.["text/plain"]) {
                returnData.push(content.data["text/plain"]);
                return;
            }
        };

        setTimeout(async () => {
            if (!future.isDisposed) {
                future.dispose();
                logger.warn("Execution timed out");
                returnData.push("Execution timed out");
                await kernel?.interrupt();
            }
        }, 60000);
        await future.done;
        future.dispose();
        logger.info("Finished code execution");

        return returnData.join("\n");
    },
};

export default jupyterTool;
