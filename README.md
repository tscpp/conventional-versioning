# Conventional Versioning

[![NPM Version](https://img.shields.io/npm/v/conventional-versioning?color=red)](https://npmjs.com/package/conventional-versioning)
[![NPM Downloads](https://img.shields.io/npm/dm/conventional-versioning?color=blue)
](https://www.npmjs.com/package/conventional-versioning)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/tscpp/conventional-versioning/checks.yml?label=checks)](https://github.com/tscpp/conventional-versioning/actions/workflows/checks.yml)

## Introduction

Conventional Versioning is a library designed to simplify the versioning of packages, particularly in larger monorepo setups. It uses [conventional commits] to detect new versions for packages automatically but also supports manual version promotion if needed. As expected, it adheres to [semantic versioning] (semver).

### Why?

Existing version managers are often complex and prone to breaking. They may not cater to simple needs effectively. This project aims to provide a simple, yet highly useful and configurable version manager. Unlike many other tools, this tool serves a single purpose - to version packages. There are already excellent tools for publishing packages, such as [Nx], [Lerna], and [np].

### How does it work?

The [conventional commit] type specified in each commit is be used to determine the version bump. Commits only affect packages which files are modified in that commit. When versioning, it picks the greatest version bump for each package and increments the versions accordingly.

Manual changes (promotions and pre-releases) are stored in the config file until the next versioning. When versioning, the changes are detected and applied.

### Features

<table>
<thead>
<tr>
<th width="33%">
Single- & monorepo
</th>
<th width="33%">
Independant versions
</th>
<th width="33%">
Pre-releases
</th>
</tr>
</thead>
<tbody>
<tr>
<td>
We support both single-package and multi-package repositories seamlessly.
</td>
<td>
Each package gets its own version and updates only when necessary.
</td>
<td>
Easily manage multiple independent pre-release versions using the interactive CLI.
</td>
</tr>
</tbody>
</table>

<table>
<thead>
<tr>
<th width="33%">
Promotions
</th>
<th width="33%">
Dependencies
</th>
<th width="33%">
Automated
</th>
</tr>
</thead>
<tbody>
<tr>
<td>
Manually promote a new version bump using the interactive CLI.
</td>
<td>
Internal dependencies within the workspace are automatically updated.
</td>
<td>
This solution requires no manual work and can be configured to handle versioning for you.
</td>
</tr>
</tbody>
</table>

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

You can find the declaration and defaults for the configuration (options) at <https://github.com/tscpp/conventional-versioning/blob/main/src/lib/options.ts>.

### Initializing a new configuration

This command will generate a new configuration file at `conver.json` for you.

```sh
npx conver init
```

### Including and excluding packages

You can specify which packages or patterns of packages to include or exclude from versioning. If the `include` field is specified, even as an empty array, all packages not matching the `include` patterns will be excluded. Additionally, you can use the `ignorePrivatePackages` option to control whether all private packages are ignored or included by default.

```jsonc
{
  "include": [
    // Include all packages under @some-scope/
    "@some-scope/*",
    // And also these packages
    "a",
    "b",
  ],
  // And exclude all packages under @other-scope/.
  "exclude": ["@other-scope/*"],
  // Also exclude all private packages.
  "ignorePrivatePackages": true,
}
```

### Specifying custom conventional commits

You can specify custom mapping from conventional commit types to the version bump like the below example.

```jsonc
{
  "bumps": {
    // Commit "addition: some features" will infer a minor bump for affected packages.
    "addition": "minor",
  },
}
```

### Linking versions between packages

There are two methods for linking packages. `linked` ensures that all major and minor versions are released together, while `fixed` ensures that all versions, including patches, are released together.

```jsonc
{
  "linked": [
    // Will release with same minor.
    ["a", "b"],
  ],
  "fixed": [
    // Will release with same patch.
    ["c", "d"],
  ],
}
```

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
  "promotions": {
+   "some-package": "major"
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
