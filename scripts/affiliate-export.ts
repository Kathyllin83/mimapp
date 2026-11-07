import { writeFile } from "node:fs/promises";
import { exportCsv } from "../src/robot/affiliate";

const out = process.argv.find((a) => a.endsWith(".csv")) ?? "ofertas-afiliados.csv";
const all = process.argv.includes("--all");
await writeFile(out, await exportCsv({ onlyWithoutLink: !all }), "utf8");
console.log(`Planilha gerada: ${out}${all ? " (todas as ofertas)" : " (ofertas sem link)"}`);
console.log(
  "Preencha a coluna seu_link_de_afiliado e importe com: npm run robot:affiliate-import -- " + out,
);
process.exit(0);
