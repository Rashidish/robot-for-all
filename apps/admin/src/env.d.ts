/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Supabase, as the signed-in person (row-level security applies). */
    supabase: import('@supabase/supabase-js').SupabaseClient;
    /** The signed-in person, or null. */
    user: { id: string; email: string } | null;
    /** Their back-office roles (only read once MFA is done). */
    roles: import('./lib/roles').Role[];
  }
}
