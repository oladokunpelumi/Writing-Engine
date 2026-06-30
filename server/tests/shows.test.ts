import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";

async function repo() {
  return new Repository(await openDatabase());
}

describe("shows", () => {
  it("seeds a default essay show pointing at the active voice", async () => {
    const r = await repo();
    const shows = await r.listShows();
    expect(shows.length).toBe(1);
    expect(shows[0].kind).toBe("essay");
    expect(shows[0].voiceId).toBe((await r.getVoice()).id);
    expect((await r.getActiveShow()).id).toBe(shows[0].id);
  });

  it("creates a show and switching it sets the active voice", async () => {
    const r = await repo();
    const gridVoice = await r.createVoice("The Grid Voice");
    const show = await r.createShow({ name: "The Grid", kind: "grid", description: "", voiceId: gridVoice.id });
    const active = await r.setActiveShow(show.id);
    expect(active?.id).toBe(show.id);
    expect((await r.getActiveShow()).id).toBe(show.id);
    expect((await r.getVoice()).id).toBe(gridVoice.id);
  });

  it("deletes a show and falls back to a remaining one", async () => {
    const r = await repo();
    const a = (await r.listShows())[0];
    const b = await r.createShow({ name: "Second", kind: "custom", description: "" });
    await r.setActiveShow(b.id);
    expect(await r.deleteShow(b.id)).toBe(true);
    expect((await r.getActiveShow()).id).toBe(a.id);
  });
});
