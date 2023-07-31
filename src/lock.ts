export default class Lock {
    locked = false;
    queue: Array<() => void> = [];
    acquire(): Promise<void> {
        if (!this.locked) {
            this.locked = true;
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.queue.push(resolve);
        });
    }
    release(): void {
        if (this.queue.length > 0) {
            this.queue.shift()!();
        } else {
            this.locked = false;
        }
    }
}
