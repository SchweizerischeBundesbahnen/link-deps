# link-deps

_Installs dependencies from a local checkout, and keeps them in sync, without the limitations of `link`_

# Summary

Based on a fork of [relative-deps](https://github.com/mweststrate/relative-deps) by Michel Weststrate.

`link-deps` introduces an additional dependency section in `package.json`, called `linkDependencies`.
This section contains paths to the local sources of any dependency, that will be built and installed over the publicly available versions, when needed.

Example `package.json`:

```json
{
  "name": "my-project",
  "dependencies": {
    "my-cool-library": "0.1.0"
  },
  "linkDependencies": {
    "my-cool-library": "../../packages/my-cool-library"
  },
  "scripts": {
    "prepare": "link-deps"
  },
  "devDependencies": {
    "link-deps": "^1.0.0"
  }
}
```

When the relative path can be found, the library at this path will be re-built and re-installed into this project, if the source files have been changed during `prepare`.

The normal `my-cool-library` dependency will be defaulted to, for those that don't have a local checkout of `my-cool-library`, and to resolve transitive dependencies.

An example setup, where examples project are linked to their hosting library, can be found [here](https://github.com/mobxjs/mst-gql/pull/40/commits/4d2c0858f8c44a562c0244466b56f79b0ed7591b).

# Why

### The problem

Working on libraries that have examples embedded in the same git repository is usually tricky, as the examples are usually built against the public, published version of the library; the version that is mentioned in their `package.json`.

When working maintaining a project though, it is much more useful to work against the locally checked out version of the library. Published or not.

### The problems with existing solutions

There are a few existing solutions, but they have their own limitations:

- `yarn link` / `npm link`. These work only if there are no peer / shared dependencies involved. If there are shared dependencies, the linked library will resolve those in their _own_ `node_modules`, instead of the `node_modules` of the hosting project, where it would normally be looked up. This results in peer dependencies ending up "twice" in the dependency tree, which often causes confusing behavior.
- `yarn workspaces`. Those solve the above issue by putting all dependencies in one large root level `node_modules`. However, this setup is in practice quite obtrusive to the whole development setup.

### How is `link-deps` different?

`link-deps` doesn't fight the problem but tries to emulate a "normal" install. It builds the "linked" library on `prepare` (that is, after installing all deps), packs it, and unpacks it in the `node_modules` of the hosting project. Since there is no linking, or shared `node_modules` involved, the folder structure ends up to be exactly the same as if the thing was installed directly from `yarn` / `npm`. Which avoids a plethora of problems.

Since building a linked package every time `yarn install` is run is expensive, this tool will take a hash of the directory contents of the library first, and only build and install if something changed.

# Usage

## Installation

```bash
npx link-deps init
```

Options:

- `--script`

Alias `-S`. Default: `prepare`. Script name which is using for running `link-deps`.

Running this script will install `link-deps`, add script and initialize empty `linkDependencies` section.

```json
{
  "name": "my-project",
  "devDependencies": {
    "link-deps": "^1.0.0"
  },
  "linkDependencies": {},
  "scripts": {
    "prepare": "link-deps"
  }
}
```

Optionally, you can add this step also for more scripts, for example before starting or building your project, for example:

```json
{
  "name": "my-project",
  "scripts": {
    "prepare": "link-deps",
    "prestart": "link-deps",
    "prebuild": "link-deps",
    "pretest": "link-deps"
  }
}
```

In general, this doesn't add to much overhead, since usually `link-deps` is able to determine rather quickly (~0.5 sec) that there are no changes.

## Adding a relative dependency

Running following script will initialize `link-deps` if not initialized yet, find the package at the provided path, install it as normal dependency and pack relative dependency.

```bash
npx link-deps add ../../packages/my-cool-library
```

Options:

- `--dev`

Alias `-D`. Installs relative dependency in `devDependencies` section.

```json
{
  "name": "my-project",
  "dependencies": {
    "my-cool-library": "0.1.0"
  },
  "linkDependencies": {
    "my-cool-library": "../../packages/my-cool-library"
  },
  "scripts": {
    "prepare": "link-deps"
  },
  "devDependencies": {
    "link-deps": "^1.0.0"
  }
}
```

## Run `npx link-deps` when devving!

The relative dependency will automatically be checked for changes, based on the hooks you've set up during [installation](#installation).

However, you can always trigger a manual check-and-build-if-needed by running `npx link-deps` (or just `yarn`). If you are working on a project that supports
hot reloading, this will makes sure the changes in the relative dependency will automatically show up in your project!

## Watch mode

You can run `link-deps watch` and it'll run `link-deps` command when one of the relative dependencies changed, debounced with 500ms.
This can go along with config of your project to watch over the relevant packages and it will automate the process completely,
allowing you to change a library code and to enjoy the benefit of hot-reload.

# How

Roughly, it works like this (obviously this can get out of date quickly):

```
- pre: yarn.lock exists or die
- read linkDependencies from nearest package.json
- doesn't exist? warn & exit
- for each relative dependency:
- check if target path exists
  - if not, do we have the module from normal install?
  - yes: warn
  - no: error
- if target path exists, does it have node modules?
  - no: run yarn / npm install (guess which one)
- find last modified timestamp of all files in target dir
  (excluding node_modules, .git, excluding the directory that contains the calling project if applicable, only use git versioned files)
- take hash and store / compare with stored
- if changed:
  - run yarn / npm build
  - run pack
  - extract package (mind scoped package names!)
  - run yarn install --no-dev-deps in target dir
- done
```

# Tips

Tip: use the `postinstall` hook wherever applicable, if your dependency manager does not support `prepare` hooks yet.
