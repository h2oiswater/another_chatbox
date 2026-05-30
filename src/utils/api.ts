import { logger } from './logger';

interface StreamingRequestOptions {
  providerType: 'anthropic' | 'openai';
  history: { sender: string; text: string }[];
  concept: string;
  isFeynmanMode: boolean;
  apiKey: string;
  apiURL: string;
  model: string;
  onChunk: (chunk: string) => void;
}

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 10) return '********';
  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

export async function getStreamingReply({
  providerType,
  history,
  concept,
  isFeynmanMode,
  apiKey,
  apiURL,
  model,
  onChunk
}: StreamingRequestOptions): Promise<void> {
  if (!apiKey.trim()) {
    throw new Error(`${providerType === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key is not configured. Please open Settings to set your key.`);
  }

  // 1. Resolve endpoint
  let endpoint = apiURL.trim();
  if (providerType === 'openai') {
    if (!endpoint.includes('/chat/completions')) {
      if (endpoint.endsWith('/')) {
        endpoint += 'v1/chat/completions';
      } else if (endpoint.endsWith('/v1')) {
        endpoint += '/chat/completions';
      } else {
        endpoint += '/v1/chat/completions';
      }
    }
  } else {
    // Anthropic
    if (!endpoint.includes('/messages')) {
      if (endpoint.endsWith('/')) {
        endpoint += 'v1/messages';
      } else if (endpoint.endsWith('/v1')) {
        endpoint += '/messages';
      } else {
        endpoint += '/v1/messages';
      }
    }
  }

  // 2. Setup System Prompt
  let systemText = '';
  if (isFeynmanMode && concept) {
    systemText = `You are a strict learning evaluator in the ConceptNest app. The user is attempting to explain the concept of "${concept}" in their own words.
Review their explanation carefully.

Check list for evaluation:
1. ACCURACY: Is the core definition and mechanism described correctly?
2. CLARITY: Is it described simply, or is the user just repeating jargon they don't understand?
3. COMPLETENESS: Are there any critical misunderstandings or missing elements?

EVALUATION CRITERIA:
- If their explanation shows a genuine, correct, and clear understanding, you MUST start your response with EXACTLY:
  "EVALUATION: PASSED"
  followed by a new line and a short, encouraging summary of why they succeeded.
- If their explanation is incorrect, too brief, copy-pasted, or lacks key structural details, you MUST start your response with EXACTLY:
  "EVALUATION: FAILED"
  followed by a new line, constructive feedback about what they missed or got wrong, and invite them to explain it again. Be strict.`;
  } else {
    const conceptCtx = concept ? ` This thread is nested to explain the specific concept of: "${concept}".` : "";
    systemText = `You are a helpful learning assistant in the ConceptNest app.${conceptCtx}
Help the user learn in a structured, clean, and inspiring way.
- Be concise and complete: give a thorough, self-contained answer without padding or filler.
- Never cut off mid-thought. Always finish your answer properly.
- Focus on analogies first to make it intuitive.
- Avoid overwhelming tangential details. Let the user ask follow-up questions or dive into sub-branches for more depth.
- IMPORTANT: Do NOT end your response with a list of suggested next steps, follow-up questions, or menu-style options (e.g. "- [Option A]\n- [Option B]"). Just give a complete answer and stop. The user will ask follow-up questions themselves.`;
  }

  // 3. Prepare headers and payload
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  let payload: Record<string, any> = {};

  if (providerType === 'openai') {
    headers['Authorization'] = `Bearer ${apiKey}`;
    
    const messages = [{ role: 'system', content: systemText }];
    for (const msg of history) {
      const role = msg.sender === 'assistant' ? 'assistant' : 'user';
      messages.push({ role, content: msg.text });
    }

    payload = {
      model: model,
      max_tokens: 4096,
      messages: messages,
      stream: true
    };
  } else {
    // Anthropic
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    
    const messages = [];
    for (const msg of history) {
      const role = msg.sender === 'assistant' ? 'assistant' : 'user';
      messages.push({ role, content: msg.text });
    }

    payload = {
      model: model,
      max_tokens: 4096,
      system: systemText,
      messages: messages,
      stream: true
    };
  }

  // 4. Log request
  const requestLogPayload = { ...payload };
  let requestLog = `Outgoing HTTP Request to ${endpoint} (Streaming Mode)\nHeaders:\n  - content-type: application/json\n`;
  if (providerType === 'openai') {
    requestLog += `  - Authorization: Bearer ${maskKey(apiKey)}\n`;
  } else {
    requestLog += `  - x-api-key: ${maskKey(apiKey)}\n  - anthropic-version: 2023-06-01\n`;
  }
  requestLog += `Payload:\n${JSON.stringify(requestLogPayload, null, 2)}`;
  logger.log('REQUEST', requestLog);

  // 5. Fire fetch request
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    let errorMsg = `API Error (HTTP ${response.status}): ${errText || response.statusText}`;
    try {
      const parsedErr = JSON.parse(errText);
      if (parsedErr.error && parsedErr.error.message) {
        errorMsg = parsedErr.error.message;
      }
    } catch (e) {}
    logger.log('ERROR', `Request failed: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  logger.log('INFO', 'Connection established. Streaming response...');

  if (!response.body) {
    throw new Error('Response body stream is not readable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let accumulatedText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // save incomplete line in buffer

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (providerType === 'openai') {
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const text = parsed.choices[0].delta.content;
                accumulatedText += text;
                onChunk(text);
              }
            } else {
              // Anthropic
              if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
                const text = parsed.delta.text;
                accumulatedText += text;
                onChunk(text);
              }
            }
          } catch (e) {
            // Ignore incomplete JSON parsing failures on partial streams
          }
        }
      }
    }

    // Flush remaining buffer
    if (buffer && buffer.trim()) {
      const line = buffer.trim();
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            if (providerType === 'openai') {
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const text = parsed.choices[0].delta.content;
                accumulatedText += text;
                onChunk(text);
              }
            } else {
              if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
                const text = parsed.delta.text;
                accumulatedText += text;
                onChunk(text);
              }
            }
          } catch (e) {}
        }
      }
    }

    logger.log('RESPONSE', `Incoming HTTP Response Completed (Streaming Mode)\nAccumulated Body:\n${accumulatedText}`);
  } catch (err: any) {
    logger.log('ERROR', `Streaming read failed: ${err.message}`);
    throw err;
  }
}
