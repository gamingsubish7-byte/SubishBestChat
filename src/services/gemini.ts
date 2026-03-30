import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Message } from "../types";

export async function generateChatResponse(
  messages: Message[], 
  onChunk?: (chunk: string) => void,
  options: { systemPrompt?: string; model?: string; signal?: AbortSignal } = {}
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Please add it to your Secrets in the Settings menu.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const model = "gemini-3-flash-preview";
    
    // Convert our message format to Gemini format
    const contents = messages.map(msg => {
      const parts: any[] = [{ text: msg.content }];
      
      if (msg.imageData) {
        parts.push({
          inlineData: {
            data: msg.imageData.data,
            mimeType: msg.imageData.mimeType
          }
        });
      }
      
      return {
        role: msg.role,
        parts
      };
    });

    const systemInstruction = options.systemPrompt || "You are a helpful, intelligent AI assistant named Lumina AI. Provide concise, accurate, and well-formatted responses. Use markdown for code blocks and lists.";

    const result = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    let fullText = "";
    for await (const chunk of result) {
      if (options.signal?.aborted) {
        throw new Error("Generation aborted");
      }
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk?.(text);
      }
    }

    return fullText;
  } catch (error) {
    if (error instanceof Error && error.message === "Generation aborted") {
      console.log("Generation was stopped by user");
      return ""; // Return empty or partial text if needed
    }
    console.error("Gemini API Error:", error);
    throw error;
  }
}
