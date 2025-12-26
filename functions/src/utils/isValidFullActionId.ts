import { FullActionId, fullActionId } from "../events/fullActionId";

export function isValidFullActionId(id: string): id is FullActionId {
  return (Object.values(fullActionId) as readonly string[]).includes(id);
}