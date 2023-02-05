import { fetchPageFromNotion } from "./notion-helpers.js";

import {
  checkForImageInCDN,
  uploadImageFromUrlToCDN,
} from "./cloudinary-helpers.js";

// if (!NOTION_CACHE) {
//   throw new Error("🛑 > NOTION_CACHE must all be set in [vars]");
// }

// Function to cache a Notion page into KV by pageId
const putPageToKVCache = async (pageId) => {
  // - Retrieve recordMap from Notion by pageId
  const recordMap = await fetchPageFromNotion(pageId);

  // - Load the recordMap from KV
  let cachedPage = await getPageFromKVCache(pageId);

  if (cachedPage) {
    // Compare first block > type:page > version numbers, return if same.
    console.log(
      "🔎 > putPageToKVCache > Comparing cachedPage to new recordMap, using version numbers"
    );

    const cachedFirstBlock = cachedPage.block[Object.keys(cachedPage.block)[0]];
    const cachedVersionNumber = cachedFirstBlock.value.version;

    const recordMapFirstBlock =
      recordMap.block[Object.keys(recordMap.block)[0]];
    const recordMapVersionNumber = recordMapFirstBlock.value.version;

    console.log(
      "🔎 > putPageToKVCache > cachedVersionNumber / recordMapVersionNumber:",
      cachedVersionNumber,
      recordMapVersionNumber
    );
    if (cachedVersionNumber === recordMapVersionNumber) {
      console.log(
        "🔎 > putPageToKVCache > version numbers match, returning cachedPage"
      );
      // TODO: Re-enable once cache stuff is completed
      // return cachedPage;
    } else {
      console.log(
        "🔎 > putPageToKVCache > version numbers don't match, caching the new recordMap"
      );
    }
  }

  // - Loop over images
  console.log("🔎 > putPageToKVCache > Loop over images");

  const signedImages = recordMap.signed_urls;

  // const signedImagesKeys = [Object.keys(signedImages)[0]]; // Testing, just process first image
  const signedImagesKeys = Object.keys(signedImages);

  //
  const processImagePromises = signedImagesKeys.map(async (imageId) => {
    console.log("🔎 > signedImagesKeys.map > imageId", imageId);

    const imageUrl = signedImages[imageId];
    console.log("🔎 > signedImagesKeys.map > imageUrl", imageUrl);

    const imageDetails = recordMap.block[imageId];
    // console.log("🔎 > signedImagesKeys.map > imageDetails", imageDetails);

    const imageVersion = imageDetails.value.version;

    // - Look up each image in images API by ID+Version
    let savedImageDetails = await checkForImageInCDN(imageId, imageVersion);

    if (!savedImageDetails) {
      // - If no match, store into images API with key of ID+Version
      console.log(
        "🔎 > signedImagesKeys.map > No existing image, storing image from signed image URL"
      );

      savedImageDetails = await uploadImageFromUrlToCDN(
        imageId,
        imageUrl,
        imageVersion
      );
    }

    if (savedImageDetails?.url) {
      // - Rewrite signed image URL with stored image URL
      recordMap.signed_urls[imageId] = savedImageDetails.url;
    }
  });

  console.log(
    "🔎 > Using Promise.all to process: processImagePromises",
    processImagePromises
  );

  await Promise.all(processImagePromises);

  console.log(
    "🔎 > Finished awaiting Promise.all to process: processImagePromises"
  );

  console.log("🔎 > Store recordMap into KV by pageId", pageId);

  // - Store recordMap into KV by pageId
  await NOTION_CACHE.put(pageId, JSON.stringify(recordMap));

  // - Return recordMap
  return recordMap;
};

// Function to cache a Notion page into KV by pageId
const getPageFromKVCache = async (pageId) => {
  // - Load the recordMap from KV
  let cachedPage = await NOTION_CACHE.get(pageId);
  if (cachedPage) {
    console.log(
      "🔎 > cachePageInKV > Found cachedPage in cache for pageId:",
      pageId
    );

    // TODO: Compare first block > type:page > version numbers, return if same.
    return JSON.parse(cachedPage);
  }

  console.log(
    "🔎 > cachePageInKV > Couldn't find cachedPage in cache for pageId:",
    pageId
  );

  return null;
};

// async function asyncForEach(array, callback) {
//   for (let index = 0; index < array.length; index++) {
//     await callback(array[index], index, array);
//   }
// }

export { putPageToKVCache, getPageFromKVCache };
