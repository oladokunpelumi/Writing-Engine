import createHash from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import type { VideoSource, VideoSourceRole } from "../../shared/src";
import { rawChat, modelFor, aiProvider } from "./openrouter";

import dns from "node:dns/promises";
import { isIP } from "node:net";

// ---- SSRF Protection & Link Verification ----
export function isPrivateIp(hostnameOrIp: string): boolean {
  const lower = hostnameOrIp.toLowerCase().trim();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1" || lower === "0.0.0.0") return true;

  // Check IPv4 ranges
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);
    if ([a, b, c, d].some((part) => part > 255)) return true;
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 0) return true;
    if (a >= 224) return true; // multicast and reserved
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark range
  }
  if (isIP(lower) === 6) {
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (/^fe[89ab]/.test(lower)) return true; // link local
    if (lower.startsWith("ff")) return true; // multicast
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
  }
  return false;
}

export async function isSafeDestination(hostname: string): Promise<boolean> {
  if (isPrivateIp(hostname)) return false;
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function verifyLinkUrl(urlStr: string): Promise<{ status: "verified" | "unverified"; title?: string; summary?: string }> {
  try {
    let currentUrl = urlStr;
    let redirectCount = 0;
    const maxRedirects = 3;

    while (redirectCount <= maxRedirects) {
      const parsed = new URL(currentUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { status: "unverified", summary: "Blocked: Only HTTP and HTTPS schemes permitted" };
      }

      const safe = await isSafeDestination(parsed.hostname);
      if (!safe) {
        return { status: "unverified", summary: "Blocked: Destination resolves to private network IP range" };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VideoStudioBot/2.0" },
        redirect: "manual"
      });
      clearTimeout(timeout);

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        redirectCount++;
        const nextLocation = res.headers.get("location")!;
        currentUrl = new URL(nextLocation, currentUrl).toString();
        continue;
      }

      if (res.ok) {
        const reader = res.body?.getReader();
        let bodyText = "";
        if (reader) {
          let bytesRead = 0;
          const decoder = new TextDecoder();
          while (bytesRead < 100000) { // Cap at 100KB
            const { done, value } = await reader.read();
            if (done) break;
            bytesRead += value.length;
            bodyText += decoder.decode(value, { stream: true });
          }
        }
        const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : undefined;
        return { status: "verified", title, summary: `Verified HTTP status ${res.status}` };
      }
      return { status: "unverified", summary: `HTTP status ${res.status}` };
    }
    return { status: "unverified", summary: "Blocked: Exceeded maximum redirect hops" };
  } catch (err: any) {
    return { status: "unverified", summary: err.message || "Failed to reach host" };
  }
}

// ---- Image Helper: Downscale to max 1600px dimension ----
export async function downscaleImage(buffer: Buffer, maxDimension = 1600): Promise<{ buffer: Buffer; width: number; height: number; mimeType: string }> {
  try {
    const metadata = await sharp(buffer).metadata();
    let width = metadata.width || 800;
    let height = metadata.height || 600;

    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const resized = await sharp(buffer).resize(width, height, { fit: "inside" }).png().toBuffer();
      return { buffer: resized, width, height, mimeType: "image/png" };
    }
    return { buffer, width, height, mimeType: metadata.format ? `image/${metadata.format}` : "image/png" };
  } catch {
    return { buffer, width: 800, height: 600, mimeType: "image/png" };
  }
}

