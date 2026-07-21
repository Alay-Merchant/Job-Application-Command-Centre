import OpenAI from "openai";
import { z } from "zod";

export async function structured<T extends z.ZodTypeAny>(schema: T, prompt: string, model = "gpt-4o-mini"): Promise<z.infer<T>> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // OpenAI structured outputs require an object at the document root. Some useful
  // app responses are lists, so wrap only those for transport and unwrap before
  // validating against the original contract.
  const isArrayRoot = (schema._def as { typeName?: string }).typeName === "ZodArray";
  const responseSchema = isArrayRoot ? z.object({ items: schema }) : schema;
  const json_schema = { name: "response", strict: true, schema: zodToJsonSchema(responseSchema) };
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await openai.chat.completions.create({ model, messages: [{ role: "system", content: "Return only data that conforms to the provided JSON schema. Be accurate and concise." }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema } as never });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/connection error/i.test(message)) {
        throw new Error("Could not reach OpenAI. Restart the local app with npm run dev so it can use your Windows certificate store, then try again.");
      }
      throw error;
    }
    try {
      const value = JSON.parse(response.choices[0]?.message.content || "{}");
      return schema.parse(isArrayRoot ? value.items : value);
    } catch (error) { if (attempt === 1) throw new Error("AI returned an invalid structured response. Please try again."); }
  }
  throw new Error("AI generation failed.");
}
// OpenAI's strict schema accepts this compact conversion for the schemas used here.
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def as { typeName: string; values?: string[]; shape?: () => Record<string, z.ZodTypeAny>; type?: z.ZodTypeAny; minValue?: number; maxValue?: number; checks?: Array<{ kind: string; value: number }> };
  if (def.typeName === "ZodString") return { type: "string" };
  if (def.typeName === "ZodNumber") return { type: "integer" };
  if (def.typeName === "ZodEnum") return { type: "string", enum: def.values };
  if (def.typeName === "ZodArray") return { type: "array", items: zodToJsonSchema(def.type!) };
  if (def.typeName === "ZodObject") { const shape = def.shape!(); return { type: "object", properties: Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, zodToJsonSchema(value)])), required: Object.keys(shape), additionalProperties: false }; }
  return {};
}
