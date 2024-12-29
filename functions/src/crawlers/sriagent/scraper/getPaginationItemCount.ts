import { Page } from "playwright";

export async function getPaginationItemCount(page: Page) {
  const paginationLocator = page.locator("ul.v-pagination");

  const paginationExists = await paginationLocator.count() > 0;
  if (!paginationExists) {
    throw new Error("v-pagination class not found on the page.");
  }

  // pagination 화살표 요소 2개를 뺀 개수
  return await paginationLocator.locator("li").count() - 2;
}
