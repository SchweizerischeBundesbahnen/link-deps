import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { readPackageUpSync } from "read-pkg-up";
import { rimrafSync } from "rimraf";
import { globby } from "globby";
import merge from "lodash-es/merge.js";
import debounce from "lodash-es/debounce.js";
import yarnOrNpm from "yarn-or-npm";
import tar from "tar";

export async function installLinkDeps() {
  const projectPkgJson = readPackageUpSync()

  const dependencies = projectPkgJson?.packageJson.linkDependencies

  if (!dependencies) {
    console.warn("[link-deps][WARN] No 'linkDependencies' specified in package.json")
    process.exit(0)
  }

  const targetDir = path.dirname(projectPkgJson?.path)

  const depNames = Object.keys(dependencies)
  for (const name of depNames) {
    const libDir = path.resolve(targetDir, dependencies[name])
    console.log(`[link-deps] Checking '${name}' in '${libDir}'`)

    const regularDep =
      (projectPkgJson?.packageJson.dependencies && projectPkgJson?.packageJson.dependencies[name]) ||
      (projectPkgJson?.packageJson.devDependencies && projectPkgJson?.packageJson.devDependencies[name])

    if (!regularDep) {
      console.warn(`[link-deps][WARN] The relative dependency '${name}' should also be added as normal- or dev-dependency`)
    }

    // Check if target dir exists
    if (!fs.existsSync(libDir)) {
      // Nope, but is the dependency mentioned as normal dependency in the package.json? Use that one
      if (regularDep) {
        console.warn(`[link-deps][WARN] Could not find target directory '${libDir}', using normally installed version ('${regularDep}') instead`)
        return
      } else {
        console.error(
          `[link-deps][ERROR] Failed to resolve dependency ${name}: failed to find target directory '${libDir}', and the library is not present as normal depenency either`
        )
        process.exit(1)
      }
    }

    const hashStore = {
      hash: "",
      file: ""
    }
    const hasChanges = await libraryHasChanged(name, libDir, targetDir, hashStore)
    if (hasChanges) {
      buildLibrary(name, libDir)
      packAndInstallLibrary(name, libDir, targetDir)
      fs.writeFileSync(hashStore.file, hashStore.hash)
      console.log(`[link-deps] Re-installing ${name}... DONE`)
    }
  }
}

export async function watchLinkDeps() {
  const projectPkgJson = readPackageUpSync()

  const dependencies = projectPkgJson?.packageJson.linkDependencies

  if (!dependencies) {
    console.warn("[link-deps][WARN] No 'linkDependencies' specified in package.json")
    process.exit(0)
  }

  Object.values(dependencies).forEach(path => {
    fs.watch(path, { recursive: true }, debounce(installLinkDeps, 500))
  });
}

async function libraryHasChanged(name, libDir, targetDir, hashStore) {
  const hashFile = path.join(targetDir, "node_modules", name, ".link-deps-hash")
  const referenceContents = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, "utf8") : ""
  // compute the hashes
  const libFiles = await findFiles(libDir, targetDir)
    const hashes = await Promise.all(libFiles.map(file => getFileHash(path.join(libDir, file))));
    const contents = libFiles.map((file, index) => hashes[index] + " " + file).join("\n")
  hashStore.file = hashFile
  hashStore.hash = contents
  if (contents === referenceContents) {
    // computed hashes still the same?
    console.log("[link-deps] No changes")
    return false
  }
  // Print which files did change
  if (referenceContents) {
    const contentsLines = contents.split("\n")
    const refLines = referenceContents.split("\n")
    for (let i = 0; i < contentsLines.length; i++)
      if (contentsLines[i] !== refLines[i]) {
        console.log("[link-deps] Changed file: " + libFiles[i]) //, contentsLines[i], refLines[i])
        break
      }
  }
  return true
}

async function findFiles(libDir, targetDir) {
  const ignore = ["**/*", "!node_modules", "!.git"]
  // TODO: use resolved paths here
  if (targetDir.indexOf(libDir) === 0) {
    // The target dir is in the lib directory, make sure that path is excluded
    ignore.push("!" + targetDir.substr(libDir.length + 1).split(path.sep)[0])
  }
  const files = await globby(ignore, {
    gitignore: true,
    cwd: libDir,
    nodir: true
  })
  return files.sort()
}

function buildLibrary(name, dir) {
  // Run install if never done before
  if (!fs.existsSync(path.join(dir, "node_modules"))) {
    console.log(`[link-deps] Running 'install' in ${dir}`)
    yarnOrNpm.spawn.sync(["install"], { cwd: dir, stdio: [0, 1, 2] })
  }

  // Run build script if present
  const libraryPkgJson = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
  if (!libraryPkgJson.name === name) {
    console.error(`[link-deps][ERROR] Mismatch in package name: found '${libraryPkgJson.name}', expected '${name}'`)
    process.exit(1)
  }
  if (libraryPkgJson.scripts && libraryPkgJson.scripts.build) {
    console.log(`[link-deps] Building ${name} in ${dir}`)
    yarnOrNpm.spawn.sync(["run", "build"], { cwd: dir, stdio: [0, 1, 2] })
  }
}

