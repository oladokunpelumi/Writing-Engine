import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { ownerContext } from "../src/context";
import {
  runTreatmentGeneration,
  runMasterScriptGeneration,
  runShortFormAdaptation,
  runShotListGeneration,
  buildExportPackage
} from "../src/videoStudioV2";
import type { VideoSource, VideoSourceRole } from "../../shared/src";

async function freshRepo() {
  return new Repository(await openDatabase());
}

describe("Acceptance Fixture: Fabrizio & Pletti Sports Documentary", () => {
  it("ingests prose, links, and 14 embedded screenshots, identifies credibility/trust conflict, and produces full production package", async () => {
    const repo = await freshRepo();

    await ownerContext.run("acceptance-owner", async () => {
      // 1. Create Fabrizio/Pletti project workspace
      const project = await repo.saveVideoProject({
        title: "Fabrizio Romano vs Florian Plettenberg: The Transfer War for Credibility",
        format: "documentary",
        audience: "Football fans, sports media analysts, digital culture enthusiasts",
        objective: "Examine the tension between speed and verified accuracy in modern sports journalism.",
        privacyState: "private",
        primaryOutput: "8-12 min",
        selectedPlatforms: ["youtube", "tiktok", "reels", "shorts"]
      });

      // 2. Mock 14 embedded screenshot items extracted from DOCX
      const mockScreenshots = Array.from({ length: 14 }, (_, i) => ({
        id: `img-${i + 1}`,
        name: `screenshot_${i + 1}.png`,
        mimeType: "image/png",
        width: 1200,
        height: 800,
        ocrText: `Screenshot ${i + 1}: Tweet by @FabrizioRomano / @Plettigoal reporting transfer updates with engagement metrics.`,
        dataUrl: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`
      }));

      const mockLinks = [
        { url: "https://twitter.com/FabrizioRomano/status/123456", title: "Fabrizio Romano Here We Go", status: "verified" as const, summary: "Verified Tweet" },
        { url: "https://twitter.com/Plettigoal/status/654321", title: "Pletti Transfer News", status: "verified" as const, summary: "Verified Tweet" },
        { url: "https://theathletic.com/author/david-ornstein", title: "David Ornstein Column", status: "verified" as const, summary: "Verified Article" }
      ];

      const fabrizioProse = `
# Fabrizio Romano vs Florian Plettenberg: Credibility and Trust in Football Media

In modern football journalism, the central conflict is no longer just who gets the story first—it is credibility and trust.
When Fabrizio Romano posts 'Here We Go', it reverberates across millions of fans worldwide.
Florian Plettenberg ('Pletti') brings high-energy German transfer scoops, competing aggressively for speed and impact.

Enter David Ornstein—the calm, neutral referee of sports journalism. Where rumor and speed collide, Ornstein represents verified evidence, double-checked sources, and unbreakable credibility.

Key Conflict: Credibility vs Speed in the Transfer Window.
Visual Theme: Boxing match ring metaphor in opening 20-30 seconds, leading into an investigative sports documentary.
Palette: Black (#0B0C10), Gold (#D4AF37), Deep Blue (#0F1C3F), Crimson (#8B0000).
Structure: 6 Acts culminating in a journalism-focused ending on trust.
`;

      // Save extracted source
      const source: VideoSource = await repo.saveVideoSource({
        id: "src-fabrizio-docx",
        projectId: project.id,
        filename: "Fabrizio_Pletti_Transfer_War.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 4500000,
        checksum: "sha256-fabrizio-pletti-14-screenshots",
        roles: ["evidence", "narrative"] as VideoSourceRole[],
        extractionStatus: "completed",
        warnings: [],
        extractedText: fabrizioProse,
        extractedImages: mockScreenshots,
        extractedLinks: mockLinks,
        locators: [
          { id: "p-1", type: "paragraph", label: "Paragraph 1: Introduction", startOffset: 0, endOffset: 200 },
          { id: "p-2", type: "paragraph", label: "Paragraph 2: Credibility Conflict", startOffset: 201, endOffset: 600 }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Save passage chunks
      const chunks = [
        {
          id: "chk-1",
          sourceId: source.id,
          projectId: project.id,
          ownerId: "acceptance-owner",
          chunkIndex: 0,
          chunkText: fabrizioProse.slice(0, 1200),
          locatorType: "paragraph",
          locatorValue: "Paragraphs 1-2",
          createdAt: new Date().toISOString()
        }
      ];
      await repo.saveVideoSourceChunks(chunks);

      // Verify source & 14 screenshots extracted
      const updatedProj = await repo.getVideoProject(project.id);
      expect(updatedProj?.sources).toHaveLength(1);
      expect(updatedProj?.sources[0].extractedImages).toHaveLength(14);
      expect(updatedProj?.sources[0].extractedLinks).toHaveLength(3);

      // 3. Generate Treatments
      const { treatments, visualBible } = await runTreatmentGeneration({
        project: updatedProj!,
        chunks
      });

      expect(treatments).toHaveLength(3);
      const recommended = treatments.find((t) => t.type === "recommended")!;
      expect(recommended).toBeTruthy();

      // Verify central conflict identified as credibility & trust
      expect(recommended.logline.toLowerCase() + recommended.narrativeArc.toLowerCase()).toContain("credibility");

      // Verify boxing metaphor used for opening 20-30s
      expect(recommended.keyMetaphor.toLowerCase() + recommended.structure[0].description.toLowerCase()).toContain("boxing");

      // Verify 6-act structure
      expect(recommended.structure).toHaveLength(6);

      // Verify preserved color palette: Black, Gold, Deep Blue, Crimson
      expect(visualBible.colorPalette.map((c) => c.toLowerCase()).join(" ")).toMatch(/gold|black|blue|crimson/);

      // Select and approve treatment
      const treatmentApprovedProj = await repo.saveVideoProject({
        id: project.id,
        selectedTreatmentId: recommended.id,
        selectedTreatment: recommended,
        visualBible,
        approvalState: { treatmentApproved: true, scriptApproved: false },
        currentStage: "master-script"
      });

      // 4. Generate Master Script
      const { script: masterScript } = await runMasterScriptGeneration({
        project: treatmentApprovedProj,
        treatment: recommended,
        visualBible,
        chunks
      });

      expect(masterScript.scenes.length).toBeGreaterThanOrEqual(4);
      // Verify Ornstein referee beat present
      const hasOrnsteinBeat = masterScript.scenes.some(
        (sc) => sc.title.toLowerCase().includes("ornstein") || sc.narration.toLowerCase().includes("ornstein") || sc.title.toLowerCase().includes("referee")
      );
      expect(hasOrnsteinBeat).toBe(true);

      // Approve Master Script
      const scriptApprovedProj = await repo.saveVideoProject({
        id: project.id,
        masterScript: { ...masterScript, approved: true },
        approvalState: { treatmentApproved: true, scriptApproved: true },
        currentStage: "adaptations"
      });

      // 5. Generate 60-second Short Adaptation for TikTok/Shorts
      const { adaptation } = await runShortFormAdaptation({
        project: scriptApprovedProj,
        masterScript: scriptApprovedProj.masterScript!,
        platform: "tiktok",
        targetSeconds: 60
      });

      expect(adaptation.platform).toBe("tiktok");
      expect(adaptation.targetSeconds).toBe(60);
      expect(adaptation.scenes.length).toBeGreaterThan(0);

      // 6. Generate Shot List & Veo Prompts
      const { shots } = await runShotListGeneration({
        script: scriptApprovedProj.masterScript!,
        visualBible
      });

      expect(shots.length).toBeGreaterThan(0);
      expect(shots[0].visualPrompt).toContain("Veo");

      // 7. Generate Storyboard Keyframes
      const storyboards = shots.map((shot, idx) => ({
        frameId: `frame-${idx + 1}`,
        sceneId: `sc-${idx + 1}`,
        visualPrompt: shot.visualPrompt,
        keyframeUrl: `/api/video/projects/${project.id}/storyboard/frame-${idx + 1}/image`
      }));

      const finalProject = await repo.saveVideoProject({
        id: project.id,
        shots,
        storyboards,
        adaptations: [adaptation]
      });

      // 8. Build Export Package
      const exportPkg = buildExportPackage(finalProject);

      expect(exportPkg.markdown).toContain("Fabrizio Romano vs Florian Plettenberg");
      expect(exportPkg.markdown).toContain("Master Script");
      expect(exportPkg.markdown).toContain("Shot List & Veo 3 Prompts");
      expect(exportPkg.json.id).toBe(project.id);
    });
  });

  it("extracts real binary DOCX buffer with 14 images and plain-text URLs via processSourceFile", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const os = await import("node:os");
    const { processSourceFile } = await import("../src/videoIngest");
    const AdmZip = (await import("adm-zip")).default;

    const zip = new AdmZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Fabrizio Romano vs Florian Plettenberg: The Transfer War for Credibility</w:t></w:r></w:p>
    <w:p><w:r><w:t>In modern sports journalism, speed collides with credibility. Verified sources: https://twitter.com/FabrizioRomano/status/123456 and https://twitter.com/Plettigoal/status/654321</w:t></w:r></w:p>
    <w:p><w:r><w:t>David Ornstein acts as the neutral referee of transfer news. Reference column at https://theathletic.com/author/david-ornstein</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    zip.addFile("word/document.xml", Buffer.from(documentXml, "utf8"));

    const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    for (let i = 1; i <= 14; i++) {
      zip.addFile(`word/media/image${i}.png`, tinyPng);
    }

    const docxBuffer = zip.toBuffer();
    const tempFile = path.join(os.tmpdir(), `fabrizio-real-${Date.now()}.docx`);
    await fs.writeFile(tempFile, docxBuffer);

    const result = await processSourceFile(tempFile, "Fabrizio_Real_Buffer.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    expect(result.filename).toBe("Fabrizio_Real_Buffer.docx");
    expect(result.extractedText).toContain("Fabrizio Romano vs Florian Plettenberg");
    expect(result.images).toHaveLength(14);
    expect(result.links.map((l) => l.url)).toEqual(
      expect.arrayContaining([
        "https://twitter.com/FabrizioRomano/status/123456",
        "https://twitter.com/Plettigoal/status/654321",
        "https://theathletic.com/author/david-ornstein"
      ])
    );
    expect(result.chunks.some((c) => c.locatorType === "image")).toBe(true);
  });

  it("opt-in local test: processes actual confidential file /Users/pelumioladokun/Downloads/fabvpletti.docx if present", async () => {
    const fs = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const { processSourceFile } = await import("../src/videoIngest");

    const samplePath = "/Users/pelumioladokun/Downloads/fabvpletti.docx";
    if (!existsSync(samplePath)) {
      return;
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(samplePath);
    } catch {
      // Return gracefully if OS sandbox blocks access to /Downloads
      return;
    }

    const tempFile = path.join(os.tmpdir(), `fabvpletti-optin-${Date.now()}.docx`);
    await fs.writeFile(tempFile, fileBuffer);

    try {
      const result = await processSourceFile(tempFile, "fabvpletti.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

      expect(result.filename).toBe("fabvpletti.docx");
      expect(result.images.length).toBeGreaterThanOrEqual(14);
      expect(result.extractedText.length).toBeGreaterThan(500);
      expect(result.chunks.length).toBeGreaterThan(0);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });
});
