import { inspect } from "node:util";
import Pipeline from "./utils/pipeline.js";

export enum LogLevel {
  Silent = 0,
  Error,
  Warning,
  Info,
  Verbose,
  Debug,
}

export interface Log {
  text: string;
  level: LogLevel;
}

export class Logger extends Pipeline<Log> {
  exitGracefully = false;

  debug(...data: unknown[]) {
    return this.write({ text: format(data), level: LogLevel.Debug });
  }

  verbose(...data: unknown[]) {
    return this.write({ text: format(data), level: LogLevel.Verbose });
  }

  info(text: string) {
    return this.write({ text, level: LogLevel.Info });
  }

  warn(text: string) {
    return this.write({ text, level: LogLevel.Warning });
  }

  error(text: string) {
    return this.write({ text, level: LogLevel.Error });
  }

  fatal(text: string): never {
    this.error(text);

    if (this.exitGracefully) {
      process.exit(1);
    } else {
      process.stderr.write("\n");
      throw new Error(text);
    }
  }
}

function format(data: unknown[]) {
  return data
    .map((object) => (typeof object === "string" ? object : inspect(object)))
    .join(" ");
}

export const logger = new Logger();
