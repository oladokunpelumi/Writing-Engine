import type { BriefInput, Post, RetrievedPost } from "../../shared/src";
import { cosine, embedModel, embedTexts, embeddingsEnabled } from "./embeddings";

// Structural interface so retrieval stays decoupled from the concrete Repository.
export interface EmbeddingStore {
  getPostEmbedding(postId: string, model: string): number[] | undefined;
  savePostEmbedding(postId: string, model: string, vector: number[]): void;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "but",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "you",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "not",
  "what",
  "when",
  "where",
  "why",
  "how",
  "about",
  "then",
  "than"
]);

export function tokenize(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((term) => term.length > 2 && !STOPWORDS.has(term))
    )
  );
}

export function briefText(brief: BriefInput) {
  return [
    brief.topic,
    brief.seed,
    brief.anchor,
    brief.observation,
    brief.tension,
    brief.audience,
    brief.rawNotes
  ]
    .filter(Boolean)
    .join(" ");
}

export function retrievePosts(posts: Post[], brief: BriefInput, topK = 3): RetrievedPost[] {
  const queryTerms = tokenize(briefText(brief));
  if (queryTerms.length === 0) return [];

  return posts
    .map((post) => {
      const haystack = tokenize(`${post.title} ${post.tags.join(" ")} ${post.body}`);
      const haystackSet = new Set(haystack);
      const matchedTerms = queryTerms.filter((term) => haystackSet.has(term));
      const tagBoost = post.tags.some((tag) => queryTerms.includes(tag.toLowerCase())) ? 1.5 : 0;
      const score = matchedTerms.length + tagBoost;
      return { post, score, matchedTerms };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.post.wordCount - a.post.wordCount)
    .slice(0, topK);
}

export function vectorRetrievalEnabled() {
  return embeddingsEnabled();
}

// Embed the post's title + body for retrieval. Body is capped to keep within
// embedding context limits while preserving the strongest voice signal.
function postEmbeddingInput(post: Post) {
  return `${post.title}\n\n${post.body.slice(0, 4000)}`;
}

// Semantic retrieval with graceful fallback. When embeddings are enabled, any
// posts missing a current-model vector are embedded once and cached, the brief
// is embedded, and posts are ranked by cosine similarity. matchedTerms keeps
// the lexical overlap for the debug view. Falls back to lexical retrieval when
// embeddings are off or the embedding call fails.
export async function retrieve(
  store: EmbeddingStore,
  posts: Post[],
  brief: BriefInput,
  topK = 3
): Promise<RetrievedPost[]> {
  if (!embeddingsEnabled()) return retrievePosts(posts, brief, topK);
  const query = briefText(brief).trim();
  if (query.length === 0 || posts.length === 0) return [];

  try {
    const model = embedModel();
    const missing = posts.filter((post) => !store.getPostEmbedding(post.id, model));
    if (missing.length > 0) {
      const vectors = await embedTexts(missing.map(postEmbeddingInput));
      missing.forEach((post, index) => store.savePostEmbedding(post.id, model, vectors[index]));
    }
    const queryVector = (await embedTexts([query]))[0];
    const queryTerms = new Set(tokenize(query));

    const ranked = posts
      .map((post) => {
        const vector = store.getPostEmbedding(post.id, model);
        if (!vector) return undefined;
        const haystack = new Set(tokenize(`${post.title} ${post.tags.join(" ")} ${post.body}`));
        const matchedTerms = Array.from(queryTerms).filter((term) => haystack.has(term));
        return { post, score: cosine(queryVector, vector), matchedTerms };
      })
      .filter((result): result is RetrievedPost => result !== undefined)
      .sort((a, b) => b.score - a.score || b.post.wordCount - a.post.wordCount)
      .slice(0, topK);

    return ranked.length > 0 ? ranked : retrievePosts(posts, brief, topK);
  } catch {
    return retrievePosts(posts, brief, topK);
  }
}
