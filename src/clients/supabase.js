// configura o banco de dados supabase
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  db: { schema: "public" },
  global: {
    fetch: (url, opts) => fetch(url, { ...opts, timeout: 30000 }),
  },
});