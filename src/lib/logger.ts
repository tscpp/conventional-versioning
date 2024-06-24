import { Logger } from "@eliassko/logger";

export class CustomLogger extends Logger {
  throw = true;

  override fatal(text: string): never {
    this.error(text);
    if (this.throw) {
      throw new Error(text);
    } else {
      process.exit(1);
    }
  }
}

export default new CustomLogger();
