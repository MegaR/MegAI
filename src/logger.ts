import { ILogObj, Logger } from "tslog";

export function getLogger(name: string): Logger<ILogObj> {
    return new Logger({name, prettyLogTemplate: '[{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}][{{logLevelName}}][{{name}}] '});
}