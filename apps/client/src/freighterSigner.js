import { requestAccess, signAuthEntry } from "@stellar/freighter-api";

export async function connectFreighter() {
  const access = await requestAccess();
  if (access?.error) {
    throw new Error(access.error.message || "Freighter access was denied.");
  }
  if (!access?.address) {
    throw new Error("Freighter did not return an address.");
  }
  return access.address;
}

export function createFreighterSigner(address) {
  return {
    address,
    async signAuthEntry(authEntryXdr) {
      const result = await signAuthEntry(authEntryXdr, { address });
      if (result?.error) {
        throw new Error(result.error.message || "Freighter failed to sign the authorization entry.");
      }
      if (!result?.signedAuthEntry) {
        throw new Error("Freighter returned an empty signed auth entry.");
      }
      return result.signedAuthEntry;
    },
  };
}
