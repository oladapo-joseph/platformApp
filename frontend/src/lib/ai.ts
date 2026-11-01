/** Model ids as people read them (AI card, admin AI usage). */
const MODELS: Record<string, string> = {
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
};
export const modelName = (id: string) => MODELS[id] ?? id;
