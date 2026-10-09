/**
 * What may be added as a paper. The same rules run in the form (to tell the
 * person at once) and in the service (which is the one that decides).
 */
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const ALLOWED_NAME = /\.(pdf|jpe?g|png|webp)$/i;

export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const FILE_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

export type FileProblem = "type" | "size";

/** Both the type the phone reports and the file name must look right. */
export function checkFile(file: { name: string; type: string; size: number }): FileProblem | null {
  const typeOk = file.type ? ALLOWED_TYPES.includes(file.type) : true;
  if (!typeOk || !ALLOWED_NAME.test(file.name)) return "type";
  if (file.size > MAX_FILE_BYTES) return "size";
  return null;
}

export function fileKind(mimeType: string): "pdf" | "image" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  return mimeType === "application/pdf" ? "pdf" : "other";
}
