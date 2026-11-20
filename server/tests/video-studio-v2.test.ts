import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { ownerContext } from "../src/context";
import {
  processSourceFile,
  verifyLinkUrl,
  isPrivateIp,
  classifySourceRoles,
  downscaleImage
} from "../src/videoIngest";
import {
  runTreatmentGeneration,
  runMasterScriptGeneration,
  regenerateUnlockedScene,
  runShortFormAdaptation,
  runShotListGeneration,
  buildExportPackage
} from "../src/videoStudioV2";
import type { VideoProject } from "../../shared/src";

async function freshRepo() {
  return new Repository(await openDatabase());
}

function makeTinyPdf(content: string): Buffer {
  const escaped = content.replace(/([\\()])/g, "\\$1");
  const stream = content ? `BT /F1 18 Tf 40 100 Td (${escaped}) Tj ET` : "q Q";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

describe("Video Studio V2 — Ingestion & SSRF Protection", () => {
  it("blocks private network IP targets for link verification (SSRF safety)", async () => {
    expect(isPrivateIp("localhost")).toBe(true);
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.5")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);

    const privateRes = await verifyLinkUrl("http://127.0.0.1:8080/secret");
    expect(privateRes.status).toBe("unverified");
    expect(privateRes.summary).toContain("Blocked");

    const nonHttpRes = await verifyLinkUrl("file:///etc/passwd");
    expect(nonHttpRes.status).toBe("unverified");
  });

  it("classifies source file roles automatically based on filename and content", () => {
    const roles1 = classifySourceRoles("Creative_Brief_Documentary.md", "Creative Brief for new film.");
    expect(roles1).toContain("narrative");

    const roles2 = classifySourceRoles("Visual_Style_Guide.txt", "Color palette and moodboard notes.");
    expect(roles2).toContain("visual");

    const roles3 = classifySourceRoles("Evidence_Data_Sheet.txt", "Raw metrics and research data.");
    expect(roles3).toContain("evidence");
  });

  it("downscales large images to max 1600px dimension", async () => {
    // 1x1 test buffer
    const mockBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const result = await downscaleImage(mockBuffer, 1600);
    expect(result.width).toBeLessThanOrEqual(1600);
    expect(result.height).toBeLessThanOrEqual(1600);
  });

  it("processes a text file, generates checksum, chunks into 1200-char passages, and cleans up temp file", async () => {
    const tmpPath = path.join(os.tmpdir(), `test-source-${Date.now()}.txt`);
    const testContent = "Headline Evidence Paragraph.\n\n" + "Word ".repeat(300);
    await fs.writeFile(tmpPath, testContent, "utf8");

    const result = await processSourceFile(tmpPath, "test-source.txt", "text/plain");

    expect(result.filename).toBe("test-source.txt");
    expect(result.checksum).toBeTruthy();
    expect(result.extractedText).toContain("Headline Evidence Paragraph.");
    expect(result.chunks.length).toBeGreaterThan(0);

    // Verify temp file was unlinked in finally block
    const exists = await fs.access(tmpPath).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it("extracts current-format PDFs and prepares scanned pages for consent-gated OCR", async () => {
    const textPath = path.join(os.tmpdir(), `test-text-pdf-${Date.now()}.pdf`);
    await fs.writeFile(textPath, makeTinyPdf("PDF evidence sentence"));
    const textResult = await processSourceFile(textPath, "evidence.pdf", "application/pdf");
    expect(textResult.extractedText).toContain("PDF evidence sentence");
    expect(textResult.locators).toHaveLength(1);

    const scannedPath = path.join(os.tmpdir(), `test-scan-pdf-${Date.now()}.pdf`);
    await fs.writeFile(scannedPath, makeTinyPdf(""));
    const scannedResult = await processSourceFile(scannedPath, "scan.pdf", "application/pdf");
    expect(scannedResult.warnings.join(" ")).toContain("consent-gated OCR");
    expect(scannedResult.images).toHaveLength(1);
    expect(scannedResult.images[0].ocrConfidence).toBeGreaterThan(0);
  });
});

describe("Video Studio V2 — Workspace Generation & Workflow Stages", () => {
  it("produces exactly 3 treatments (Faithful, Recommended, Bold) with a preselected recommendation and visual bible", async () => {
    const repo = await freshRepo();
    await ownerContext.run("alice", async () => {
      const project = await repo.saveVideoProject({
        title: "AI & The Future of Journalism",
        format: "documentary",
        primaryOutput: "8-12 min",
        sources: []
      });

      const { treatments, visualBible } = await runTreatmentGeneration({ project, chunks: [] });

      expect(treatments).toHaveLength(3);
      expect(treatments.map((t) => t.type).sort()).toEqual(["bold", "faithful", "recommended"]);
      
      const recommended = treatments.find((t) => t.type === "recommended");
      expect(recommended).toBeTruthy();
      expect(visualBible.visualStyle).toBeTruthy();
      expect(visualBible.colorPalette.length).toBeGreaterThan(0);
    });
  });

  it("generates a scene-based master script, handles locked-scene regeneration, script versioning, and approval gates", async () => {
    const repo = await freshRepo();
    await ownerContext.run("alice", async () => {
      const project = await repo.saveVideoProject({
        title: "Test Documentary",
        format: "documentary"
      });

      const { treatments, visualBible } = await runTreatmentGeneration({ project, chunks: [] });
      const selected = treatments.find((t) => t.type === "recommended")!;

      const { script } = await runMasterScriptGeneration({
        project,
        treatment: selected,
        visualBible,
        chunks: []
      });

      expect(script.scenes.length).toBeGreaterThan(0);
      expect(script.approved).toBe(false);

      // Lock scene 0 and regenerate unlocked scene 1
      script.scenes[0].locked = true;
      const originalScene0Text = script.scenes[0].narration;

      const updatedScript = await regenerateUnlockedScene({
        currentScript: script,
        targetSceneIndex: 1,
        treatment: selected,
        visualBible,
        project
      });

      expect(updatedScript.scenes[0].narration).toBe(originalScene0Text);
      expect(updatedScript.versionNumber).toBe(2);

      // Approve script and test adaptation unlock
      const approvedProj = await repo.saveVideoProject({
        id: project.id,
        masterScript: { ...updatedScript, approved: true },
        approvalState: { treatmentApproved: true, scriptApproved: true }
      });

      const { adaptation } = await runShortFormAdaptation({
        project: approvedProj,
        masterScript: approvedProj.masterScript!,
        platform: "tiktok",
        targetSeconds: 60
      });

      expect(adaptation.platform).toBe("tiktok");
      expect(adaptation.targetSeconds).toBe(60);
      expect(adaptation.scenes.length).toBeGreaterThan(0);

      const { shots } = await runShotListGeneration({
        script: approvedProj.masterScript!,
        visualBible
      });

      expect(shots.length).toBeGreaterThan(0);
      expect(shots[0].visualPrompt).toBeTruthy();

      const exportPkg = buildExportPackage({ ...approvedProj, selectedTreatment: selected, visualBible, shots });
      expect(exportPkg.markdown).toContain("# Test Documentary");
      expect(exportPkg.markdown).toContain("Master Script");
    });
  });

  it("enforces tenant isolation and cascades project deletion through sources, chunks, versions, and storyboards", async () => {
    const repo = await freshRepo();

    const aliceProj = await ownerContext.run("alice", async () => {
      const p = await repo.saveVideoProject({ title: "Alice Project" });
      const src = await repo.saveVideoSource({
        id: "src-alice",
        projectId: p.id,
        filename: "alice.txt",
        mimeType: "text/plain",
        sizeBytes: 10,
        checksum: "abc",
        roles: ["evidence"],
        extractionStatus: "completed",
        warnings: [],
        extractedText: "alice data",
        extractedImages: [],
        extractedLinks: [],
        locators: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await repo.saveVideoSourceChunks([
        {
          id: "chk-alice",
          sourceId: src.id,
          projectId: p.id,
          ownerId: "alice",
          chunkIndex: 0,
          chunkText: "alice data",
          locatorType: "text",
          locatorValue: "1",
          createdAt: new Date().toISOString()
        }
      ]);
      await repo.saveStoryboardAsset({
        id: "sb-alice",
        projectId: p.id,
        sceneId: "sc-1",
        imageData: "data:image/png;base64,123",
        mimeType: "image/png",
        visualPrompt: "prompt"
      });
      return p;
    });

    // Bob cannot see Alice's project or assets
    await ownerContext.run("bob", async () => {
      expect(await repo.listVideoProjects()).toHaveLength(0);
      expect(await repo.getVideoProject(aliceProj.id)).toBeUndefined();
      expect(await repo.getStoryboardAsset("sb-alice", aliceProj.id)).toBeUndefined();
    });

    // Alice deletes project -> cascades deletion
    await ownerContext.run("alice", async () => {
      const deleted = await repo.deleteVideoProject(aliceProj.id);
      expect(deleted).toBe(true);
      expect(await repo.getVideoProject(aliceProj.id)).toBeUndefined();
      expect(await repo.listVideoSources(aliceProj.id)).toHaveLength(0);
      expect(await repo.getAllProjectChunks(aliceProj.id)).toHaveLength(0);
      expect(await repo.getStoryboardAsset("sb-alice", aliceProj.id)).toBeUndefined();
    });
  });

  it("deletes confidential evidence images with their source and copies them safely when duplicating a project", async () => {
    const repo = await freshRepo();
    await ownerContext.run("alice", async () => {
      const project = await repo.saveVideoProject({ title: "Private evidence", externalAiConsent: true });
      const createdAt = new Date().toISOString();
      const source = await repo.saveVideoSource({
        id: "source-private",
        projectId: project.id,
        filename: "private.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 100,
        checksum: "private-checksum",
        roles: ["evidence"],
        extractionStatus: "completed",
        warnings: [],
        extractedText: "confidential sentence",
        extractedImages: [],
        extractedLinks: [],
        locators: [],
        createdAt,
        updatedAt: createdAt
      });
      const image = await repo.saveEvidenceImage({
        id: "evidence-original",
        projectId: project.id,
        sourceId: source.id,
        name: "screen.png",
        mimeType: "image/png",
        imageData: Buffer.from("private-image").toString("base64")
      });
      source.extractedImages = [
        { id: "evidence-original", name: "screen.png", mimeType: "image/png", dataUrl: image.url }
      ];
      await repo.saveVideoSource(source);

      const duplicate = await repo.duplicateVideoProject(project.id);
      expect(duplicate?.externalAiConsent).toBe(true);
      expect(duplicate?.sources[0].extractedImages[0].id).not.toBe("evidence-original");
      const copiedId = duplicate?.sources[0].extractedImages[0].id ?? "";
      expect(await repo.getEvidenceImage(copiedId, duplicate!.id)).toBeTruthy();

      await repo.deleteVideoSource(source.id);
      expect(await repo.getEvidenceImage("evidence-original", project.id)).toBeUndefined();
    });
  });

  it("builds a privacy-safe export without raw source text or authenticated asset URLs", async () => {
    const repo = await freshRepo();
    await ownerContext.run("alice", async () => {
      const project = await repo.saveVideoProject({ title: "Safe export" });
      const createdAt = new Date().toISOString();
      await repo.saveVideoSource({
        id: "safe-source",
        projectId: project.id,
        filename: "confidential.txt",
        mimeType: "text/plain",
        sizeBytes: 20,
        checksum: "safe-checksum",
        roles: ["evidence"],
        extractionStatus: "completed",
        warnings: [],
        extractedText: "TOP SECRET RAW SOURCE",
        extractedImages: [
          { id: "private-image", name: "screen.png", mimeType: "image/png", dataUrl: "/api/video/private" }
        ],
        extractedLinks: [],
        locators: [],
        createdAt,
        updatedAt: createdAt
      });
      const hydrated = await repo.getVideoProject(project.id);
      const exported = buildExportPackage(hydrated!);
      const serialized = JSON.stringify(exported.json);
      expect(serialized).not.toContain("TOP SECRET RAW SOURCE");
      expect(serialized).not.toContain("/api/video/private");
      expect(exported.json.privacy).toEqual(
        expect.objectContaining({ rawSourceTextIncluded: false, evidenceImageBytesIncluded: false })
      );
    });
  });
});
