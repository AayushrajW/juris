export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "not_found" | "invalid" | "unavailable"; message: string };
