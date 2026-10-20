import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

/**
 * Manual auth for Edge Functions.
 *
 * Supabase Auth may issue ES256 JWTs that the Edge gateway cannot verify
 * with HS256-only gateway checks. We deploy with --no-verify-jwt and
 * validate the session here via supabase.auth.getUser().
 */
export async function requireAuth(req: Request): Promise<
    { user: { id: string; email?: string } } | { error: Response }
> {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return {
            error: new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            ),
        };
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
            global: { headers: { Authorization: authHeader } },
        }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            error: new Response(
                JSON.stringify({ error: "Invalid or expired token" }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            ),
        };
    }

    return { user };
}
