import ky from "ky";

const SUPPORTED_SIGNATURE_ALGORITHMS = ["SHA-1", "SHA-256"];
const DEFAULT_SIGNATURE_ALGORITHM = "SHA-1";

// Helper class to simulate the Cloudinary API using fetch instead of the Node.js SDK
class CloudinaryFetchWrapper {
  settings = {
    cloudinary_api_version: "v1_1",
    cloud_name: "",
    api_key: "",
    api_secret: "",
    secure: true,
    signature_algorithm: DEFAULT_SIGNATURE_ALGORITHM,
  };

  get baseCloudinaryUrl() {
    if (!this.settings.cloudinary_api_version) {
      throw new Error(
        "cloudinary_api_version is not set. Please set it using config()"
      );
    }

    if (!this.settings.cloud_name) {
      throw new Error("cloud_name is not set. Please set it using config()");
    }

    return `https://api.cloudinary.com/${this.settings.cloudinary_api_version}/${this.settings.cloud_name}`;
  }

  config = (newSettings) => {
    if (newSettings) {
      this.settings = { ...this.settings, ...newSettings };
    }
    return this.settings;
  };

  api = {
    resource: async (publicId, options) => {
      const url = `${this.baseCloudinaryUrl}/resources/image/upload/${publicId}`;

      // Cloudinary API GET requests require basic auth of a base64 encoded string of the API key and secret
      const basicAuth =
        "Basic " + btoa(`${this.settings.api_key}:${this.settings.api_secret}`);

      console.log(
        "🔎 > cloudinary-fetch-wrapper > api.resource > url:",
        // publicId,
        // options,
        url
        // basicAuth
      );

      try {
        const result = await ky
          .get(url, {
            credentials: undefined, // Important, avoids this issue: https://github.com/sindresorhus/ky/issues/366
            headers: {
              Authorization: basicAuth,
            },
            throwHttpErrors: false, // We expect missing resources, so don't throw on 404s
          })
          .json();

        console.log(
          "🔎 > CloudinaryFetchWrapper > api.resource: > result",
          JSON.stringify(result)
        );

        return result;
      } catch (error) {
        console.error(
          "🛑 > CloudinaryFetchWrapper > api.resource: > error",
          error
        );
        // console.error(error);
        // throw error;
      }
    },
  };

  uploader = {
    upload: async (imageUrl, options) => {
      const url = `${this.baseCloudinaryUrl}/image/upload`;

      const timestamp = Math.round(new Date().getTime() / 1000);

      // Build the params to sign
      const formData = new FormData();

      // Preset params
      formData.append("file", imageUrl);
      formData.append("api_key", this.settings.api_key);
      formData.append("timestamp", timestamp);

      // Add the params from the options
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, value);
      });

      console.log(
        "🔎 > CloudinaryFetchWrapper > formData > formData (pre-signature)",
        JSON.stringify([...formData])
      );

      const signature = await this.api_sign_request(
        formData,
        this.settings.api_secret
      );
      formData.append("signature", signature);

      console.log("🔎 > CloudinaryFetchWrapper > signature", signature);

      console.log(
        "🔎 > CloudinaryFetchWrapper > formData > formData (post-signature)",
        JSON.stringify([...formData])
      );

      const result = await ky
        .post(url, {
          credentials: undefined, // Important, avoids this issue: https://github.com/sindresorhus/ky/issues/366
          body: formData,
          throwHttpErrors: false,
        })
        .json();

      console.log(
        "🔎 > CloudinaryFetchWrapper > upload: > result",
        JSON.stringify(result)
      );

      return result;
    },
  };

  api_sign_request(params_to_sign, api_secret) {
    // let to_sign = Object.entries(params_to_sign)
    let to_sign = [...params_to_sign]
      .filter(([k, v]) => this.present(v))
      // All parameters added to the method call should be included except:
      // file, cloud_name, resource_type and your api_key.
      .filter(
        ([k, v]) =>
          k !== "file" &&
          k !== "cloud_name" &&
          k !== "resource_type" &&
          k !== "api_key"
      )
      .map(([k, v]) => `${k}=${this.toArray(v).join(",")}`)
      .sort()
      .join("&");

    console.log(
      "🔎 > CloudinaryFetchWrapper > api_sign_request > to_sign",
      to_sign
    );

    return this.computeHash(
      to_sign + api_secret,
      this.config().signature_algorithm || DEFAULT_SIGNATURE_ALGORITHM
    );
  }

  // /**
  //  * Computes hash from input string using specified algorithm.
  //  * @private
  //  * @param {string} input string which to compute hash from
  //  * @param {string} signature_algorithm algorithm to use for computing hash
  //  * @param {string} encoding type of encoding
  //  * @return {string} computed hash value
  //  */
  // computeHash(input, signature_algorithm, encoding) {
  //   if (!SUPPORTED_SIGNATURE_ALGORITHMS.includes(signature_algorithm)) {
  //     throw new Error(
  //       `Signature algorithm ${signature_algorithm} is not supported. Supported algorithms: ${SUPPORTED_SIGNATURE_ALGORITHMS.join(
  //         ", "
  //       )}`
  //     );
  //   }
  //   let hash = crypto.createHash(signature_algorithm);
  //   hash.update(utf8.encode(input), "binary");
  //   return hash.digest(encoding);
  // }

  // Via: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
  /**
   * Computes hash from input string using specified algorithm.
   * @private
   * @param {string} input string which to compute hash from
   * @param {string} signature_algorithm algorithm to use for computing hash
   * @return {string} computed hash value
   */
  async computeHash(input, signature_algorithm = DEFAULT_SIGNATURE_ALGORITHM) {
    console.log(
      "🔎 > CloudinaryFetchWrapper > computeHash",
      input,
      signature_algorithm
    );

    if (!SUPPORTED_SIGNATURE_ALGORITHMS.includes(signature_algorithm)) {
      throw new Error(
        `Signature algorithm ${signature_algorithm} is not supported. Supported algorithms: ${SUPPORTED_SIGNATURE_ALGORITHMS.join(
          ", "
        )}`
      );
    }
    const msgUint8 = new TextEncoder().encode(input); // encode as (utf-8) Uint8Array

    console.log(
      "🔎 > CloudinaryFetchWrapper > computeHash > msgUint8",
      msgUint8
    );

    const hashBuffer = await crypto.subtle.digest(
      // Note: Slightly different API for CF Workers. See: https://developers.cloudflare.com/workers/runtime-apis/web-crypto#background
      {
        name: signature_algorithm,
      },
      msgUint8
    ); // hash the message

    console.log(
      "🔎 > CloudinaryFetchWrapper > computeHash > hashBuffer",
      hashBuffer
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array

    console.log(
      "🔎 > CloudinaryFetchWrapper > computeHash > hashArray",
      hashArray
    );

    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""); // convert bytes to hex string

    console.log("🔎 > CloudinaryFetchWrapper > computeHash > hashHex", hashHex);

    return hashHex;
  }

  present(value) {
    return value != null && ("" + value).length > 0;
  }

  /**
   * @desc Turns arguments that aren't arrays into arrays
   * @param arg
   * @returns { any | any[] }
   */
  toArray(arg) {
    switch (true) {
      case arg == null:
        return [];
      case Array.isArray(arg):
        return arg;
      default:
        return [arg];
    }
  }
}

export { CloudinaryFetchWrapper };
