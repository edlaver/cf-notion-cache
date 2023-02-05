import { NotionAPI } from "notion-client";

// Function to retrieve a page from Notion by pageId
const fetchPageFromNotion = async (pageId) => {
  const notion = new NotionAPI();
  const recordMap = await notion.getPage(pageId);
  return recordMap;
};

export { fetchPageFromNotion };
