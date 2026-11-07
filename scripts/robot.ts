import { pechinchou } from "../src/robot/connectors/pechinchou";
import { promobit } from "../src/robot/connectors/promobit";
import { PoliteClient } from "../src/robot/http";
import { intervalMinutes, runSource } from "../src/robot/runner";
import { pgStore } from "../src/robot/store";

const loop = process.argv.includes("--loop");
const onlyArg = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];
const connectors = [promobit, pechinchou].filter((c) => !onlyArg || c.id === onlyArg);
const client = new PoliteClient();
const interval = intervalMinutes();
console.log(`User-Agent: ${client.userAgent}`);

// Ao parar (Ctrl+C / kill), libera o lock das fontes para a próxima execução não ficar presa.
let stopping = false;
async function releaseAndExit() {
  if (stopping) return;
  stopping = true;
  for (const c of connectors) await pgStore.saveHealth({ source: c.id, runningSince: null });
  process.exit(0);
}
process.on("SIGINT", () => void releaseAndExit());
process.on("SIGTERM", () => void releaseAndExit());

async function once() {
  for (const c of connectors) {
    const r = await runSource(c, client, pgStore, {
      intervalMin: interval,
      log: (m) => console.log(m),
    });
    console.log(JSON.stringify(r));
  }
}
await once();
while (loop) {
  console.log(`Próxima varredura em ${interval} min (Ctrl+C para parar)`);
  await new Promise((r) => setTimeout(r, interval * 60_000));
  await once();
}
process.exit(0);
