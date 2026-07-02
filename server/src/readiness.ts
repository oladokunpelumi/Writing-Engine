import type { AdminReadiness } from "../../shared/src";
import type { Repository } from "./repository";
import { modelProfile } from "./openrouter";

const MODEL_OVERRIDE_KEYS = [
  "MODEL_DRAFT",
  "MODEL_FRAME",
  "MODEL_SHARPEN",
  "MODEL_DISCOVER",
  "MODEL_SEO",
  "MODEL_IMAGE",
  "MODEL_REPURPOSE",
  "MODEL_REFINE",
  "MODEL_VISUAL_PROMPT",
  "MODEL_SIGNALS_DEEPDIVE",
  "MODEL_SIGNALS_MACRO",
  "MODEL_FINTEL_BRIDGE",
  "MODEL_SYNTHESIS",
  "MODEL_REVIEWGATE",
  "MODEL_STORY",
  "MODEL_CRITIC",
  "MODEL_STUDY_SKILL"
];

export async function designPartnerReadiness(repo: Repository): Promise<AdminReadiness> {
  const stats = await repo.readinessStats();
  const modelOverrides = Object.fromEntries(
    MODEL_OVERRIDE_KEYS.flatMap((key) => {
      const value = process.env[key];
      return value ? [[key, value]] : [];
    })
  );

  return {
    authRequired: process.env.AUTH_REQUIRED === "true",
    inviteConfigured: Boolean(process.env.INVITE_CODE),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    modelProfile: modelProfile(),
    modelOverrides,
    ...stats
  };
}
