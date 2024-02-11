import { getLogger } from "./logger";

const log = getLogger("utils");

export async function retry<T>(
    func: () => Promise<T>,
    max: number
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < max; i++) {
        try {
            return await func();
        } catch (e) {
            lastError = e;
            log.error(`Try ${i + 1}`, e);
        }
    }
    throw new Error(`Failed ${max} times`);
}
