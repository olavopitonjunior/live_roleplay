/**
 * Edge Function: manage-presentation
 *
 * Handles presentation/slide text extraction using Claude Vision API.
 * Called after frontend uploads PDF slide images to Supabase Storage.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";

// ============================================
// Types
// ============================================

interface SlideInput {
  position: number;
  image_url: string;
}

interface ExtractTextRequest {
  action: "extract-text";
  access_code?: string;
  slides: SlideInput[];
}

interface SaveConfigRequest {
  action: "save-config";
  access_code?: string;
  scenario_id: string;
  presentation_config: Record<string, unknown>;
}

type RequestBody = ExtractTextRequest | SaveConfigRequest;

// ============================================
// Claude Vision text extraction
// ============================================

async function extractSlideText(imageUrl: string): Promise<{
  extracted_text: string;
  title: string;
  data_points: string[];
}> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Fetch the image from Storage
  const imageResp = await fetch(imageUrl);
  if (!imageResp.ok) {
    throw new Error(`Failed to fetch image: ${imageResp.status}`);
  }
  const imageBuffer = await imageResp.arrayBuffer();
  const base64Image = btoa(
    new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  const contentType = imageResp.headers.get("content-type") || "image/webp";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: contentType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `Extraia o conteudo deste slide de apresentacao. Retorne um JSON com:
- "title": titulo do slide (string)
- "extracted_text": todo o texto visivel no slide (string)
- "data_points": lista de dados numericos ou estatisticas mencionados (array de strings)

Retorne APENAS o JSON, sem markdown ou explicacoes.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${errText}`);
  }

  const result = await response.json();
  const textContent = result.content?.[0]?.text || "{}";

  try {
    const parsed = JSON.parse(textContent);
    return {
      extracted_text: parsed.extracted_text || "",
      title: parsed.title || "",
      data_points: parsed.data_points || [],
    };
  } catch {
    // If Claude returns non-JSON, use raw text
    return {
      extracted_text: textContent,
      title: "",
      data_points: [],
    };
  }
}

// ============================================
// Handler
// ============================================

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const body = (await req.json()) as RequestBody;
    const { action } = body;

    const authResult = await authenticate(req, {
      body: body as Record<string, unknown>,
    });

    if (!authResult.success) {
      return corsErrorResponse(authResult.error, authResult.status, req);
    }

    const { supabase } = authResult;

    switch (action) {
      // ==============================
      // EXTRACT-TEXT — Extract text from slide images via Claude Vision
      // ==============================
      case "extract-text": {
        const { slides } = body as ExtractTextRequest;

        if (!slides?.length) {
          return corsErrorResponse("slides array required", 400, req);
        }

        if (slides.length > 30) {
          return corsErrorResponse("Maximum 30 slides allowed", 400, req);
        }

        const results: {
          position: number;
          image_url: string;
          extracted_text: string;
          title: string;
          data_points: string[];
        }[] = [];

        // Process slides sequentially (Claude API rate limits)
        for (const slide of slides) {
          try {
            const extraction = await extractSlideText(slide.image_url);
            results.push({
              position: slide.position,
              image_url: slide.image_url,
              ...extraction,
            });
          } catch (err) {
            console.error(`Error extracting slide ${slide.position}:`, err);
            results.push({
              position: slide.position,
              image_url: slide.image_url,
              extracted_text: "[Erro na extracao]",
              title: "",
              data_points: [],
            });
          }
        }

        return corsJsonResponse(
          {
            total_slides: results.length,
            slides: results,
          },
          200,
          req
        );
      }

      // ==============================
      // SAVE-CONFIG — Save presentation config to scenario
      // ==============================
      case "save-config": {
        const { scenario_id, presentation_config } = body as SaveConfigRequest;

        if (!scenario_id) {
          return corsErrorResponse("scenario_id required", 400, req);
        }

        const { error: updateError } = await supabase
          .from("scenarios")
          .update({ presentation_config })
          .eq("id", scenario_id);

        if (updateError) {
          console.error("Error saving presentation config:", updateError);
          return corsErrorResponse("Failed to save presentation config", 500, req);
        }

        return corsJsonResponse({ success: true }, 200, req);
      }

      default:
        return corsErrorResponse(
          `Unknown action: ${action}. Valid: extract-text, save-config`,
          400,
          req
        );
    }
  } catch (err) {
    console.error("manage-presentation error:", err);
    return corsErrorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
      req
    );
  }
});
