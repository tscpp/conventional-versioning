import yargs, { Argv, CommandModule } from "yargs";
import logger from "../lib/logger.js";
import isCI from "is-ci";
import { ENV_PREFIX, SCRIPT_NAME } from "./constants.js";
import init from "./commands/init.js";
import pre from "./commands/pre.js";
import promote from "./commands/promote.js";
import status from "./commands/status.js";
import version from "./commands/version.js";
import { appendFileSync, openSync } from "node:fs";
import stripAnsi from "strip-ansi";
import { Log, LogLevel, formatLog, printLog } from "@eliassko/logger";

function createCLI(argv: string[]) {
  const cli = yargs(argv);
  return cli
    .strict()
    .scriptName(SCRIPT_NAME)
    .env(ENV_PREFIX)
    .epilog(
      "* Tip! Run conver <command> --help to get more details for each command.\n" +
        `* Tip! You can also pass any flag using the environment variable prefix "${ENV_PREFIX}".`,
    )
    .wrap(Math.min(100, cli.terminalWidth()))
    .options({
      // Logging
      log: {
        type: "string",
        alias: ["l"],
        default: "info",
        description: "Set custom logging level.",
      },
      // Hiden alias
      "log-level": {
        type: "string",
        alias: ["logging"],
        hidden: true,
      },
      verbose: {
        type: "boolean",
        default: false,
        description: 'Enable verbose logging. Same as "--log verbose".',
      },
      "debug-file": {
        type: "boolean",
        default: false,
        description: "Write debug logging to 'conver.debug.log'.",
      },
      json: {
        type: "boolean",
        default: false,
        description: "Format output to json if possible.",
      },

      // Strategy
      yes: {
        type: "boolean",
        default: false,
        alias: "y",
        description: "Accept all prompts automatically.",
      },
      ci: {
        type: "boolean",
        default: isCI,
        defaultDescription: "detected",
        description: "Running in CI environment.",
      },
      dry: {
        type: "boolean",
        alias: ["dry-run"],
        default: false,
        description: "Skip writing any changes.",
      },
      force: {
        type: "boolean",
        default: false,
        description: "Force changes without protections.",
      },

      // Workspace
      config: {
        type: "string",
        alias: "c",
        default: "conver.json",
        description: "Path to config file.",
      },
      root: {
        type: "string",
        defaultDescription: "./",
        description: "Path to root directory.",
      },
    })
    .group(
      [
        //
        "help",
        "version",
      ],
      "Information",
    )
    .group(
      [
        //
        "log",
        "verbose",
        "debug-file",
        "json",
      ],
      "Logging",
    )
    .group(
      [
        //
        "yes",
        "ci",
        "dry",
        "force",
      ],
      "Strategy",
    )
    .group(
      [
        //
        "config",
        "root",
      ],
      "Workspace",
    )
    .middleware((args) => {
      cli.showHelpOnFail(false);

      const logLevel = toLogLevel(
        args.log ||
          args.logLevel ||
          (args.verbose && "verbose") ||
          (args.json && "silent") ||
          "info",
      );

      // Avoid throwing errors.
      logger.throw = false;

      // Pipe logger to console
      logger.onLog((log) => printLog(formatLog(log)), logLevel);

      // Pipe logger to debug log
      if (args.debugFile) {
        const writeLog = createLogWriter("conver.debug.log");

        logger.onLog((log) => writeLog(uncolorizeLog(formatLog(log))));
      }

      if (args.force) {
        logger.warn(
          "Skipping checks since '--force' flag was passed. This may be destructive!",
        );
      }

      if (args.dry) {
        logger.warn("No changes will be made since '--dry' flag was passed.");
      }
    })
    .demandCommand();
}

export async function execute(argv: string[]) {
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
  commandModule: CommandModule<CLI, T>,
): CommandModule<CLI, T> {
  return commandModule;
}

function toLogLevel(value: string): LogLevel {
  switch (value) {
    case "silent":
    case "quiet":
      return LogLevel.Silent;

    case "error":
    case "err":
      return LogLevel.Error;

    case "warning":
    case "warn":
      return LogLevel.Warning;

    case "info":
    case "normal":
    case "default":
      return LogLevel.Info;

    case "verbose":
      return LogLevel.Verbose;

    case "debug":
    case "trace":
      return LogLevel.Debug;

    default:
      return LogLevel.Info;
  }
}

function uncolorizeLog(log: Log): Log {
  const text = stripAnsi(log.text);
  return {
    ...log,
    text,
  };
}

function createLogWriter(path: string) {
  const fd = openSync(path, "w");

  return (log: Log): void => {
    appendFileSync(fd, log.text + "\n");
  };
}
