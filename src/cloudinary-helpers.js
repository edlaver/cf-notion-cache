// Require the cloudinary library
import { CloudinaryFetchWrapper } from "./cloudinary-fetch-wrapper.js";

const cloudinary = new CloudinaryFetchWrapper();

// if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
//   throw new Error(
//     "🛑 > CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be set in [vars]"
//   );
// }

// Return "https" URLs by setting secure: true
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

// Log the configuration
console.log("cloudinary.config:", JSON.stringify(cloudinary.config()));

/////////////////////////////////////
// Gets details of an uploaded image
/////////////////////////////////////
const getAssetInfo = async (publicId) => {
  const options = {};

  console.log("🔎 > getAssetInfo", publicId);

  // Get details about the asset
  const result = await cloudinary.api.resource(publicId, options);

  console.log("🔎 > getAssetInfo > result", publicId, JSON.stringify(result));

  return result;
};

// Function to check for an image given an ID and version in Cloudinary
const checkForImageInCDN = async (imageId, imageVersion) => {
  const currentImageVersion = imageVersion.toString();

  const assetInfo = await getAssetInfo(imageId);

  if (assetInfo?.error) {
    console.log("🔎 > checkForImageInCDN > Image not found in CDN", imageId);
    return;
  }

  console.log(
    "🔎 > checkForImageInCDN > Image found. Checking currentImageVersion against assetInfo.context.custom.version",
    currentImageVersion,
    assetInfo?.context?.custom?.version
  );

  if (assetInfo?.context?.custom?.version === currentImageVersion) {
    console.log(
      "🔎 > checkForImageInCDN > Versions match! Returning existing assetInfo"
    );
    return assetInfo;
  } else {
    console.log(
      "🔎 > checkForImageInCDN > Versions don't match. Returning nothing"
    );
    return;
  }
};

// Function to upload an image to Cloudinary
const uploadImageFromUrlToCDN = async (imageId, imageUrl, imageVersion) => {
  const options = {
    public_id: imageId, // The identifier that's used for accessing and delivering the uploaded asset.
    overwrite: true,
    context: `version=${imageVersion}`, // Needs to be the text format, maps not supported.  See: https://cloudinary.com/documentation/image_upload_api_reference#upload_optional_parameters
  };

  try {
    // Upload the image
    const result = await cloudinary.uploader.upload(imageUrl, options);
    // console.log(result);
    return result;
  } catch (error) {
    console.error(error);
  }
};

export { checkForImageInCDN, uploadImageFromUrlToCDN };
