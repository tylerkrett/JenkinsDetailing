import { quoteRouter } from "~/server/api/routers/quote";
import { siteRouter } from "~/server/api/routers/site";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  site: siteRouter,
  quote: quoteRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
