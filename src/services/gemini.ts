import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Message } from "../types";

export async function testApiKey(key: string) {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    throw new Error("API Key is empty");
  }
  
  if (trimmedKey.length < 20) {
    throw new Error("API Key is too short. A valid Gemini API key is typically around 39 characters.");
  }

  // Basic format check: Gemini keys usually start with AIza
  if (!trimmedKey.startsWith("AIza")) {
    throw new Error("Invalid API Key format. A valid Gemini API key usually starts with 'AIza'.");
  }
  
  const maskedKey = `${trimmedKey.substring(0, 6)}...${trimmedKey.substring(trimmedKey.length - 4)}`;
    
  console.log(`[Gemini Service] Testing API key: ${maskedKey} (Length: ${trimmedKey.length})`);
  
  try {
    // Use a nonce to ensure we're not getting a cached response
    const nonce = Math.random().toString(36).substring(7);
    
    // Add a timeout to the fetch call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Use query parameter for the key as it is the most standard way
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${trimmedKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Respond with exactly this code: ${nonce} and nothing else.` }] }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      console.error("[Gemini Service] API test failed with status:", response.status, data);
      
      const errorMsg = data.error?.message || "Invalid API Key or connection error.";
      if (errorMsg.includes("API_KEY_INVALID") || response.status === 401) {
        throw new Error("The API key you provided is invalid. Please check it and try again.");
      } else if (response.status === 403) {
        throw new Error("Permission denied. This key might not have access to the Gemini API or the specific model.");
      }
      throw new Error(errorMsg);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log(`[Gemini Service] Test response: "${text}" (Expected: ${nonce})`);
    
    // STRICT VALIDATION: The response MUST contain the nonce
    const isValid = !!text && text.includes(nonce);
    
    if (isValid) {
      console.log("[Gemini Service] API Key verified successfully!");
      return true;
    } else {
      console.error("[Gemini Service] Key test returned unexpected content. Key might be fake or restricted.");
      throw new Error("API key test failed: The key accepted the request but returned an invalid response. This often happens with fake or inactive keys.");
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error("[Gemini Service] API Key test timed out after 10s");
      throw new Error("Test timed out. Please check your internet connection or the key.");
    }
    console.error("[Gemini Service] Key test failed:", error);
    throw error;
  }
}

export async function generateChatResponse(
  messages: Message[], 
  onChunk?: (chunk: string) => void,
  options: { systemPrompt?: string; model?: string; signal?: AbortSignal; apiKey?: string } = {}
) {
  // Determine which API key to use and its source for debugging
  let apiKey: string;
  let source: string;

  if (options.apiKey !== undefined && options.apiKey !== null) {
    const trimmed = options.apiKey.trim();
    if (trimmed === "") {
      throw new Error("Custom API Key is empty. Please enter your key in Settings or switch to Lumina (Original).");
    }
    // Re-validate format here just in case
    if (trimmed.length < 20 || !trimmed.startsWith("AIza")) {
      throw new Error("Invalid Custom API Key format. Please check your settings.");
    }
    apiKey = trimmed;
    source = "CUSTOM";
  } else {
    apiKey = (process.env.GEMINI_API_KEY || "").trim();
    source = "LUMINA";
    if (!apiKey) {
      throw new Error("Lumina API Key is not set. Please contact support.");
    }
  }

  const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;
  
  // Debug log to verify key usage (masked for security)
  console.log(`[Gemini Service] Request initiated using ${source} API key: ${maskedKey}`);

  try {
    // Map internal model names to Gemini API model names
    // Only using the free-tier optimized model as requested
    const model = "gemini-3.1-flash-lite-preview";

    console.log(`[Gemini Service] Using model: ${model} | Source: ${source}`);
    
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
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      };
    });

    const systemInstruction = options.systemPrompt || "You are a helpful, intelligent AI assistant named Lumina AI. Provide concise, accurate, and well-formatted responses. Use markdown for code blocks and lists.";

    // Use direct fetch for streaming to ensure absolute control over the API key
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Gemini Service] Streaming request failed:", response.status, errorData);
      
      const errorMsg = errorData.error?.message || `API request failed with status ${response.status}`;
      
      if (response.status === 401 || errorMsg.includes("API_KEY_INVALID")) {
        throw new Error(`The ${source === 'CUSTOM' ? 'Custom' : 'Lumina'} API key is invalid. Please check your settings.`);
      }
      
      throw new Error(errorMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is null");

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE format parsing
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.substring(6));
              const chunkText = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunkText) {
                fullText += chunkText;
                onChunk?.(chunkText);
              }
            } catch (e) {
              // Silently ignore parsing errors for non-data lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message === "Generation aborted")) {
      console.log("Generation was stopped by user");
      return ""; 
    }
    console.error("Gemini API Error:", error);
    throw error;
  }
}
