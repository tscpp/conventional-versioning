import yargs, { Argv, CommandModule } from "yargs";
import { logger, LogLevel, Log } from "../lib/logger.js";
import isCI from "is-ci";
import { ENV_PREFIX, SCRIPT_NAME } from "./constants.js";
import init from "./commands/init.js";
import pre from "./commands/pre.js";
import promote from "./commands/promote.js";
import status from "./commands/status.js";
import version from "./commands/version.js";
import { appendFileSync, openSync } from "node:fs";
import { Chalk, supportsColor } from "chalk";
import stripAnsi from "strip-ansi";

function createCLI(argv: string[]) {
  const cli = yargs(argv);
  return cli
    .strict()
    .scriptName(SCRIPT_NAME)
    .env(ENV_PREFIX)
    .epilog(
      "* Tip! Run conver <command> --help to get more details for each command.\n" +
        `* Tip! You can also pass any flag using the environment variable prefix "${ENV_PREFIX}".`
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
      "Information"
    )
    .group(
      [
        //
        "log",
        "verbose",
        "debug-file",
      ],
      "Logging"
    )
    .group(
      [
        //
        "yes",
        "ci",
        "dry",
        "force",
      ],
      "Strategy"
    )
    .group(
      [
        //
        "config",
        "root",
      ],
      "Workspace"
    )
    .middleware((args) => {
      cli.showHelpOnFail(false);

      const logLevel = toLogLevel(
        args.log || args.logLevel || (args.verbose && "verbose") || "info"
      );

      // Avoid throwing errors.
      logger.exitGracefully = true;

      // Pipe logger to console
      logger
        .clone()
        .pipe(createLogFormatter({ colorize: true }))
        .pipe(createLogWriter(logLevel));

      // Pipe logger to debug log
      if (args.debugFile) {
        logger
          .clone()
          .pipe(createLogFormatter())
          .pipe(createLogUncolorizer())
          .pipe(createLogFileWriter("conver.debug.log", LogLevel.Debug));
      }

      if (args.force) {
        logger.warn(
          "Skipping checks since '--force' flag was passed. This may be destructive!"
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
  commandModule: CommandModule<CLI, T>
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

interface FormatLogOptions {
  colorize?: boolean | undefined;
}

function createLogFormatter(options?: FormatLogOptions) {
  return (log: Log): Log => {
    const chalk = new Chalk({
      level: options?.colorize && supportsColor ? supportsColor.level : 0,
    });

    let text = log.text;

    switch (log.level) {
      case LogLevel.Debug:
        text = chalk.dim(applyLinePrefix(text, "[DBUG] "));
        break;

      case LogLevel.Verbose:
        text = chalk.dim(applyLinePrefix(text, "[VERB] "));
        break;

      case LogLevel.Info:
        text = applyLinePrefix(text, chalk.blue("[INFO] "));
        break;

      case LogLevel.Warning:
        text = applyLinePrefix(text, chalk.yellow("[WARN] "));
        break;

      case LogLevel.Error:
        text = applyLinePrefix(text, chalk.red("[ERR!] "));
        break;
    }

    return {
      ...log,
      text,
    };
  };

  function applyLinePrefix(text: string, prefix: string) {
    return text
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
  }
}

function createLogUncolorizer() {
  return (log: Log): Log => {
    const text = stripAnsi(log.text);
    return {
      ...log,
      text,
    };
  };
}

function createLogFileWriter(path: string, level: LogLevel) {
  const fd = openSync(path, "w");

  return (log: Log): void => {
    if (log.level > level) {
      return;
    }

    appendFileSync(fd, log.text + "\n");
  };
}

function createLogWriter(level: LogLevel) {
  return (log: Log): void => {
    if (log.level > level) {
      return;
    }

    const stream =
      log.level <= LogLevel.Warning ? process.stderr : process.stdout;
    stream.write(log.text + "\n");
  };
}
