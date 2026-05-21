import { toFetchHandler } from "@daloyjs/core/vercel";
import app from "../src/index.js";

export default toFetchHandler(app);
