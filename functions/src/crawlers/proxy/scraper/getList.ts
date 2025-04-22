import { Page } from "playwright-core";
import { ProxyData, ProxyDoc } from "./../../../types/proxyData.d";

export async function getList(page: Page): Promise<ProxyDoc[]> {
  const proxyRows = await page.locator("tr[onmouseover]").all();

  const proxyList: ProxyData[] = await Promise.all(proxyRows.map(async (row) => {
    const ipElement = row.locator("td:nth-child(1) font.spy14");
    const proxyTypeElement = row.locator("td:nth-child(2)");
    const latencyElement = row.locator("td:nth-child(6) font.spy1");
    const statusElement = row.locator("td:nth-child(8) acronym");

    const [endpoint, type, latency, status] = await Promise.all([
      ipElement.innerText().catch(() => null),
      proxyTypeElement.innerText().catch(() => null),
      latencyElement.innerText().catch(() => "Infinity"),
      statusElement.getAttribute("title").catch(() => null)
    ]);

    const [ipAddress, port] = endpoint!.split(":");

    return {
      ipAddress,
      port: parseInt(port),
      type,
      latency: parseFloat(latency),
      lastCheckStatus: status,
    };
  }));

  const defaultProxyState: Pick<ProxyDoc, "available" | "used"> = {
    available: true,
    used: false,
  };

  const filteredProxies = proxyList
    .filter(({ lastCheckStatus }) => lastCheckStatus?.includes("OK"))
    .map((proxy) => ({ ...proxy, ...defaultProxyState }))
    .sort((a, b) => a.latency - b.latency);

  return filteredProxies;
}