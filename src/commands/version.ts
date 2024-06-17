import { declareCommand } from "../cli.js";
import { createGit } from "../utils/git.js";
import { Config } from "../utils/config.js";
import {
  Workspace,
  getWorkspace,
  savePackageConfig,
} from "../utils/workspace.js";
import logger from "../utils/logger.js";
import { SCRIPT_NAME } from "../utils/constants.js";
import { SemVer, Range } from "semver";
import {
  createVersioningPlan,
  isPreRelease,
  isVersion,
} from "../utils/version.js";
import { relative } from "node:path";
import {
  renderCommitHash,
  renderCommitList,
  renderVersioning,
} from "../utils/tui.js";
import { Commit, getCommits } from "../utils/commit.js";
import { DEPENDENCY_KEYS } from "../utils/dependency.js";
import chalk from "chalk";

export default declareCommand({
  command: "version",
  describe: "Version packages.",
  builder: (cli) => cli,
  handler: async (args) => {
    const cwd = process.cwd();

    const configPath = args.config;
    await logger.verbose(`Loading config from '${relative(cwd, configPath)}'.`);

    const config = await Config.read(configPath);
    await logger.debug("config:", config.raw);
    await logger.debug("options:", config.options.raw);

    const workspace = await getWorkspace({
      directory: args.workspaceDir,
      config,
    });
    await logger.verbose(
      `Found ${workspace.packages.length} package(s) in workspace.`
    );

    const git = await createGit(args.rootDir);

    const base = config.getBase();
    if (!base) {
      await logger.debug(
        "No 'base' property was set in config. Treating as first versioning ever."
      );
    }

    // Gather information about all commits since last versioning.
    const commits = await getCommits({ git, config });

    await logger.debug(
      `${commits.length} commits since ${
        base ? renderCommitHash(base) : "ever"
      }` + (commits.length ? ":\n" + renderCommitList(commits) : ".")
    );

    // Enter/exit pre-release for all packages.
    await updatePreReleases({ workspace, config });

    // Bump the versions of each package.
    await updateVersion({ workspace, commits, config });

    if (config.options.updateWorkspaceDependencies) {
      // Update the versions of all internal dependencies.
      await updateDependencies({ workspace, config });
    }

    // Update base commit in config.
    updateBaseCommit({ config, commits });

    if (!args.dryRun) {
      // Save 'package.json' for each package.
      await savePackages({ workspace });

      // Save config to disk.
      await config.save();
    }
  },
});

function updateBaseCommit({
  config,
  commits,
}: {
  config: Config;
  commits: Commit[];
}) {
  if (commits.length === 0) {
    return;
  }
  config.setBase(commits[0]!.git.hash);
}

async function updatePreReleases({
  workspace,
  config,
}: {
  workspace: Workspace;
  config: Config;
}) {
  for (const pkg of workspace.packages) {
    if (config.isPreRelease(pkg.name)) {
      const statement = `Package '${pkg.name}' is set to pre-release`;
      const hint = `Run \`${SCRIPT_NAME} pre enter\` to fix this issue.`;

      if (!isPreRelease(pkg.version)) {
        await logger.fatal(
          statement + ", but has a stable version configured." + hint
        );
      }

      if (!config.hasOriginalVersion(pkg.name)) {
        await logger.fatal(
          statement + ", but has not an original version configured. " + hint
        );
      }

      if (!pkg.config.publishConfig?.tag) {
        await logger.fatal(
          statement + ", but has not configured a release tag. " + hint
        );
      }
    } else if (isPreRelease(pkg.version)) {
      // Remove pre-release suffix.
      pkg.version.prerelease = [];
      pkg.config.version = pkg.version.format();

      await logger.info(`Exited pre-release for package '${pkg.name}'.`);
    }
  }
}

async function updateVersion({
  workspace,
  commits,
  config,
}: {
  workspace: Workspace;
  commits: Commit[];
  config: Config;
}) {
  const updates = await createVersioningPlan({ workspace, commits, config });

  // Set new package versions.
  for (const update of updates) {
    const pkg = workspace.packages.find((pkg) => pkg.name === update.name)!;
    pkg.version = new SemVer(update.newVersion);
    pkg.config.version = pkg.version.format();
  }

  if (updates.length > 0) {
    await logger.info(
      chalk.underline("Updated versions:") + "\n" + renderVersioning(updates)
    );
  } else {
    await logger.info("No updates were made!");
  }
}

async function updateDependencies({
  workspace,
  config,
}: {
  workspace: Workspace;
  config: Config;
}) {
  for (const ourPackage of workspace.packages) {
    for (const dependencyKey of DEPENDENCY_KEYS) {
      const dependencies = ourPackage.config[dependencyKey];
      if (!dependencies) {
        continue;
      }

      for (const entry of Object.entries(dependencies)) {
        const name = entry[0];
        let value = entry[1];

        // Check if internal package.
        const dependencyPackage = workspace.packages.find(
          (pkg) => pkg.name === name
        )!;
        if (!dependencyPackage) {
          continue;
        }

        // Extract range from workspace protocol.
        const isWorkspaceProtocol = value.startsWith("workspace:");
        if (isWorkspaceProtocol) {
          value = value.slice("workspace:".length);

          if (["*", "^", "~"].includes(value)) {
            continue;
          }
        }

        // Unknown protocol.
        if (value.includes(":")) {
          continue;
        }

        if (
          config.options.onlyUpdateWorkspaceProtocol &&
          !isWorkspaceProtocol
        ) {
          continue;
        }

        const range = new Range(value);

        /** If the range allows any major bump. */
        const allowAnyMajor = range.range === "";

        /** If the range consists souly of a version. */
        const onlyVersion = isVersion(range.raw);

        /** If the range consists of a version and optionally a comparator. */
        const isSimple = onlyVersion || /$[*^~]/.test(range.raw);

        /** If the range is too complex to understand. */
        const isComplex = !isSimple;

        const comparator = isSimple ? range.raw.charAt(0) : undefined;
        const protocol = isWorkspaceProtocol ? "workspace:" : "";

        /** The version specified in the range. */
        const version = onlyVersion
          ? new SemVer(range.raw)
          : isSimple
            ? new SemVer(range.raw.slice(1))
            : undefined;

        /** Wether range allows pre-release(s) or not. */
        const allowsPreRelease = version ? isPreRelease(version) : undefined;

        if (isPreRelease(dependencyPackage.version)) {
          if (
            allowsPreRelease ||
            config.options.allowUpdateStableToPreRelease
          ) {
            dependencies[name] = protocol + dependencyPackage.version.format();
          }
        } else {
          if (allowAnyMajor) {
            continue;
          }

          if (allowsPreRelease) {
            if (config.options.warnOutdatedPreReleaseUsage) {
              await logger.warn(
                `In '${ourPackage.configPath}', dependency "${name}" is set to a pre-release, even though a newer stable version is available.`
              );
            }
            continue;
          }

          if (isComplex && !config.options.allowOverrideComplexRanges) {
            continue;
          }

          dependencies[name] =
            protocol + comparator + dependencyPackage.version.format();
        }
      }
    }
  }
}

async function savePackages({ workspace }: { workspace: Workspace }) {
  for (const pkg of workspace.packages) {
    await savePackageConfig(pkg);
  }
}
