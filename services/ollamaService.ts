import type { Message } from '../types';

/**
 * Normalizes the base URL provided by the user.
 * - Removes any trailing slashes.
 * - Removes a trailing '/api' if present, as endpoints will be added specifically.
 * @param url The raw URL from user input.
 * @returns A clean base URL.
 */
function normalizeBaseUrl(url: string): string {
  let cleanUrl = url.trim().replace(/\/+$/, '');
  if (cleanUrl.endsWith('/api')) {
    cleanUrl = cleanUrl.slice(0, -4);
  }
  return cleanUrl;
}

export async function* streamChat(
    messages: Message[], 
    model: string, 
    ollamaApiUrlBase: string,
    options: { temperature?: number, num_predict?: number },
    signal: AbortSignal
) {
  const baseUrl = normalizeBaseUrl(ollamaApiUrlBase);
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      model, 
      messages, 
      stream: true,
      keep_alive: '5m',
      options: options || {}
    }),
    signal, // Pass the abort signal to the fetch request
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`请求 Ollama API 失败: ${response.status} ${response.statusText} - ${errorBody}`);
  }
  
  if (!response.body) {
      throw new Error("响应体为空。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
        if (buffer.trim()) {
            try {
                const parsed = JSON.parse(buffer);
                console.debug('Parsed final stream chunk:', parsed);
                if (parsed.error) {
                    throw new Error(`Ollama stream returned an error: ${parsed.error}`);
                }
                if (parsed.message && typeof parsed.message.content !== 'undefined') {
                    yield parsed.message.content;
                }
                if (parsed.done) {
                    yield { 
                        type: 'stats', 
                        data: { 
                            total_duration: parsed.total_duration,
                            eval_count: parsed.eval_count,
                            eval_duration: parsed.eval_duration,
                        }
                    };
                }
            } catch (error) {
                console.error("Failed to parse or handle final stream chunk:", buffer, error);
            }
        }
        break;
    }
    
    buffer += decoder.decode(value, { stream: true });
    
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
             try {
                const parsed = JSON.parse(line);
                console.debug('Parsed stream line:', parsed);
                if (parsed.error) {
                  throw new Error(`Ollama stream returned an error: ${parsed.error}`);
                }
                if (parsed.message && typeof parsed.message.content !== 'undefined') {
                  yield parsed.message.content;
                }
                if (parsed.done) {
                    yield { 
                        type: 'stats', 
                        data: { 
                            total_duration: parsed.total_duration,
                            eval_count: parsed.eval_count,
                            eval_duration: parsed.eval_duration,
                        }
                    };
                }
              } catch (error) {
                console.error("Failed to parse or handle stream chunk:", line, error);
                if (error instanceof Error && error.message.startsWith('Ollama stream returned an error')) {
                    throw error;
                }
              }
        }
    }
  }
}

export async function getOllamaModels(ollamaApiUrlBase: string): Promise<string[]> {
  const baseUrl = normalizeBaseUrl(ollamaApiUrlBase);
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) {
        console.warn("Ollama models response is not in the expected format:", data);
        return [];
    }
    return data.models.map((model: { name: string }) => model.name).sort();
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error);
    throw error;
  }
}