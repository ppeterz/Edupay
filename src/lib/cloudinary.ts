// ──────────────────────────────────────────────
// EduPay — Cloudinary Integration (Stage 8)
// ──────────────────────────────────────────────
// Manages document and PDF uploads to Cloudinary.
// If Cloudinary environment variables are missing, it falls back to generating
// a local/placeholder link to prevent payment processing from breaking.

import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isConfigured = !!(cloudName && apiKey && apiSecret);

if (isConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
} else {
  console.warn(
    '[cloudinary] Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or ' +
      'CLOUDINARY_API_SECRET. Falling back to local placeholder URLs.'
  );
}

/**
 * Upload a PDF buffer to Cloudinary and return the public secure URL.
 * If credentials are not set, returns a placeholder URL.
 */
export async function uploadPdfToCloudinary(
  buffer: Buffer,
  publicId: string
): Promise<string> {
  if (!isConfigured) {
    // Generate a secure placeholder that can represent the link
    // formatted: /receipts-offline/{publicId}.pdf
    return `https://res.cloudinary.com/placeholder-cloud/image/upload/v1/receipts-offline/${publicId}.pdf`;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw', // PDF must be uploaded as a 'raw' file in Cloudinary
        public_id: publicId,
        format: 'pdf',
      },
      (error, result) => {
        if (error) {
          console.error('[cloudinary] Upload error:', error);
          return reject(error);
        }
        resolve(result?.secure_url || '');
      }
    );

    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}
