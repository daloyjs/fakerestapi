import { toEdgeHandler } from "@daloyjs/core/vercel";
import app from "../src/index.js";

export const config = { runtime: "edge" };

export default toEdgeHandler(app);
