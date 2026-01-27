#!/usr/bin/env node
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import { initLinkDeps, installLinkDeps, watchLinkDeps, addLinkDeps } from "./index.js";

yargs()
  .usage("Usage: $0 <command> [options]")
  .command({
    command: "*",
    describe: "Install linked deps",
    handler: installLinkDeps
  })
  .command({
    command: "watch",
    describe: "Watch linked deps and install on change",
    handler: watchLinkDeps
  })
  .command({
    command: "init",
    describe: "Initialize link-deps",
    handler: initLinkDeps
  })
  .command({
    command: "add [paths...]",
    describe: "Add path as linked dependencies",
    handler: addLinkDeps
  })
  .option("D", {
    alias: ["dev", "save-dev"],
    description: "Save as dev dependency",
    default: false,
    type: "boolean"
  })
  .option("S", {
    alias: ["script"],
    description: "Script for link-deps",
    default: "prepare",
    type: "string"
  })
  .help()
  .parse(hideBin(process.argv));
