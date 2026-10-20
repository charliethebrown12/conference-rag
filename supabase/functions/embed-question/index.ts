import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

/**
 * embed-question
 * --------------
 * Browser sends a question → we embed it with OpenAI server-side →
 * return the 1,536-dim vector so the client can call match_sentences().
 *
 * Why an Edge Function? The OpenAI API key must never ship to the browser.
 */
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const authResult = await requireAuth(req);
    if ("error" in authResult) return authResult.error;

    try {
        const { question } = await req.json();

        if (!question || typeof question !== "string") {
            return new Response(
                JSON.stringify({ error: "Missing or invalid 'question' field" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiKey) {
            return new Response(
                JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: question,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return new Response(
                JSON.stringify({
                    error: err.error?.message || "OpenAI API error",
                }),
                {
                    status: response.status,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const data = await response.json();
        const embedding = data.data[0].embedding;

        return new Response(
            JSON.stringify({ embedding }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
