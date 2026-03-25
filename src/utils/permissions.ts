import { owners } from "../config/config.json";

export function isOwner(userId: string): boolean {
  return owners.includes(userId);
}
