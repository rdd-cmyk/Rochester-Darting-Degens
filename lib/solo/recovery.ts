import type { SoloOperation } from "./types";
const prefix = () =>
  `rdd:solo:v1:${encodeURIComponent(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "local")}:`;
export function recoveryPrefix(owner: string) {
  return `${prefix()}${owner}:operation:`;
}
export function retainOperation(owner: string, operation: SoloOperation) {
  if (operation.payload.submitted_by !== owner)
    throw Error("This save belongs to another account.");
  const key = recoveryPrefix(owner) + operation.operationId;
  const value = JSON.stringify(operation);
  const existing = localStorage.getItem(key);
  if (existing !== null && existing !== value)
    throw Error(
      "This save identifier already has different content. Check the original save first.",
    );
  localStorage.setItem(key, value);
}
export function clearOperation(owner: string, id: string) {
  localStorage.removeItem(recoveryPrefix(owner) + id);
}
export function readOperations(owner: string): SoloOperation[] {
  const out: SoloOperation[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(recoveryPrefix(owner))) continue;
    try {
      const op = JSON.parse(
        localStorage.getItem(key) ?? "null",
      ) as SoloOperation;
      if (
        typeof op?.operationId === "string" &&
        op.payload?.submitted_by === owner &&
        ["save", "delete", "restore"].includes(op.payload.action)
      )
        out.push(op);
    } catch {
      /* Keep corrupt recovery evidence without replaying it. */
    }
  }
  return out;
}
export function draftStorageKey(owner: string) {
  let tab = sessionStorage.getItem("rdd:solo:tab");
  if (!tab) {
    tab = crypto.randomUUID();
    sessionStorage.setItem("rdd:solo:tab", tab);
  }
  return `${prefix()}${owner}:draft:${tab}`;
}
