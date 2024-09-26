import { Locator } from "playwright";

export async function isNextPageAvailable(nextPageButton: Locator) {
  const isDisabled = await nextPageButton.evaluate((element) => 
    element.classList.contains('v-pagination__navigation--disabled')
  );
  return !isDisabled ? true : false;
}
