import pLimit from "p-limit";
import type { AgentEvidenceCard } from "./types";

type FetchImpl = typeof fetch;

export interface VerifyEvidenceOptions {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  concurrency?: number;
}

const URL_PATTERN = /https?:\/\/[^\s)]+/i;

function extractHttpUrl(reference: string): string | null {
  const match = reference.match(URL_PATTERN);
  return match ? match[0] : null;
}

async function isReachable(
  url: string,
  fetchImpl: FetchImpl,
  timeoutMs: number
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function verifyCard(
  cardToVerify: AgentEvidenceCard,
  fetchImpl: FetchImpl,
  timeoutMs: number
): Promise<AgentEvidenceCard> {
  // An explicitly unavailable card has no source to confirm; keep it honest.
  if (cardToVerify.provenanceStatus === "unavailable") {
    return cardToVerify;
  }

  const url = extractHttpUrl(cardToVerify.urlOrReference);
  if (!url) {
    return { ...cardToVerify, provenanceStatus: "model-reported" };
  }

  const reachable = await isReachable(url, fetchImpl, timeoutMs);
  return {
    ...cardToVerify,
    provenanceStatus: reachable ? "verified" : "model-reported"
  };
}

/**
 * Confirms each evidence card's source link actually resolves.
 * - reachable http(s) URL -> "verified"
 * - no URL, or URL that fails/times out -> "model-reported" (unconfirmed)
 * - already "unavailable" -> left unchanged
 *
 * This only proves the link resolves, not that the quoted snippet is accurate,
 * so it never manufactures a stronger claim than the evidence supports.
 */
export async function verifyEvidenceCards(
  cards: AgentEvidenceCard[],
  options: VerifyEvidenceOptions = {}
): Promise<AgentEvidenceCard[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const limit = pLimit(concurrency);

  return Promise.all(
    cards.map((cardToVerify) =>
      limit(() => verifyCard(cardToVerify, fetchImpl, timeoutMs))
    )
  );
}
