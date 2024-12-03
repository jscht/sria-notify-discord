import { Router } from "express";
import { recruitScraper } from "../crawlers/sriagent/recruitScraper";

const testScrapRouter = Router();

testScrapRouter.get("/playwright-scraper", async (req, res) => {
  try {
    const crawl_data = await recruitScraper();
    if (crawl_data.length !== 0) res.json({ result: crawl_data });
    else res.json({ result: "No recruitment data" });
  } catch (error) {
    console.error("Error in playwright-scraper:", error);
    res.status(500).send("An error occurred during scraping.");
  }
});

export { testScrapRouter };