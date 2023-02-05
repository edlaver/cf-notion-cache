/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npx wrangler dev src/index.js` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.js --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// https://github.com/kwhitley/itty-router => Tiny, zero-dependency router with route param and query parsing
import { Router } from "itty-router";

import {
  json,
  // missing,
  // error,
  // status,
  // withContent,
  // withParams,
  // ThrowableRouter,
} from "itty-router-extras";

import { createCors } from "itty-cors";

import { putPageToKVCache, getPageFromKVCache } from "./cloudflare-helpers";

// Ensure all required env vars are set
ensureEnvVars();

// create CORS handlers
const { preflight, corsify } = createCors({ origins: ["*"] }); // From: itty-cors

// Create a router (note the lack of "new")
const router = Router();

router.all("*", preflight); // handle CORS preflight/OPTIONS requests

//// POST > Triggers the job to fetch the page from Notion:
// E.g. http://localhost:8787/cache/8b943a5d-8a65-4e37-afad-d0f61f06036c => params: { pageId: "8b943a5d-8a65-4e37-afad-d0f61f06036c" }
router.post("/cache/:pageId", async ({ params }) => {
  const pageId = params.pageId;

  console.log(
    "🔎 > router.post > /cache/:pageId > Caching Notion page with page id:",
    pageId
  );

  const recordMap = await putPageToKVCache(pageId);

  return json(recordMap);
});

//// GET > A cached page from KV, or fetch from Notion if not cached (and store it):
// E.g. http://localhost:8787/cache/8b943a5d-8a65-4e37-afad-d0f61f06036c => params: { pageId: "8b943a5d-8a65-4e37-afad-d0f61f06036c" }
router.get("/cache/:pageId", async ({ params }) => {
  const pageId = params.pageId;

  console.log(
    "🔎 > router.get > /cache/:pageId > Fetching Notion page from KV with page id:",
    pageId
  );

  // - Load the recordMap from KV by pageId
  let cachedPage = await getPageFromKVCache(pageId);

  // - If not found, cache it using same function as /cache endpoint
  if (!cachedPage) {
    console.log(
      "🔎 > router.get > /cache/:pageId > Notion page not found in KV with page id:",
      pageId
    );

    cachedPage = await putPageToKVCache(pageId);
  }

  console.log(
    "🔎 > router.get > /cache/:pageId > Returning Notion page from KV with page id:",
    pageId
  );

  // - Returns the recordMap
  return corsify(json(cachedPage));
});

// 404 for everything else
router.all("*", () => new Response("Not Found.", { status: 404 }));

// attach the router "handle" to the event handler
addEventListener("fetch", (event) =>
  event.respondWith(router.handle(event.request))
);

function ensureEnvVars() {
  const envVars = [
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    NOTION_CACHE,
  ];

  envVars.forEach((envVar) => {
    if (!envVar) {
      throw new Error(`Missing environment variable: ${envVar}`);
    }
  });
}
