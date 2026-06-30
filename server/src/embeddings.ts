// Embedding + similarity helpers for semantic retrieval.
//
// Vectors are produced via OpenRouter's embeddings endpoint and stored as JSON
// in Postgres/pglite (see repository.savePostEmbedding). Cosine similarity is computed
// in-process. For a personal/design-partner-scale archive (hundreds of posts)
// this is fast and dependency-free; the same retrieve() interface can later be
// backed by pgvector without changing callers.

export function embedModel() {
  return process.env.EMBED_MODEL ?? "openai/text-embedding-3-small";
}

export function embeddingsEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY) && Boolean(process.env.EMBED_MODEL);
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const response = await fetch(`${process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "Co-Create"
    },
    body: JSON.stringify({ model: embedModel(), input: inputs })
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenRouter embeddings failed: ${response.status} ${message}`);
  }
  const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const vectors = (data.data ?? []).map((item) => item.embedding ?? []);
  if (vectors.length !== inputs.length || vectors.some((vector) => vector.length === 0)) {
    throw new Error("OpenRouter embeddings returned an unexpected shape");
  }
  return vectors;
}

export async function embedText(input: string): Promise<number[]> {
  return (await embedTexts([input]))[0];
}

export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dot / magnitude;
}