// ---- Multimodal OCR Stage (typed image-specific results) ----
export async function runMultimodalOcr(images: Array<{ id: string; buffer: Buffer; mimeType: string }>): Promise<Record<string, { text: string; confidence: number }>> {
  const results: Record<string, { text: string; confidence: number }> = {};
  if (images.length === 0) return results;

  if (aiProvider() === "mock") {
    for (const img of images) {
      results[img.id] = { text: `[OCR result for ${img.id}: screenshot depicting evidence/data metrics]`, confidence: 0.95 };
    }
    return results;
  }

  for (let i = 0; i < images.length; i += 4) {
    const batch = images.slice(i, i + 4);
    const contentParts: any[] = [
      {
        type: "text",
        text: `Perform image-specific OCR and describe the visual contents of each screenshot attached.
Respond strictly in JSON format as a JSON array of objects:
[
  {"imageId": "img-1", "ocrText": "exact text and description of image 1", "confidence": 0.95}
]
Input Image IDs: ${batch.map((b) => b.id).join(", ")}`
      }
    ];

    for (const img of batch) {
      const base64 = img.buffer.toString("base64");
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${base64}` }
      });
    }

    try {
      const { content } = await rawChat({
        model: modelFor("video-ingest"),
        system: "You are a precise multimodal OCR engine. Return only JSON array with imageId, ocrText, and confidence score.",
        user: contentParts as any,
        temperature: 0.1
      });

      const parsedMatch = content.match(/\[[\s\S]*\]/);
      if (parsedMatch) {
        const parsed = JSON.parse(parsedMatch[0]);
        for (const item of parsed) {
          if (item.imageId && item.ocrText) {
            results[item.imageId] = { text: item.ocrText, confidence: Number(item.confidence || 0.9) };
          }
        }
      }
    } catch {
      // ignore
    }

    // A missing result is a failure, never invented OCR evidence.
    for (const img of batch) {
      if (!results[img.id]) {
        results[img.id] = { text: "", confidence: 0 };
      }
    }
  }

  return results;
}

// ---- Automatic Role Classifier ----
export function classifySourceRoles(filename: string, text: string): VideoSourceRole[] {
  const lowerName = filename.toLowerCase();
  const lowerText = text.toLowerCase();
  const roles: Set<VideoSourceRole> = new Set();

  if (lowerName.includes("brief") || lowerName.includes("direction") || lowerText.includes("creative brief") || lowerText.includes("narrative arc")) {
    roles.add("narrative");
  }
  if (lowerName.includes("style") || lowerName.includes("visual") || lowerText.includes("color palette") || lowerText.includes("moodboard")) {
    roles.add("visual");
  }
  if (lowerName.includes("reference") || lowerName.includes("blueprint") || lowerText.includes("benchmark")) {
    roles.add("reference");
  }

  roles.add("evidence");
  return Array.from(roles);
}

// ---- Extraction: DOCX Parser ----
export async function extractDocx(buffer: Buffer): Promise<{
  text: string;
  locators: Array<{ id: string; type: string; label: string; startOffset: number; endOffset: number }>;
  images: Array<{ id: string; name: string; mimeType: string; width: number; height: number; buffer: Buffer }>;
  links: Array<{ url: string; title?: string }>;
}> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const expandedBytes = entries.reduce((total, entry) => total + Number(entry.header.size || 0), 0);
  if (expandedBytes > 150 * 1024 * 1024) {
    throw new Error("DOCX expanded content exceeds the 150MB safety limit");
  }
  const docEntry = zip.getEntry("word/document.xml");
  const relsEntry = zip.getEntry("word/_rels/document.xml.rels");

  let text = "";
  const locators: Array<{ id: string; type: string; label: string; startOffset: number; endOffset: number }> = [];
  const links: Array<{ url: string; title?: string }> = [];

  const linkTargetMap: Record<string, string> = {};
  if (relsEntry) {
    const relsXml = relsEntry.getData().toString("utf8");
    const relMatches = relsXml.matchAll(/Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*TargetMode="External"/gi);
    for (const match of relMatches) {
      linkTargetMap[match[1]] = match[2];
    }
  }

  if (docEntry) {
    const xml = docEntry.getData().toString("utf8");

    const hyperlinkMatches = xml.matchAll(/<w:hyperlink[^>]*r:id="([^"]+)"[^>]*>(.*?)<\/w:hyperlink>/gi);
    for (const match of hyperlinkMatches) {
      const target = linkTargetMap[match[1]];
      if (target) {
        const linkText = match[2].replace(/<[^>]+>/g, "").trim();
        links.push({ url: target, title: linkText || target });
      }
    }

    const pMatches = xml.matchAll(/<w:p\b[^>]*>(.*?)<\/w:p>/gi);
    let pCount = 0;
    for (const match of pMatches) {
      const pText = match[1].replace(/<[^>]+>/g, "").trim();
      if (pText) {
        pCount++;
        const start = text.length;
        text += pText + "\n\n";
        const end = text.length;
        locators.push({
          id: `p-${pCount}`,
          type: "paragraph",
          label: `Paragraph ${pCount}`,
          startOffset: start,
          endOffset: end
        });
      }
    }
  }

  const mediaEntries = entries.filter((e) => e.entryName.startsWith("word/media/") && !e.isDirectory);
  if (mediaEntries.length > 100) throw new Error("DOCX contains more than 100 embedded images");
  const images: Array<{ id: string; name: string; mimeType: string; width: number; height: number; buffer: Buffer }> = [];

  for (let i = 0; i < mediaEntries.length; i++) {
    const entry = mediaEntries[i];
    const rawBuffer = entry.getData();
    const { buffer: downscaled, width, height, mimeType } = await downscaleImage(rawBuffer);
    images.push({
      id: `img-${i + 1}`,
      name: path.basename(entry.entryName),
      mimeType,
      width,
      height,
      buffer: downscaled
    });
  }

  return { text, locators, images, links };
}

// ---- Extraction: PDF Parser ----
export async function extractPdf(buffer: Buffer): Promise<{
  text: string;
  locators: Array<{ id: string; type: string; label: string; pageNumber: number }>;
  images: Array<{ id: string; name: string; mimeType: string; width: number; height: number; buffer: Buffer }>;
  truncatedPagePreviews: boolean;
}> {
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText();
    const text = data.text || "";
    const locators: Array<{ id: string; type: string; label: string; pageNumber: number }> = [];
    for (let page = 1; page <= data.total; page++) {
      locators.push({
        id: `page-${page}`,
        type: "page",
        label: `Page ${page}`,
        pageNumber: page
      });
    }

    const lowText = text.trim().length < Math.max(40, data.total * 20);
    if (!lowText) return { text, locators, images: [], truncatedPagePreviews: false };

    const previewLimit = Math.min(data.total, 20);
    const screenshots = await parser.getScreenshot({
      desiredWidth: 1400,
      first: previewLimit,
      imageBuffer: true,
      imageDataUrl: false
    });
    const images = screenshots.pages.map((page) => ({
      id: `pdf-page-${page.pageNumber}`,
      name: `page-${page.pageNumber}.png`,
      mimeType: "image/png",
      width: page.width,
      height: page.height,
      buffer: Buffer.from(page.data)
    }));

    return {
      text,
      locators,
      images,
      truncatedPagePreviews: data.total > previewLimit
    };
  } finally {
    await parser.destroy();
  }
}

export interface ProcessFileResult {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  roles: VideoSourceRole[];
  extractedText: string;
  warnings: string[];
  images: Array<{
    id: string;
    name: string;
    mimeType: string;
    width: number;
    height: number;
    ocrText?: string;
    ocrConfidence?: number;
    dataUrl: string;
  }>;
  links: Array<{ url: string; title?: string; status: "unverified" | "verified"; summary?: string }>;
  locators: Array<{ id: string; type: string; label: string; startOffset?: number; endOffset?: number; pageNumber?: number }>;
  chunks: Array<{ chunkIndex: number; chunkText: string; locatorType: string; locatorValue: string }>;
}

// ---- Process Single Source File with Cleanup Guarantee ----
export async function processSourceFile(
  filePath: string,
  originalFilename: string,
  mimeType: string,
  userRoles?: VideoSourceRole[],
  allowExternalAi = true
): Promise<ProcessFileResult> {
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch (err: any) {
    throw new Error(`Failed to read uploaded file: ${err.message}`);
  } finally {
    // Always clean up temp file post-read
    await fs.unlink(filePath).catch(() => {});
  }

  const checksum = createHash.createHash("sha256").update(fileBuffer).digest("hex");
  const sizeBytes = fileBuffer.length;
  const warnings: string[] = [];

  let extractedText = "";
  let rawImages: Array<{ id: string; name: string; mimeType: string; width: number; height: number; buffer: Buffer }> = [];
  let extractedLinks: Array<{ url: string; title?: string; status: "unverified" | "verified"; summary?: string }> = [];
  let locators: Array<{ id: string; type: string; label: string; startOffset?: number; endOffset?: number; pageNumber?: number }> = [];

  const lowerName = originalFilename.toLowerCase();

  if (lowerName.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    if (fileBuffer.subarray(0, 2).toString("binary") !== "PK") {
      throw new Error("The uploaded DOCX does not have a valid ZIP file signature");
    }
    const docxResult = await extractDocx(fileBuffer);
    extractedText = docxResult.text;
    locators = docxResult.locators;
    rawImages = docxResult.images;
    extractedLinks = docxResult.links.map((l) => ({ ...l, status: "unverified" }));
  } else if (lowerName.endsWith(".pdf") || mimeType.includes("pdf")) {
    if (fileBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("The uploaded PDF does not have a valid PDF file signature");
    }
    const pdfResult = await extractPdf(fileBuffer);
    extractedText = pdfResult.text;
    locators = pdfResult.locators;
    rawImages = pdfResult.images;
    if (pdfResult.images.length > 0) {
      warnings.push("Low-text/scanned PDF detected. Page previews were prepared for consent-gated OCR.");
    }
    if (pdfResult.truncatedPagePreviews) {
      warnings.push("Scanned PDF OCR is limited to the first 20 pages for safety and cost control.");
    }
  } else {
    if (fileBuffer.includes(0)) throw new Error("Plain-text and Markdown uploads cannot contain binary null bytes");
    // Markdown or plain text
    extractedText = fileBuffer.toString("utf8");
    const paragraphs = extractedText.split(/\n\s*\n/);
    paragraphs.forEach((p, idx) => {
      if (p.trim()) {
        locators.push({
          id: `p-${idx + 1}`,
          type: "paragraph",
          label: `Section ${idx + 1}`
        });
      }
    });
  }

  // Extract plain-text URLs from extractedText
  const textUrls = extractedText.match(/(https?:\/\/[^\s<>"'\(\)]+)/gi) || [];
  for (const url of textUrls) {
    if (!extractedLinks.some((l) => l.url === url)) {
      extractedLinks.push({ url, title: url, status: "unverified" });
    }
  }

  const ocrResults = allowExternalAi || aiProvider() === "mock" ? await runMultimodalOcr(rawImages) : {};
  if (rawImages.length > 0 && !allowExternalAi && aiProvider() === "openrouter") {
    warnings.push("Screenshot OCR skipped because external AI processing has not been approved for this project.");
  }
  const processedImages = rawImages.map((img) => ({
    id: img.id,
    name: img.name,
    mimeType: img.mimeType,
    width: img.width,
    height: img.height,
    ocrText: ocrResults[img.id]?.text || "",
    ocrConfidence: ocrResults[img.id]?.confidence ?? 0,
    buffer: img.buffer,
    dataUrl: `data:${img.mimeType};base64,${img.buffer.toString("base64")}`
  }));

  const roles = userRoles && userRoles.length > 0 ? userRoles : classifySourceRoles(originalFilename, extractedText);

  const chunks: Array<{ chunkIndex: number; chunkText: string; locatorType: string; locatorValue: string }> = [];
  const CHUNK_SIZE = 1200;
  const CHUNK_OVERLAP = 200;
  let index = 0;

  if (extractedText.trim()) {
    let start = 0;
    while (start < extractedText.length) {
      const end = Math.min(start + CHUNK_SIZE, extractedText.length);
      const chunkText = extractedText.slice(start, end);
      chunks.push({
        chunkIndex: index,
        chunkText,
        locatorType: "char-range",
        locatorValue: `Chars ${start}-${end}`
      });
      index++;
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
  }

  // Include screenshot OCR evidence chunks so treatments and scripts can retrieve it
  for (const img of processedImages) {
    if (img.ocrText) {
      chunks.push({
        chunkIndex: index++,
        chunkText: `[Screenshot Evidence ${img.id} (${img.name})]\n${img.ocrText}`,
        locatorType: "image",
        locatorValue: img.id
      });
    }
  }

  return {
    filename: originalFilename,
    mimeType,
    sizeBytes,
    checksum,
    roles,
    extractedText,
    warnings,
    images: processedImages,
    links: extractedLinks,
    locators,
    chunks
  };
}
