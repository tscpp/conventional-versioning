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

const commandModules = [
  import("./commands/pre.js"),
  import("./commands/promote.js"),
  import("./commands/version.js"),
];

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
      config: {
        type: "string",
        alias: "c",
        default: "version.json",
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
    .middleware((args) => {
      cli.showHelpOnFail(false);

      const logLevel = toLogLevel(
        args.logLevel || (args.verbose && "verbose") || "info"
      );

      // Pipe logger to console
      logger //
        .createReadableStream()
        .pipeThrough(new LogFormatter({ colorize: true }))
        .pipeTo(new LogConsoleWriter(logLevel));

      // Pipe logger to debug log
      if (args.debug) {
        logger
          .createReadableStream()
          .pipeThrough(new LogUncolorize())
          .pipeThrough(new LogFormatter({ colorize: false }))
          .pipeTo(new LogFileWriter("ko.debug.log", LogLevel.Debug));
      }

      if (args.force) {
        logger.warn(
          "Skipping checks since '--force' flag was passed. This may be destructive!"
        );
      }

      if (args.dryRun) {
        logger.warn(
          "No changes will be made since '--dry-run' flag was passed."
        );
      }
    })
    .demandCommand();
  return cli;
}

export default async function (argv: string[]) {
  const cli = createCLI(argv);
  await injectCommands(cli);
  await cli.parse();
}

async function injectCommands(cli: ReturnType<typeof createCLI>) {
  const awaitedModules = await Promise.all(commandModules);

  for (const module of awaitedModules) {
    cli.command(module.default as CommandModule<any, any>);
  }
}

type CLI = ReturnType<typeof createCLI> extends Argv<infer T> ? T : never;

export function declareCommand<T>(
  commandModule: CommandModule<CLI, T>
): CommandModule<CLI, T> {
  return commandModule;
}
