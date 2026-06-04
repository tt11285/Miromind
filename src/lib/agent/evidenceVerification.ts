import pLimit from "p-limit";
import type { AgentEvidenceCard } from "./types";

type FetchImpl = typeof fetch;

export interface VerifyEvidenceOptions {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  concurrency?: number;
  /** Fraction of the snippet's key terms that must appear on the page (0–1). */
  matchThreshold?: number;
}

const URL_PATTERN = /https?:\/\/[^\s)]+/i;
const MAX_BODY_CHARS = 2_000_000;

const STOPWORDS = new Set([
  "that",
  "this",
  "with",
  "from",
  "were",
  "have",
  "will",
  "their",
  "they",
  "than",
  "then",
  "such",
  "into",
  "over",
  "also",
  "been",
  "more",
  "most",
  "some",
  "very",
  "would",
  "could",
  "should",
  "about",
  "which",
  "these",
  "those",
  "there"
]);

function extractHttpUrl(reference: string): string | null {
  const match = reference.match(URL_PATTERN);
  if (!match) {
    return null;
  }
  return match[0].replace(/[.,;]+$/, "");
}

/** Strip HTML/markup and punctuation; lower-case; collapse whitespace. */
function normalize(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9$%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keyTerms(normalizedSnippet: string): string[] {
  return Array.from(
    new Set(
      normalizedSnippet
        .split(" ")
        .filter((term) => term.length >= 4 && !STOPWORDS.has(term))
    )
  );
}

/** True when the snippet appears verbatim, or enough of its key terms are present. */
function snippetAppearsOnPage(
  snippet: string,
  normalizedPage: string,
  threshold: number
): boolean {
  const normalizedSnippet = normalize(snippet);
  if (normalizedSnippet.length >= 12 && normalizedPage.includes(normalizedSnippet)) {
    return true;
  }
  const terms = keyTerms(normalizedSnippet);
  if (terms.length === 0) {
    return false;
  }
  const hits = terms.filter((term) => normalizedPage.includes(term)).length;
  return hits / terms.length >= threshold;
}

async function fetchPageText(
  url: string,
  fetchImpl: FetchImpl,
  timeoutMs: number
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/text\/|html|json|xml/i.test(contentType)) {
      // Binary content (PDF, image) — cannot text-match.
      return null;
    }
    const raw = await response.text();
    return normalize(raw.slice(0, MAX_BODY_CHARS));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function verifyCard(
  card: AgentEvidenceCard,
  fetchImpl: FetchImpl,
  timeoutMs: number,
  threshold: number
): Promise<AgentEvidenceCard> {
  // An explicitly unavailable card has no source to confirm; keep it honest.
  if (card.provenanceStatus === "unavailable") {
    return card;
  }

  const url = extractHttpUrl(card.urlOrReference);
  if (!url) {
    return { ...card, provenanceStatus: "model-reported" };
  }

  const pageText = await fetchPageText(url, fetchImpl, timeoutMs);
  if (pageText === null) {
    // Link did not resolve, was blocked, timed out, or was non-text.
    return { ...card, provenanceStatus: "model-reported" };
  }

  const confirmed = snippetAppearsOnPage(card.quotedSnippet, pageText, threshold);
  return { ...card, provenanceStatus: confirmed ? "verified" : "model-reported" };
}

/**
 * Grounds each evidence card against its source page.
 * - "verified": the page resolved AND the quoted snippet is actually found on it.
 * - "model-reported": there is a reference but the quote could not be confirmed
 *   (no URL, unreachable, blocked, non-text, or snippet not present).
 * - "unavailable": left unchanged.
 *
 * Verification is deliberately conservative: a working link alone is not enough,
 * so the "verified" badge means the claim is backed by text on the cited page.
 */
export async function verifyEvidenceCards(
  cards: AgentEvidenceCard[],
  options: VerifyEvidenceOptions = {}
): Promise<AgentEvidenceCard[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 6000;
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const threshold = options.matchThreshold ?? 0.6;
  const limit = pLimit(concurrency);

  return Promise.all(
    cards.map((card) => limit(() => verifyCard(card, fetchImpl, timeoutMs, threshold)))
  );
}
