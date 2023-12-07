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
  console.log(
    "🔎 > putPageToKVCache > Loop over images"
    // JSON.stringify(recordMap, null, 2)
  );

  // const keys = Object.keys(recordMap.block);
  // console.log(
  //   "🔎 > recordMap > keys:",
  //   keys
  //   // JSON.stringify(recordMap, null, 2)
  // );

  const values = Object.values(recordMap.block);
  // console.log(
  //   "🔎 > recordMap > values:",
  //   values
  // );

  const imageTypeBlocks = values.filter(
    (value) => value.value.type === "image"
  );
  // console.log("🔎 > recordMap > imageTypes:", imageTypes);
  console.log(
    "🔎 > recordMap > imageTypeBlocks:",
    JSON.stringify(imageTypeBlocks, null, 2)
  );

  // Try with signed_urls first for backwards compatibility...
  const signedImages = recordMap.signed_urls;
  // const signedImagesKeys = [Object.keys(signedImages)[0]]; // Testing, just process first image
  const signedImagesKeys = Object.keys(signedImages);

  if (signedImagesKeys.length > 0) {
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
      "🔎 > signedImages > Using Promise.all to process: processImagePromises",
      processImagePromises
    );

    await Promise.all(processImagePromises);

    console.log(
      "🔎 > signedImages> Finished awaiting Promise.all to process: processImagePromises"
    );
  } else if (imageTypeBlocks.length > 0) {
    //
    const processImagePromises = imageTypeBlocks.map(async (imageBlock) => {
      console.log("🔎 > imageTypeBlocks.map > imageBlock", imageBlock);

      const imageBlockId = imageBlock.value.id;

      const baseImageUrl = imageBlock.value.format.display_source;
      // TODO: Add notion site URL to env vars
      const imageUrl = `${NOTION_SITE_BASE_URL}/image/${encodeURIComponent(
        baseImageUrl
      )}?table=${imageBlock.value.parent_table}&id=${imageBlockId}&cache=v2`;
      console.log("🔎 > imageTypeBlocks.map > imageUrl", imageUrl);

      const imageDetails = imageBlock;
      // console.log("🔎 > imageTypeBlocks.map > imageDetails", imageDetails);

      const imageVersion = imageDetails.value.version;

      // - Look up each image in images API by ID+Version
      let savedImageDetails = await checkForImageInCDN(
        imageBlockId,
        imageVersion
      );

      if (!savedImageDetails) {
        // - If no match, store into images API with key of ID+Version
        console.log(
          "🔎 > imageTypeBlocks.map > No existing image, storing image from signed image URL"
        );

        savedImageDetails = await uploadImageFromUrlToCDN(
          imageBlockId,
          imageUrl,
          imageVersion
        );
      }

      if (savedImageDetails?.url) {
        // - Rewrite signed image URL with stored image URL
        const imageBlockToUpdate = recordMap.block[imageBlockId];
        if (!imageBlockToUpdate) {
          console.log(
            "🔎 > imageTypeBlocks.map > No imageBlockToUpdate found for imageBlockId, skipping",
            imageBlockId
          );
          return;
        }
        // Update the source value in two places:
        imageBlockToUpdate.value.format.display_source = savedImageDetails.url;
        imageBlockToUpdate.value.properties.source = [[savedImageDetails.url]]; // Nested array format for some reason...
      } else {
        console.log(
          "🔎 > imageTypeBlocks.map > No savedImageDetails.url, skipping"
        );
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
  }

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