function packAndInstallLibrary(name, dir, targetDir) {
  const libDestDir = path.join(targetDir, "node_modules", name)
  let fullPackageName
  try {
    console.log("[link-deps] Copying to local node_modules")
    yarnOrNpm.spawn.sync(["pack"], { cwd: dir, stdio: [0, 1, 2] })

    if (fs.existsSync(libDestDir)) {
      // TODO: should we really remove it? Just overwritting could be fine
      rimrafSync(libDestDir)
    }
    fs.mkdirSync(libDestDir, { recursive: true })

    const tmpName = name.replace(/[\s\/]/g, "-").replace(/@/g, "")
    // npm replaces @... with at- where yarn just removes it, so we test for both files here
    const regex = new RegExp(`^(at-)?${tmpName}(.*).tgz$`)

    const packagedName = fs.readdirSync(dir).find(file => regex.test(file))
    fullPackageName = path.join(dir, packagedName)

    console.log(`[link-deps] Extracting "${fullPackageName}" to ${libDestDir}`)

    const [cwd, file] = [libDestDir, fullPackageName].map(absolutePath => 
      path.relative(process.cwd(), absolutePath)
    )

    tar.extract({
      cwd,
      file,
      gzip: true, 
      stripComponents: 1,
      sync: true
    })
  } finally {
    if (fullPackageName) {
      fs.unlinkSync(fullPackageName)
    }
  }
}

async function getFileHash(file) {
  const fileContent = fs.readFileSync(file, { encoding: 'utf-8' });
  return crypto
    .createHash('sha1')
    .update(fileContent, 'utf8')
    .digest('hex');
}

function addScriptToPackage(script) {
  let pkg = getPackageJson()
  if (!pkg.scripts) {
    pkg.scripts = {}
  }

  const msg = `[link-deps] Adding link-deps to ${script} script in package.json`

  if (!pkg.scripts[script]) {
    console.log(msg)
    pkg.scripts[script] = "link-deps"

  } else if (!pkg.scripts[script].includes("link-deps")) {
    console.log(msg)
    pkg.scripts[script] = `${pkg.scripts[script]} && link-deps`
  }
  setPackageData(pkg)
}

export function installLinkDepsPackage() {
  let pkg = getPackageJson()

  if (!(
    (pkg.devDependencies && pkg.devDependencies["link-deps"]) ||
    (pkg.dependencies && pkg.dependencies["link-deps"])
  )) {
    console.log('[link-deps] Installing link-deps package')
    yarnOrNpm.spawn.sync(["add", "-D", "link-deps"])
  }
}

function setupEmptyLinkDeps() {
  let pkg = getPackageJson()

  if (!pkg.linkDependencies) {
    console.log(`[link-deps] Setting up linkDependencies section in package.json`)
    pkg.linkDependencies = {}
    setPackageData(pkg)
  }
}

export function initLinkDeps({ script }) {
  installLinkDepsPackage()
  setupEmptyLinkDeps()
  addScriptToPackage(script)
}

export async function addLinkDeps({ paths, dev, script }) {
  initLinkDeps({ script })

  if (!paths || paths.length === 0) {
    console.log(`[link-deps][WARN] no paths provided running ${script}`)
    yarnOrNpm.spawn.sync([script])
    return
  }
  const libraries = paths.map(relPath => {
    const libPackagePath = path.resolve(process.cwd(), relPath, "package.json")
    if (!fs.existsSync(libPackagePath)) {
      console.error(
        `[link-deps][ERROR] Failed to resolve dependency ${relPath}`
      )
      process.exit(1)
    }

    const libraryPackageJson = JSON.parse(fs.readFileSync(libPackagePath, "utf-8"))

    return {
      relPath,
      name: libraryPackageJson.name,
      version: libraryPackageJson.version
    }
  })

  let pkg = getPackageJson()

  const depsKey = dev ? "devDependencies" : "dependencies"
  if (!pkg[depsKey]) pkg[depsKey] = {}

  libraries.forEach(library => {
    if (!pkg[depsKey][library.name]) {
      try {
        yarnOrNpm.spawn.sync(["add", ...[dev ? ["-D"] : []], library.name], { stdio: "ignore" })
      } catch (_e) {
        console.log(`[link-deps][WARN] Unable to fetch ${library.name} from registry. Installing as a relative dependency only.`)
      }
    }
  })

  if (!pkg.linkDependencies) pkg.linkDependencies = {}

  libraries.forEach(dependency => {
    pkg.linkDependencies[dependency.name] = dependency.relPath
  })

  setPackageData(pkg)
  await installLinkDeps()
}

function setPackageData(pkgData) {
  const source = getPackageJson()
  fs.writeFileSync(
    path.join(process.cwd(), "package.json"),
    JSON.stringify(merge(source, pkgData), null, 2)
  )
}

function getPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), "utf-8"))
}