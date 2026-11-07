import { readFile } from "node:fs/promises";
import { importCsv } from "../src/robot/affiliate";

const file = process.argv.find((a) => a.endsWith(".csv"));
if (!file) {
  console.error("Uso: npm run robot:affiliate-import -- <arquivo.csv>");
  process.exit(1);
}
const report = await importCsv(await readFile(file, "utf8"));
console.log(
  `Salvos: ${report.saved} | sem link (ignorados): ${report.skipped} | com erro: ${report.errors.length}`,
);
for (const e of report.errors) console.log(`  linha ${e.line}: ${e.error}`);
process.exit(report.errors.length ? 2 : 0);
