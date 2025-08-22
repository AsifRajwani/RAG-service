import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { pipeline } from "@xenova/transformers";
import { globSync } from "glob";

type RagChunk = {
  id: string;
  doc: string;
  text: string;
  vector: Float32Array;
};

const app = express();
app.use(bodyParser.json());

const PORT = process.env.RAG_PORT ? Number(process.env.RAG_PORT) : 4100;
const KB_DIR = process.env.RAG_KB_DIR || path.join(process.cwd(), "kb");
const MODEL = process.env.RAG_MODEL || "Xenova/all-MiniLM-L6-v2";

let embedder: any | null = null;
let index: RagChunk[] = [];

/*function chunkText(text: string, maxLen = 380, overlap = 50): string[] {
  const cleaned = text.replace(/\r/g, "");
  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(i + maxLen, cleaned.length);
    chunks.push(cleaned.slice(i, end));
    i = end - overlap;
    if (i < 0) i = 0;
    if (i >= cleaned.length) break;
  }
  return chunks.filter(c => c.trim().length > 0);
}*/

function chunkText(text: string, maxLen = 380): string[] {
  const cleaned = text.replace(/\r/g, "");
  const chunks: string[] = [];
  for (let i = 0; i < cleaned.length; i += maxLen) {
    chunks.push(cleaned.slice(i, i + maxLen));
  }
  return chunks.filter(c => c.trim().length > 0);
}



async function ensureEmbedder() {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", MODEL);
  }
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  await ensureEmbedder();
  const outputs = await embedder(texts, { pooling: "mean", normalize: true });
  const arr = Array.isArray(outputs.data) ? outputs.data : outputs.tolist();
  const rows = Array.isArray(arr[0]) ? arr : [arr];
  return rows.map((row: number[]) => new Float32Array(row));
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1e-8);
}

// POST /ingest  { clear?: boolean }
app.post("/ingest", async (req, res) => {
  try {
    const { clear } = req.body || {};
    if (clear) index = [];

    const files = globSync("**/*.{md,txt}", { cwd: KB_DIR, nodir: true });
    let added = 0;

    for (const file of files) {
      console.error(`Working on file: ${file}`);
      const full = path.join(KB_DIR, file);
      const text = fs.readFileSync(full, "utf8");
      const chunks = chunkText(text);
      console.error(`File: ${file} produced ${chunks.length} chunks`);
    chunks.forEach((c, i) => console.error(`Chunk[${i}]:`, c.slice(0, 60)));
      const vecs = await embed(chunks);
      for (let i = 0; i < chunks.length; i++) {
        index.push({ id: `${file}#${i}`, doc: file, text: chunks[i], vector: vecs[i] });
        added++;
      }
    }

    res.json({ ok: true, files: files.length, chunks: added });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /search?query=...&k=4
app.get("/search", async (req, res) => {
  try {
    const query = String(req.query.query || "");
    const k = Number(req.query.k || 4);
    const filter = String(req.query.filter || "");

    if (!query) return res.status(400).json({ ok: false, error: "query required" });
    if (index.length === 0) return res.status(400).json({ ok: false, error: "index empty; POST /ingest first" });

    const q = filter ? `${query} ${filter}` : query;
    const [qvec] = await embed([q]);

    const scored = index
      .map(c => ({ ...c, score: cosineSim(qvec, c.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(({ id, doc, text, score }) => ({ id, doc, excerpt: text, score: Number(score.toFixed(4)) }));

    res.json({ ok: true, query, k, results: scored });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Health
app.get("/health", (_req, res) => res.json({ ok: true, chunks: index.length, kb: KB_DIR, model: MODEL }));

app.listen(PORT, () => {
  console.error(`RAG service listening on http://localhost:${PORT} (kb=${KB_DIR})`);
  console.error(`First run? POST http://localhost:${PORT}/ingest to build index`);
});
