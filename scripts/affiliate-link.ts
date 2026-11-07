import { setAffiliateLink } from "../src/robot/affiliate";

const [offerId, url] = process.argv.slice(2);
if (!offerId || !url) {
  console.error("Uso: npm run robot:affiliate -- <id-da-oferta> <seu-link-de-afiliado>");
  process.exit(1);
}
const res = await setAffiliateLink(Number(offerId), url);
if (!res.ok) {
  console.error(res.error);
  process.exit(1);
}
console.log(`Link cadastrado para: ${res.title}`);
process.exit(0);
