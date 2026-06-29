import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";

function repo() {
  return new Repository(openDatabase(":memory:"));
}

describe("shows", () => {
  it("seeds a default essay show pointing at the active voice", () => {
    const r = repo();
    const shows = r.listShows();
    expect(shows.length).toBe(1);
    expect(shows[0].kind).toBe("essay");
    expect(shows[0].voiceId).toBe(r.getVoice().id);
    expect(r.getActiveShow().id).toBe(shows[0].id);
  });

  it("creates a show and switching it sets the active voice", () => {
    const r = repo();
    const gridVoice = r.createVoice("The Grid Voice");
    const show = r.createShow({ name: "The Grid", kind: "grid", description: "", voiceId: gridVoice.id });
    const active = r.setActiveShow(show.id);
    expect(active?.id).toBe(show.id);
    expect(r.getActiveShow().id).toBe(show.id);
    expect(r.getVoice().id).toBe(gridVoice.id);
  });

  it("deletes a show and falls back to a remaining one", () => {
    const r = repo();
    const a = r.listShows()[0];
    const b = r.createShow({ name: "Second", kind: "custom", description: "" });
    r.setActiveShow(b.id);
    expect(r.deleteShow(b.id)).toBe(true);
    expect(r.getActiveShow().id).toBe(a.id);
  });
});
