import { v2 as cloudinary } from "cloudinary";
import { logger } from "./logger";

let _configured = false;

export function getCloudinary() {
  if (!_configured) {
    const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary credentials not configured");
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    _configured = true;
    logger.info("Cloudinary configured");
  }
  return cloudinary;
}

export async function generateUploadSignature(folder: string): Promise<{
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  folder: string;
}> {
  const cld = getCloudinary();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder, timestamp };
  const signature = cld.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);
  return {
    signature,
    timestamp,
    cloudName: process.env.VITE_CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    uploadPreset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET!,
    folder,
  };
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  const cld = getCloudinary();
  await cld.uploader.destroy(publicId);
}
