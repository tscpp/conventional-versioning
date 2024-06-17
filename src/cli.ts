import yargs, { Argv, CommandModule } from "yargs";
import logger, {
  LogConsoleWriter,
  LogFileWriter,
  LogFormatter,
  LogLevel,
  LogUncolorize,
  toLogLevel,
} from "./utils/logger.js";
import isCI from "is-ci";
import { ENV_PREFIX, SCRIPT_NAME } from "./utils/constants.js";
import pre from "./commands/pre.js";
import promote from "./commands/promote.js";
import version from "./commands/version.js";
import init from "./commands/init.js";
import status from "./commands/status.js";

function createCLI(argv: string[]) {
  const cli = yargs(argv) //
    .strict()
    .scriptName(SCRIPT_NAME)
    .env(ENV_PREFIX)
    .epilog(
      `Tip! You can also pass any flag using the environment variable prefix "${ENV_PREFIX}" and screaming snake case.`
    )
    .options({
      logLevel: {
        type: "string",
        alias: "l",
        default: "info",
      },
      verbose: {
        type: "boolean",
        default: false,
      },
      debug: {
        type: "boolean",
        default: false,
      },
      workspaceDir: {
        type: "string",
        alias: "w",
        default: "./",
      },
      rootDir: {
        type: "string",
        default: "./",
      },
      config: {
        type: "string",
        alias: "c",
        default: "conver.json",
      },
      ci: {
        type: "boolean",
        default: isCI,
        defaultDescription: "detected",
      },
      dryRun: {
        type: "boolean",
        alias: ["dry"],
        default: false,
      },
      force: {
        type: "boolean",
        default: false,
      },
    })
    .middleware(async (args) => {
      cli.showHelpOnFail(false);

      const logLevel = toLogLevel(
        args.logLevel || (args.verbose && "verbose") || "info"
      );

      // Pipe logger to console
      void logger
        .createReadableStream()
        .pipeThrough(new LogFormatter({ colorize: true }))
        .pipeTo(new LogConsoleWriter(logLevel));

      // Pipe logger to debug log
      if (args.debug) {
        void logger
          .createReadableStream()
          .pipeThrough(new LogUncolorize())
          .pipeThrough(new LogFormatter({ colorize: false }))
          .pipeTo(new LogFileWriter("ko.debug.log", LogLevel.Debug));
      }

      if (args.force) {
        await logger.warn(
          "Skipping checks since '--force' flag was passed. This may be destructive!"
        );
      }

      if (args.dryRun) {
        await logger.warn(
          "No changes will be made since '--dry-run' flag was passed."
        );
      }
    })
    .demandCommand();
  return cli;
}

export default async function run(argv: string[]) {
  const cli = createCLI(argv);
  injectCommands(cli);
  await cli.parse();
}

function injectCommands(cli: ReturnType<typeof createCLI>) {
  cli.command(init);
  cli.command(pre);
  cli.command(promote);
  cli.command(status);
  cli.command(version);
}

type CLI = ReturnType<typeof createCLI> extends Argv<infer T> ? T : never;

export function declareCommand<T>(
  commandModule: CommandModule<CLI, T>
): CommandModule<CLI, T> {
  return commandModule;
}
