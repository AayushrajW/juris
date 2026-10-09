export type UserId = string;
export type UserRole = "citizen";

export interface User {
  id: UserId;
  role: UserRole;
  displayName: string;
  email: string;
  preferredLanguage: "en";
}
