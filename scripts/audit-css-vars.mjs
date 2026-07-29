#!/usr/bin/env node
/**
 * audit-css-vars.mjs — the read-vs-written CSS variable audit
 * (docs/PACKAGE-DESIGN.md / REVIEW-FINDINGS.md, "the mechanical audit that
 * finds four of these").
 *
 * Any --disc-sheet-* variable that styles.module.css READS via var(...) must
 * be either WRITTEN by the package (a .setProperty("--disc-sheet-...") call
 * or a `["--disc-sheet-..." as string]:` inline-style key somewhere in src/)
 * or DOCUMENTED as a consumer-set token (a `--disc-sheet-...` row in the
 * README's theming table). A var that is neither is a dead prop — this is
 * the exact mechanism that found B1/B3/M1/M2 (styles.module.css read them,
 * nothing wrote them, and two of them weren't even documented at the time).
 *
 * Exit 0 and print a clean report if every read var is covered. Exit 1 and
 * list the orphans otherwise.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VAR_RE = /--disc-sheet-[a-zA-Z0-9-]+/g;

function uniqueMatches(text, re) {
  return new Set(text.match(re) ?? []);
}

function readSrcFiles(dir, exts) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...readSrcFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

// 1. Vars styles.module.css READS, i.e. appear inside a var(...) call.
const cssPath = join(ROOT, "src/styles.module.css");
const css = readFileSync(cssPath, "utf8");
const varCallRe = /var\(\s*(--disc-sheet-[a-zA-Z0-9-]+)/g;
const readVars = new Set();
for (const m of css.matchAll(varCallRe)) readVars.add(m[1]);

// 2. Vars the package WRITES: any --disc-sheet-* identifier that appears as
// a .setProperty(...) target or an inline-style object key in src/ TS/TSX.
const srcFiles = readSrcFiles(join(ROOT, "src"), [".ts", ".tsx"]);
const writtenVars = new Set();
const setPropertyRe = /\.setProperty\(\s*["'](--disc-sheet-[a-zA-Z0-9-]+)["']/g;
const inlineStyleKeyRe = /\[\s*["'](--disc-sheet-[a-zA-Z0-9-]+)["']\s*as string\s*\]/g;
for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(setPropertyRe)) writtenVars.add(m[1]);
  for (const m of text.matchAll(inlineStyleKeyRe)) writtenVars.add(m[1]);
}

// 3. Vars the README DOCUMENTS as consumer-set tokens: any `--disc-sheet-*`
// inside a markdown table cell (backtick-quoted).
const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const documentedVars = uniqueMatches(readme, VAR_RE);

const orphans = [...readVars].filter(
  (v) => !writtenVars.has(v) && !documentedVars.has(v),
);

console.log(`Read by CSS (var(...)):     ${readVars.size}`);
console.log(`Written by package (JS/TS): ${writtenVars.size}`);
console.log(`Documented (README table):  ${documentedVars.size}`);
console.log("");

if (orphans.length > 0) {
  console.error("FAIL — CSS reads a variable that is neither written nor documented:");
  for (const v of orphans.sort()) console.error(`  ${v}`);
  process.exit(1);
}

console.log("PASS — every --disc-sheet-* variable styles.module.css reads is either");
console.log("written by the package or documented as a consumer token.");
console.log("");
console.log("Read vars:");
for (const v of [...readVars].sort()) console.log(`  ${v}`);
