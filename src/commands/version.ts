import { declareCommand } from "../cli.js";
import { GitCommit, createGit, GifDiff, Git } from "../utils/git.js";
import {
  CommitBase as CCCommitBase,
  CommitParser as ConvetionalCommitsParser,
} from "conventional-commits-parser";
import {
  Config,
  NormalizedOptions,
  normalizeOptions,
  readConfig,
  writeConfig,
} from "../utils/config.js";
import {
  Workspace,
  WorkspacePackage,
  getWorkspace,
  savePackageConfig,
} from "../utils/workspace.js";
import logger from "../utils/logger.js";
import { SCRIPT_NAME } from "../utils/constants.js";
import { SemVer, Range } from "semver";
import {
  Bump,
  incrementPreRelease,
  isPreRelease,
  isVersion,
  resetPreRelease,
  toBump,
  toReleaseType,
} from "../utils/version.js";
import { ExecaError } from "execa";
import { relative } from "node:path";
import { renderList } from "../utils/tui.js";
import chalk from "chalk";

const DEPENDENCY_KEYS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export default declareCommand({
  command: "version",
  describe: "Version packages.",
  builder: (cli) => cli,
  handler: async (args) => {
    const cwd = process.cwd();

    const configPath = args.config;
    await logger.verbose(`Loading config from '${relative(cwd, configPath)}'.`);

    const config = await readConfig(configPath);
    await logger.debug("config:", config);

    const options = normalizeOptions(config.options);
    await logger.debug("options:", options);

    const workspace = await getWorkspace(args.workspaceDir);
    await logger.verbose(
      `Found ${workspace.packages.length} package(s) in workspace.`
    );

    const git = await createGit();
    await logger.debug("git version:", git.version.replace("git version ", ""));

    if (!config.base) {
      await logger.debug(
        "No 'base' property was set in config. Treating as first versioning ever."
      );
    }

    // Gather information about all commits since last versioning.
    const commits = await getCommitDetails({ git, config, options });

    await logger.debug(
      `${commits.length} commits since ${
        config.base ? renderCommitHash(config.base) : "ever"
      }` + (commits.length ? ":\n" + renderCommitList(commits) : ".")
    );

    // Enter/exit pre-release for all packages.
    await updatePreReleases({ workspace, config });

    // Bump the versions of each package.
    await updateVersion({ workspace, commits, options, config });

    if (options.updateWorkspaceDependencies) {
      // Update the versions of all internal dependencies.
      await updateDependencies({ workspace, options });
    }

    // Update base commit in config.
    updateBaseCommit({ config, commits });

    if (!args.dryRun) {
      // Save 'package.json' for each package.
      await savePackages({ workspace });

      // Save config to disk.
      await writeConfig(configPath, config);
    }
  },
});

interface CCCommit extends CCCommitBase {
  scope?: string;
  type?: string;
}

interface CommitDetail {
  git: GitCommit;
  cc: CCCommit;
  diff: GifDiff;
}

function updateBaseCommit({
  config,
  commits,
}: {
  config: Config;
  commits: CommitDetail[];
}) {
  if (commits.length === 0) {
    return;
  }
  config.base = commits[0]!.git.hash;
}

async function getCommitDetails({
  git,
  config,
  options,
}: {
  git: Git;
  config: Config;
  options: NormalizedOptions;
}) {
  const cParser = new ConvetionalCommitsParser({
    // ty! https://github.com/conventional-changelog/conventional-changelog/issues/648#issuecomment-704867077
    headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
    breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
  });

  const gitCommits = await git.log({
    pattern: config.base ? ["HEAD", `^${config.base}`] : [],
  });

  const commits: CommitDetail[] = [];
  for (const commit of gitCommits) {
    const cc = cParser.parse(commit.body);
    let diff: GifDiff;
    try {
      diff = await git.diff(`${commit.hash}`, `${commit.hash}~1`);
    } catch (error) {
      if (
        error instanceof ExecaError &&
        (error.stderr! as string)?.includes(
          "unknown revision or path not in the working tree"
        )
      ) {
        await logger.verbose(
          `Found first ever commit [${commit.hash.slice(0, 7)}]!`
        );
        diff = [];
      } else {
        throw error;
      }
    }

    commits.push({
      git: commit,
      cc,
      diff,
    });
  }

  if (!options.ignoreInvalidCommits) {
    const invalid = commits.filter((commit) => !commit.cc.type);
    if (invalid.length > 0) {
      await logger.warn(
        `Found ${invalid.length} invalid conventional commit summary(s):\n` +
          renderCommitList(invalid)
      );
    }
  }

  return commits;
}

function renderCommitHash(commit: CommitDetail | GitCommit | string) {
  const hash =
    typeof commit === "string"
      ? commit
      : "git" in commit
        ? commit.git.hash
        : commit.hash;
  return "[" + hash.slice(0, 7) + "]";
}

function renderCommitList(commits: CommitDetail[]) {
  return renderList(
    commits.map((commit) => renderCommitHash(commit) + " " + commit.cc.header)
  );
}

