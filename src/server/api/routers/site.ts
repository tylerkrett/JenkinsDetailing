import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const siteRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ ok: true as const })),
});
