const hubUrl = (process.env.E_HUB_URL || "https://e.vxnus.xyz/api/packs").replace(/\/+$/, "");
const providerUrl = (process.env.TEYVAT_PROVIDER_URL || "https://eteyvat.vxnus.xyz/api/knowledge").replace(/\/+$/, "");

async function json(url, init) {
  const response = await fetch(url, init);
  let body;
  try { body = await response.json(); } catch { body = undefined; }
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const pack = await json(`${hubUrl}/vxnus/teyvat`);
if (pack.id !== "@vxnus/teyvat" || pack.distribution?.kind !== "provider" || pack.distribution.url !== providerUrl) {
  throw new Error("Hub registry does not point @vxnus/teyvat to the expected provider URL");
}
if (!pack.sources?.length) throw new Error("Pack in Hub registry is missing sources");
const retrieval = await json(`${providerUrl}/retrieve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "Furina", mode: "lexical", limit: 1 }) });
if (retrieval.revision !== undefined && (!Array.isArray(retrieval.results) || retrieval.results.some((result) => result.revision !== retrieval.revision || !result.citations?.length))) throw new Error("Teyvat retrieval response lost revision or citations");
console.log(JSON.stringify({ hub: hubUrl, provider: providerUrl, pack: pack.id, revision: retrieval.revision, results: retrieval.results?.length ?? 0 }, null, 2));
