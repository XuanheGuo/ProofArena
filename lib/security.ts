export const MAX_IMAGE_COUNT = 4;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_CONTEST_THOUGHT_CHARS = 4000;
export const MAX_COMMENT_CHARS = 1200;
export const MAX_TITLE_CHARS = 120;
export const MAX_GENERAL_TEXT_CHARS = 12000;

export function clampText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

export function isAllowedImage(file: File) {
  return ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])
    && file.size > 0
    && file.size <= MAX_IMAGE_BYTES;
}

export function hasAllowedImageExtension(path: string) {
  return /\.(jpe?g|png|webp|gif)$/i.test(path);
}

export function extensionForImageType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "png";
}

export function isPublicSubmissionImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.pathname.includes("/storage/v1/object/public/submission-images/")
      && hasAllowedImageExtension(url.pathname);
  } catch {
    return false;
  }
}
