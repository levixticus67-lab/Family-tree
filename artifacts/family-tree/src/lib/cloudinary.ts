export async function uploadToCloudinary(
  file: File,
  signatureData: {
    signature: string;
    timestamp: number;
    cloudName: string;
    apiKey: string;
    uploadPreset: string;
    folder?: string;
  }
): Promise<{ secure_url: string; public_id: string; duration?: number }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signatureData.apiKey);
  formData.append("timestamp", signatureData.timestamp.toString());
  formData.append("signature", signatureData.signature);
  formData.append("upload_preset", signatureData.uploadPreset);
  if (signatureData.folder) {
    formData.append("folder", signatureData.folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to upload to Cloudinary");
  }

  return response.json();
}
