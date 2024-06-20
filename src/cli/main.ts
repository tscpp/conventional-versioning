#!/usr/bin/env node

import { execute } from "./cli.js";
await execute(process.argv.slice(2));
