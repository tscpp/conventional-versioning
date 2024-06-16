# Convetional Versioning

## Introduction

Conventional Versioning is a library designed to simplify the versioning of packages, particularly in larger monorepo setups. It uses [conventional commits] to detect new versions for packages automatically but also supports manual version promotion if needed. As expected, it adheres to [semantic versioning] (semver).

### Why?

Existing version managers are often complex and prone to breaking. They may not cater to simple needs effectively. This project aims to provide a simple, yet highly useful and configurable version manager. Unlike many other tools, this tool serves a single purpose - to version packages. There are already excellent tools for publishing packages, such as [Nx], [Lerna], and [np].

### Features

- **Simplified Version Management**: Easily manage the versioning of your packages.
- **Version Synchronization**: Link and fix versions between related packages.
- **Monorepo Support**: Seamlessly handle multiple packages within monorepos.
- **Pre-releases**: Create and manage individual pre-releases for your packages.
- **Manual Version Promotion**: Manually promote specific packages to new versions.
- **Dependency Updates**: Automatically update the versions of dependent packages.
- **Automated Version Detection**: Use conventional commits to automatically detect and set new versions.
- **High Configurability**: Customize the tool to fit various workflows and requirements.

## Usage

### Installation

```sh
# Pick the correct line for your package manager :)
npm install --save-dev conventional-versioning
pnpm add --save-dev conventional-versioning
yarn add --dev conventional-versioning
bun add --save-dev conventional-versioning
```

### Configuration

This command will generate a new configuration file at `conver.json` for you.

```sh
conver init
```

#### Options

- **updateWorkspaceDependencies**: Update the versions of dependencies within internal packages. Default: `true`.
- **onlyUpdateWorkspaceProtocol**: Restrict version updates to those using the workspace protocol. Default: `false`.
- **allowOverrideComplexRanges**: Override complex version ranges with the new version when the specified range cannot be detected. Default: `false`.
- **allowUpdateStableToPreRelease**: Allow updating the version of internal dependencies to a pre-release when a stable version was previously specified. Default: `false`.
- **warnOutdatedPreReleaseUsage**: Issue a warning when pre-releases are used while newer stable releases exist for internal dependencies. Default: `true`.
- **ignoreInvalidCommits**: Choose whether to warn when a commit message does not follow the conventional commits specification. Pre-commit hooks are recommended for enforcing conventional commits. Default: `false`.
- **initialPreReleaseVersion**: Set the initial version of the pre-release identifier. For example, specify `1` to start with `-beta.1` instead of `-beta.0`. Default: `0`.
- **preservePreReleaseSequence**: Preserve the sequence (version) of the pre-release identifier when bumping the version. Default: `false`.
- **releaseTypes**: Map conventional commit types (fix, feat, chore, etc.) to version bumps (patch, minor, or major).

### Versioning

This command will version all packages in the workspace.

```sh
conver version
```

### Manual Promotion

To manually promote packages and specify their version bumps, use the following command. This command will add the selected packages to "promotion" in the configuration file, affecting their versions in the next versioning.

```sh
conver promote
```

### Pre-releases:

To begin using pre-releases, execute the following command. You can specify which packages to include along with their pre-release identifier and tag.

```sh
conver pre enter
```

To discontinue pre-releases and revert to stable versioning, use the following command.

```sh
conver pre exit
```

## License

This project is licensed under the [MIT License](./LICENSE).

## Versioning

This project adheres to the [semantic versioning] (semver) specification for versioning.

[conventional commits]: https://www.conventionalcommits.org/en/v1.0.0/
[semantic versioning]: https://semver.org/spec/v2.0.0.html
[Nx]: https://nx.dev/
[Lerna]: https://lerna.js.org/
[np]: https://github.com/sindresorhus/np
