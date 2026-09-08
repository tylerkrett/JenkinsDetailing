/**
 * The content interface. Every page, component and scene act reads through this module
 * and never touches a data source directly. Phase 1 is backed by JSON in the repo; a
 * database implementation with the same signatures can replace it later.
 */
export {
  getPackages,
  getPages,
  getProcess,
  getReviews,
  getService,
  getServices,
  getSettings,
  getWork,
  getWorkPair,
} from "./json";
export type {
  Package,
  ProcessedImage,
  ProcessStep,
  QuoteInput,
  Review,
  ReviewSource,
  Service,
  SitePages,
  SiteSettings,
  VehicleSize,
  Where,
  WorkPair,
} from "./schema";
