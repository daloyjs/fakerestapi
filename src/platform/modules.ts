import type { App } from "@daloyjs/core";

import { docsModule } from "../modules/docs/index.js";
import { relationshipsModule } from "../modules/relationships/index.js";
import { resourcesModule } from "../modules/resources/index.js";

export function registerModules(app: App): void {
  app.register(resourcesModule);
  app.register(relationshipsModule);
  app.register(docsModule());
}