async function updatePreReleases({
  workspace,
  config,
}: {
  workspace: Workspace;
  config: Config;
}) {
  for (const pkg of workspace.packages) {
    if (config.pre?.prerelease?.includes(pkg.name)) {
      if (
        !isPreRelease(pkg.version) ||
        !pkg.config.publishConfig?.tag ||
        !Object.keys(config.pre.original ?? {}).includes(pkg.name)
      ) {
        await logger.fatal(
          `Package '${pkg.name}' is set to pre-release, but is not configured correctly. Run \`${SCRIPT_NAME} pre enter\` to fix this issue.`
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
  options,
  config,
}: {
  workspace: Workspace;
  commits: CommitDetail[];
  options: NormalizedOptions;
  config: Config;
}) {
  const pkgBumpMap = new Map<string, Bump>();

  // Sort by workspace dependencies
  workspace.packages = workspace.packages
    .slice()
    .sort((a, b) => (hasDependency(a, b.name) ? 1 : -1));

  for (const pkg of workspace.packages) {
    let bump = Bump.None;

    for (const detail of commits) {
      if (!detail.cc.type) {
        continue;
      }

      const bumpLike = options.releaseTypes[detail.cc.type];
      if (!bumpLike) {
        await logger.warn(
          `Did not recognize CC commit type "${detail.cc.type}". Add it to the 'bump' record in the config.`
        );
      }

      const currentBump = toBump(bumpLike ?? "ignore");
      if (currentBump > bump) {
        bump = currentBump;
      }
    }

    for (const dependencyKey of DEPENDENCY_KEYS) {
      const dependencies = pkg.config[dependencyKey];
      if (!dependencies) {
        continue;
      }

      for (const name of Object.keys(dependencies)) {
        // Check if internal package.
        const pkg = workspace.packages.find((pkg) => pkg.name === name)!;
        if (!pkg) {
          continue;
        }

        const theirBump = pkgBumpMap.get(name);
        if (!theirBump) {
          continue;
        }

        if (dependencyKey === "peerDependencies" && theirBump >= Bump.Minor) {
          bump = Bump.Major;
        }

        if (theirBump >= Bump.Patch) {
          bump = Math.max(bump, Bump.Patch);
        }
      }
    }

    pkgBumpMap.set(pkg.name, bump);
  }

  const updates: {
    name: string;
    oldVersion: string;
    newVersion: string;
  }[] = [];

  for (const pkg of workspace.packages) {
    let bump = pkgBumpMap.get(pkg.name) ?? Bump.None;

    let originalVersion = isPreRelease(pkg.version)
      ? config.pre?.original?.[pkg.name]
      : pkg.version;
    if (!originalVersion) {
      // This should be already caught. Just to be safe.
      throw await logger.fatal(
        `Original version for pre-release package '${pkg.name}' is not configured.`
      );
    }
    originalVersion = new SemVer(originalVersion);

    let skipMajor = originalVersion.major === 0;

    if (config.pre?.promote && Object.hasOwn(config.pre.promote, pkg.name)) {
      skipMajor = false;
      bump = toBump(config.pre.promote[pkg.name]!);
      delete config.pre.promote[pkg.name];
    }

    if (bump === Bump.None) {
      continue;
    }

    const releaseType = toReleaseType(bump, skipMajor);
    if (releaseType) {
      const currentVersion = new SemVer(pkg.version.format());
      const newVersion = originalVersion.inc(releaseType);

      if (isPreRelease(currentVersion)) {
        newVersion.prerelease = currentVersion.prerelease;
      }

      const equalStableVersion =
        currentVersion.patch === newVersion.patch &&
        currentVersion.minor === newVersion.minor &&
        currentVersion.major === newVersion.major;

      if (equalStableVersion || options.preservePreRelaseSequence) {
        incrementPreRelease(newVersion);
      } else {
        resetPreRelease(newVersion, options.initialPreReleaseVersion);
      }

      await logger.debug(
        `Increment package '${
          pkg.name
        }' version '${currentVersion.format()}' with '${releaseType}' results in '${newVersion.format()}'.`
      );

      // Set new package version.
      pkg.version = newVersion;
      pkg.config.version = newVersion.format();

      // Push update
      updates.push({
        name: pkg.name,
        oldVersion: currentVersion.format(),
        newVersion: newVersion.format(),
      });
    }
  }

  if (updates.length > 0) {
    const columns = updates
      .map((update) => [update.name.length, update.oldVersion.length] as const)
      .reduce((a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
    await logger.info(
      "Updated versions:\n" +
        renderList(
          updates.map(
            (update) =>
              (update.name + ":  ").padEnd(columns[0] + 3, " ") +
              chalk.red(update.oldVersion.padEnd(columns[1]), " ") +
              "->  " +
              chalk.green(update.newVersion)
          )
        )
    );
  } else {
    await logger.info("No updates were made!");
  }
}

function hasDependency(pkg: WorkspacePackage, name: string) {
  for (const dependencyKey of DEPENDENCY_KEYS) {
    const dependencies = pkg.config[dependencyKey];
    if (dependencies) {
      for (const key of Object.keys(dependencies)) {
        if (key === name) {
          return true;
        }
      }
    }
  }
  return false;
}

async function updateDependencies({
  workspace,
  options,
}: {
  workspace: Workspace;
  options: NormalizedOptions;
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

        if (options.onlyUpdateWorkspaceProtocol && !isWorkspaceProtocol) {
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
          if (allowsPreRelease || options.allowUpdateStableToPreRelease) {
            dependencies[name] = protocol + dependencyPackage.version.format();
          }
        } else {
          if (allowAnyMajor) {
            continue;
          }

          if (allowsPreRelease) {
            if (options.warnOutdatedPreReleaseUsage) {
              await logger.warn(
                `In '${ourPackage.configPath}', dependency "${name}" is set to a pre-release, even though a newer stable version is available.`
              );
            }
            continue;
          }

          if (isComplex && !options.allowOverrideComplexRanges) {
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
