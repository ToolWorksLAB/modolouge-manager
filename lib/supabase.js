import { createClient } from "@supabase/supabase-js";
let service;
export function authClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
export function backend() {
  service ||= createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return service;
}
export async function checked(operation) {
  const { data, error } = await operation;
  if (error)
    throw Object.assign(new Error("Database operation failed."), {
      code: error.code,
      databaseMessage: error.message,
    });
  return data;
}
