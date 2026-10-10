export type UserId = string;
export type UserRole = "citizen";
export type LanguageCode = "mr" | "hi" | "en";

export interface User {
  id: UserId;
  role: UserRole;
  /** Empty until the person says what to call them. Nobody is asked for a name to get in. */
  displayName: string;
  /** Their mobile number in international form, such as +919876543210. It is how they sign in. */
  phone: string;
  email?: string;
  preferredLanguage: LanguageCode;
}
