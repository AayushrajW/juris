export type UserId = string;
export type UserRole = "citizen";
export type LanguageCode = "mr" | "hi" | "en";

export interface User {
  id: UserId;
  role: UserRole;
  displayName: string;
  email: string;
  preferredLanguage: LanguageCode;
}
