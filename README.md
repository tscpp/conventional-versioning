# Conventional Versioning

[![NPM Version](https://img.shields.io/npm/v/conventional-versioning)](https://npmjs.com/package/conventional-versioning)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/tscpp/conventional-versioning/checks.yml)

## Experimental!

This package is still under development, so bugs may be encountered and crucial features might be missing. Use it solely for testing the library at this stage. For more details, see [tscpp/conventional-versioning#1](https://github.com/tscpp/conventional-versioning/issues/1).

The semantic versioning specification allows this library to introduce **breaking changes in any release** during the `0.x` major version.

## Introduction

Conventional Versioning is a library designed to simplify the versioning of packages, particularly in larger monorepo setups. It uses [conventional commits] to detect new versions for packages automatically but also supports manual version promotion if needed. As expected, it adheres to [semantic versioning] (semver).

### Why?

Existing version managers are often complex and prone to breaking. They may not cater to simple needs effectively. This project aims to provide a simple, yet highly useful and configurable version manager. Unlike many other tools, this tool serves a single purpose - to version packages. There are already excellent tools for publishing packages, such as [Nx], [Lerna], and [np].

### How does it work?

The [conventional commit] type specified in each commit is be used to determine the version bump. Commits only affect packages which files are modified in that commit. When versioning, it picks the greatest version bump for each package and increments the versions accordingly.

Manual changes (promotions and pre-releases) are stored in the config file until the next versioning. When versioning, the changes are detected and applied.

### Features

- **Simplified Version Management**: Easily manage the versioning of your packages.
- **Version Synchronization**: Link and fix versions between related packages.
- **Monorepo Support**: Seamlessly handle multiple packages within monorepos.
- **Pre-releases**: Create and manage individual pre-releases for your packages.
- **Manual Version Promotion**: Manually promote specific packages to new versions.
- **Dependency Updates**: Automatically update the versions of dependent packages.
- **Automated Version Detection**: Use conventional commits to automatically detect and set new versions.
- **High Configurability**: Customize the tool to fit various workflows and requirements.

## Installation

### Prerequisites

- [Node] version 20 or greater.

### Command

```sh
# Pick the correct line for your package manager :)
npm install --save-dev conventional-versioning
pnpm add --save-dev conventional-versioning
yarn add --dev conventional-versioning
bun add --save-dev conventional-versioning
```

## Configuration

This command will generate a new configuration file at `conver.json` for you.

```sh
npx conver init
```

### Linking verions

There are two methods for linking packages. `linked` ensures that all major and minor versions are released together, while `fixed` ensures that all versions, including patches, are released together.

```json
{
  "options": {
    "linked": [
      //
      ["a", "b"]
    ],
    "fixed": [
      //
      ["c", "d"]
    ]
  }
}
```

### Including and excluding packages

You can specify which packages or patterns of packages to include or exclude from versioning. If the `include` field is specified, even as an empty array, all packages not matching the `include` patterns will be excluded. Additionally, you can use the `ignorePrivatePackages` option to control whether all private packages are ignored or included by default.

```json
{
  "options": {
    "include": [
      // Include all packages under @some-scope/
      "@some-scope/*",
      // And also these packages
      "a",
      "b"
    ],
    // And exclude all packages under @other-scope/.
    "exclude": ["@other-scope/*"],
    // Also exclude all private packages.
    "ignorePrivatePackages": true
  }
}
```

### Specifying custom conventional commits

```json
{
  "options": {
    "releaseTypes": {
      // Commit "addition: some features" will infer a minor bump for affected packages.
      "addition": "minor"
    }
  }
}
```

### Options

- **onlyUpdateWorkspaceProtocol**: Restrict version updates to those using the workspace protocol. Default: `false`.

- **allowOverrideComplexRanges**: Override complex version ranges with the new version when the specified range cannot be detected. Default: `false`.

- **allowUpdateStableToPreRelease**: Allow updating the version of internal dependencies to a pre-release when a stable version was previously specified. Default: `false`.

- **warnOutdatedPreReleaseUsage**: Issue a warning when pre-releases are used while newer stable releases exist for internal dependencies. Default: `true`.

- **ignoreInvalidCommits**: Choose whether to warn when a commit message does not follow the conventional commits specification. Pre-commit hooks are recommended for enforcing conventional commits. Default: `false`.

- **initialPreReleaseVersion**: Set the initial version of the pre-release identifier. For example, specify `1` to start with `-beta.1` instead of `-beta.0`. Default: `0`.

- **preservePreReleaseSequence**: Preserve the sequence (version) of the pre-release identifier when bumping the version. Default: `false`.

- **ignorePrivatePackages**: Whether to ignore or include all private packages by default. Default: `true`.

## Usage

### Commits

Commits should adhear to the [conventional commits] specification. As covered in [how it works](#how-does-it-work), the type specified in the commit will provoke a certain version bump.

```
feat: implement some new feature
^ 'feat' type provokes a 'minor' bump
```

All types specified by [@commitlint/config-conventional](https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional) (based on the [Angular convention](https://github.com/angular/angular/blob/22b96b9/CONTRIBUTING.md#-commit-message-guidelines)) are defined by default. You can also choose [define custom types](#specifying-custom-conventional-commits).

Conventional Versioning will not enforce the valid conventional commit messages. We recommend enforcing the specification using [commitlint]. See their [local setup guide](https://commitlint.js.org/guides/local-setup.html).

### Pre-releases

Pre-releases are, by the [semantic versioning] specification, a version with a pre-release suffix. These versions are great when you have surpassed the `0.x` major version and need to deploy release candidates.

```
1.2.3-rc.2
```

#### Enter pre-release

To begin using pre-releases, execute the following command. You can specify which packages to include along with their pre-release identifier and tag.

```sh
npx conver pre enter
```

This will add the pre-release version to the package and kept in the config for reference. Make sure to commit the generated changes!

#### Exit pre-release

Later, when you want to discontinue pre-releases and revert to stable versioning, use the following command.

```sh
npx conver pre exit
```

Make sure to commit the generated changes!

### Manual promotion

Manaual promotions are manually specified versions bumps that apply on the next versioning. These are great when you want to exit `0.x` major versions, have invalid commit history, or just feel like bumping a version.

To manually promote packages and specify their version bumps, use the following command. This command will add the selected packages to "promotion" in the configuration file, affecting their versions in the next versioning.

```sh
npx conver promote
```

This will add the package to the `pre.promote` field in the config. If you need to revert the promote, revert this change. Make sure to commit the generated changes!

```diff
{
  "pre": {
    "promote": {
+     "some-package": "major"
    }
  }
}
```

### Versioning status

This command will show the current versioning status. This includes which packages are affected and their version bumps, what packages are manually promoted, and which packages are in pre-release. Review this to make sure everything is in order.

```sh
npx conver status
```

### Comitting the versioning

Once you have reviwed the [versioning status](#versioning-status), run the below command. It will bump the versions for all packages and their internal dependencies.

```sh
npx conver version
```

> Tip! Run with the `--dry` flag to test the command without making any actual changes.

### Continuous integration (CI)

The CLI will automatically detect common CI platforms, and when TTY is not available. However, you can also choose to specify the `--ci` flag or `CONVER_CI=true` environment variable. In CI mode, the CLI will never prompt any questions and requires all options to be passed via flags or environment variables instead.

## FAQ

**Q: Why is a minor bump in my dependency causing a major bump in the parent package?**

A: Due to the nature of peer dependencies, even a minor version increase in one can lead to a breaking change. Consequently, any such update will provoke a major version increment in the parent package. See [discussion #2](https://github.com/tscpp/conventional-versioning/discussions/2) for detailed explanation.

## Questions

Feel free to drop any questions in a new [discussion](https://github.com/tscpp/conventional-versioning/discussions) in the repository.

## License

This project is licensed under the [MIT License](./LICENSE).

## Versioning

This project adheres to the [semantic versioning] (semver) specification for versioning.

[conventional commit]: https://www.conventionalcommits.org/en/v1.0.0/
[conventional commits]: https://www.conventionalcommits.org/en/v1.0.0/
[semantic versioning]: https://semver.org/spec/v2.0.0.html
[Nx]: https://nx.dev/
[Lerna]: https://lerna.js.org/
[np]: https://github.com/sindresorhus/np
[Node]: https://nodejs.org/
[commitlint]: https://github.com/conventional-changelog/commitlint
