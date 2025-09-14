import logger from "@adonisjs/core/services/logger";

export interface ImageData {
  filename: string;
  contentType: string;
  size: number;
  data: string; // Base64 encoded image data
  originalUrl?: string; // Keep original URL for reference
}

export default class ImageService {
  async downloadAndStoreImage(
    url: string,
    filename?: string,
  ): Promise<ImageData> {
    try {
      logger.info(`Downloading image from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download image: ${response.status} ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString("base64");

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const inferredFilename =
        filename || this.generateFilename(url, contentType);

      const imageData: ImageData = {
        filename: inferredFilename,
        contentType,
        size: buffer.length,
        data: base64Data,
        originalUrl: url,
      };

      logger.info(
        `Successfully downloaded image: ${inferredFilename} (${buffer.length} bytes)`,
      );
      return imageData;
    } catch (error) {
      logger.error(`Failed to download image from ${url}:`, error);
      throw error;
    }
  }

  async downloadMultipleImages(
    images: Array<{ url: string; filename?: string }>,
  ): Promise<ImageData[]> {
    const downloadPromises = images.map(({ url, filename }) =>
      this.downloadAndStoreImage(url, filename),
    );

    try {
      const results = await Promise.all(downloadPromises);
      return results;
    } catch (error) {
      logger.error("Failed to download one or more images:", error);
      // Return partial results or rethrow based on requirements
      throw error;
    }
  }

  private generateFilename(url: string, contentType: string): string {
    // Extract filename from URL if possible
    const urlParts = url.split("/");
    const lastPart = urlParts[urlParts.length - 1];

    if (lastPart && lastPart.includes(".")) {
      return lastPart.split("?")[0]; // Remove query parameters
    }

    // Generate filename based on content type
    const extension = this.getExtensionFromContentType(contentType);
    const timestamp = Date.now();
    return `image_${timestamp}.${extension}`;
  }

  private getExtensionFromContentType(contentType: string): string {
    const typeMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/bmp": "bmp",
      "image/svg+xml": "svg",
    };

    return typeMap[contentType.toLowerCase()] || "jpg";
  }

  getImageAsBase64DataUrl(imageData: ImageData): string {
    return `data:${imageData.contentType};base64,${imageData.data}`;
  }

  getImageBuffer(imageData: ImageData): Buffer {
    return Buffer.from(imageData.data, "base64");
  }
}
