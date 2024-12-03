import { Page } from "playwright";

export async function isNextPageAvailable(page: Page) {
  const nextPageButton = page.locator(".v-pagination__navigation[aria-label='다음 페이지']");
  const isDisabled = await nextPageButton.evaluate((element) => 
    element.classList.contains("v-pagination__navigation--disabled")
  );
  return { nextPageButton, hasNextPage: !isDisabled };
}
