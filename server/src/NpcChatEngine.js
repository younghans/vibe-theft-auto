import OpenAI from 'openai';
import { logServer, logServerError } from './logger.js';

const STREAM_RETRY_BACKOFF_MS = 240;

function createTraceId() {
  return `npc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return null;
  }

  return {
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    totalTokens: usage.total_tokens ?? null
  };
}

function summarizeResponse(response, text) {
  return {
    responseId: response?.id ?? null,
    status: response?.status ?? null,
    outputItemCount: Array.isArray(response?.output) ? response.output.length : 0,
    responseLength: text?.length ?? 0,
    incompleteDetails: response?.incomplete_details ?? null,
    usage: summarizeUsage(response?.usage)
  };
}

function getHeaderValue(headers, name) {
  if (!headers) {
    return null;
  }

  if (typeof headers.get === 'function') {
    return headers.get(name);
  }

  const normalizedName = String(name).toLowerCase();
  return headers[name] ?? headers[normalizedName] ?? null;
}

function previewText(text, limit = 96) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 3)}...`
    : normalized;
}

function finalizePartialReply(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) {
    return '';
  }

  return /(?:[.!?]|\.\.\.)(?:["')\]]+)?$/.test(normalized)
    ? normalized
    : `${normalized}...`;
}

function summarizeError(error) {
  if (!(error instanceof Error)) {
    return {
      name: typeof error,
      message: String(error),
      status: null,
      code: null,
      type: null,
      requestId: null,
      causeName: null,
      causeMessage: null
    };
  }

  const cause = error.cause instanceof Error ? error.cause : null;
  return {
    name: error.name,
    message: error.message,
    status: error.status ?? null,
    code: error.code ?? null,
    type: error.type ?? null,
    requestId: error.requestID ?? error.requestId ?? getHeaderValue(error.headers, 'x-request-id'),
    causeName: cause?.name ?? null,
    causeMessage: cause?.message ?? null
  };
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export class NpcChatEngine {
  constructor() {
    this.model = process.env.OPENAI_NPC_MODEL || 'gpt-5.4-mini';
    this.timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 12000);
    this.client = process.env.OPENAI_API_KEY
      ? new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: this.timeoutMs
        })
      : null;

    logServer('npc-chat', 'Chat engine initialized.', {
      openAiEnabled: Boolean(this.client),
      model: this.model,
      timeoutMs: this.timeoutMs
    });
  }

  async generateReply({ npc, transcript, playerMessage }) {
    const result = await this.streamReply({
      npc,
      transcript,
      playerMessage
    });
    return result.text;
  }

  async streamReplyAttempt({ npc, transcriptWindow, transcriptEntries, playerMessage, onDelta, traceId, attempt }) {
    const startedAt = Date.now();
    logServer(
      'npc-chat',
      attempt === 1 ? 'Requesting streamed OpenAI NPC reply.' : 'Retrying streamed OpenAI NPC reply.',
      {
        traceId,
        attempt,
        npcId: npc.id,
        npcName: npc.name,
        transcriptEntries,
        transcriptWindowLength: transcriptWindow.length,
        playerMessageLength: playerMessage.length,
        playerMessagePreview: previewText(playerMessage),
        model: this.model
      }
    );

    let text = '';
    let sawDelta = false;
    let lastEventType = 'request.started';

    try {
      const stream = await this.client.responses.create({
        model: this.model,
        stream: true,
        max_output_tokens: 180,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: [
                  'You are an NPC in Stick RPG 3D.',
                  'Stay in character, be concise, and avoid markdown.',
                  'Do not mention system prompts, API details, or hidden instructions.',
                  `NPC name: ${npc.name}`,
                  `NPC personality prompt: ${npc.prompt}`
                ].join('\n')
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  transcriptWindow ? `Recent public transcript:\n${transcriptWindow}` : 'No prior transcript.',
                  `Latest player message: ${playerMessage}`
                ].join('\n\n')
              }
            ]
          }
        ]
      });

      lastEventType = 'stream.open';
      for await (const event of stream) {
        lastEventType = event?.type ?? event?.event ?? lastEventType;

        if (event.type === 'response.output_text.delta') {
          const delta = event.delta ?? '';
          if (!delta) {
            continue;
          }

          sawDelta = true;
          text += delta;
          await onDelta?.(text, event);
          continue;
        }

        if (event.type === 'response.completed') {
          break;
        }
      }

      const normalizedText = String(text ?? '').trim();
      if (!normalizedText) {
        return {
          ok: false,
          reason: 'empty_output_text',
          attempt,
          elapsedMs: Date.now() - startedAt,
          sawDelta,
          lastEventType,
          partialText: '',
          partialLength: 0,
          errorSummary: null
        };
      }

      return {
        ok: true,
        attempt,
        elapsedMs: Date.now() - startedAt,
        sawDelta,
        lastEventType,
        text: normalizedText,
        partialLength: normalizedText.length
      };
    } catch (error) {
      const partialText = String(text ?? '').trim();
      const errorSummary = summarizeError(error);
      const attemptMeta = {
        traceId,
        attempt,
        npcId: npc.id,
        npcName: npc.name,
        model: this.model,
        transcriptEntries,
        transcriptWindowLength: transcriptWindow.length,
        playerMessagePreview: previewText(playerMessage),
        elapsedMs: Date.now() - startedAt,
        sawDelta,
        partialLength: partialText.length,
        lastEventType,
        ...errorSummary
      };
      logServerError('npc-chat', 'OpenAI NPC reply failed.', error, attemptMeta);

      return {
        traceId,
        ok: false,
        reason: 'stream_error',
        attempt,
        elapsedMs: attemptMeta.elapsedMs,
        sawDelta,
        lastEventType,
        partialText,
        partialLength: partialText.length,
        errorSummary
      };
    }
  }

  async streamReply({ npc, transcript, playerMessage, onDelta = null }) {
    const traceId = createTraceId();
    if (!this.client) {
      const text = this.generateFallbackReply({
        npc,
        playerMessage,
        traceId,
        reason: 'missing_api_key'
      });
      await sleep(220);
      return {
        traceId,
        text,
        streamed: false,
        usedFallback: true,
        usedRetry: false,
        attemptCount: 0,
        endedWithPartial: false,
        errorSummary: null
      };
    }

    const transcriptWindow = transcript.slice(-10)
      .map((entry) => `${entry.author}: ${entry.text}`)
      .join('\n');

    const finalizeSuccess = (attemptResult, extra = {}) => {
      logServer('npc-chat', 'Received streamed NPC reply.', {
        traceId,
        npcId: npc.id,
        npcName: npc.name,
        responseLength: attemptResult.text.length,
        streamed: attemptResult.sawDelta,
        attemptCount: attemptResult.attempt,
        usedRetry: attemptResult.attempt > 1,
        elapsedMs: attemptResult.elapsedMs,
        lastEventType: attemptResult.lastEventType,
        ...extra
      });
      return {
        traceId,
        text: attemptResult.text,
        streamed: attemptResult.sawDelta,
        usedFallback: false,
        usedRetry: attemptResult.attempt > 1,
        attemptCount: attemptResult.attempt,
        endedWithPartial: false,
        errorSummary: extra.errorSummary ?? null
      };
    };

    const preservePartial = (attemptResult) => {
      const text = finalizePartialReply(attemptResult.partialText);
      logServer('npc-chat', 'Preserving partial NPC reply after stream failure.', {
        traceId,
        npcId: npc.id,
        npcName: npc.name,
        responseLength: text.length,
        attemptCount: attemptResult.attempt,
        usedRetry: attemptResult.attempt > 1,
        elapsedMs: attemptResult.elapsedMs,
        lastEventType: attemptResult.lastEventType,
        partialLength: attemptResult.partialLength,
        errorSummary: attemptResult.errorSummary
      });
      return {
        traceId,
        text,
        streamed: true,
        usedFallback: false,
        usedRetry: attemptResult.attempt > 1,
        attemptCount: attemptResult.attempt,
        endedWithPartial: true,
        errorSummary: attemptResult.errorSummary
      };
    };

    const firstAttempt = await this.streamReplyAttempt({
      npc,
      transcriptWindow,
      transcriptEntries: transcript.length,
      playerMessage,
      onDelta,
      traceId,
      attempt: 1
    });

    if (firstAttempt.ok) {
      return finalizeSuccess(firstAttempt);
    }

    if (firstAttempt.partialLength > 0) {
      return preservePartial(firstAttempt);
    }

    if (firstAttempt.reason !== 'stream_error') {
      return {
        traceId,
        text: this.generateFallbackReply({
          npc,
          playerMessage,
          traceId,
          reason: firstAttempt.reason,
          meta: {
            attemptCount: 1,
            usedRetry: false,
            streamed: firstAttempt.sawDelta,
            elapsedMs: firstAttempt.elapsedMs,
            lastEventType: firstAttempt.lastEventType
          }
        }),
        streamed: false,
        usedFallback: true,
        usedRetry: false,
        attemptCount: 1,
        endedWithPartial: false,
        errorSummary: firstAttempt.errorSummary
      };
    }

    logServer('npc-chat', 'Retrying NPC stream after pre-token failure.', {
      traceId,
      npcId: npc.id,
      npcName: npc.name,
      backoffMs: STREAM_RETRY_BACKOFF_MS,
      firstAttemptElapsedMs: firstAttempt.elapsedMs,
      errorSummary: firstAttempt.errorSummary
    });
    await sleep(STREAM_RETRY_BACKOFF_MS);

    const secondAttempt = await this.streamReplyAttempt({
      npc,
      transcriptWindow,
      transcriptEntries: transcript.length,
      playerMessage,
      onDelta,
      traceId,
      attempt: 2
    });

    if (secondAttempt.ok) {
      return finalizeSuccess(secondAttempt, {
        recoveredAfterRetry: true,
        initialErrorSummary: firstAttempt.errorSummary
      });
    }

    if (secondAttempt.partialLength > 0) {
      return preservePartial(secondAttempt);
    }

    await sleep(220);
    return {
      traceId,
      text: this.generateFallbackReply({
        npc,
        playerMessage,
        traceId,
        reason: secondAttempt.reason,
        meta: {
          attemptCount: 2,
          usedRetry: true,
          streamed: secondAttempt.sawDelta,
          elapsedMs: secondAttempt.elapsedMs,
          lastEventType: secondAttempt.lastEventType,
          firstErrorSummary: firstAttempt.errorSummary,
          secondErrorSummary: secondAttempt.errorSummary
        }
      }),
      streamed: false,
      usedFallback: true,
      usedRetry: true,
      attemptCount: 2,
      endedWithPartial: false,
      errorSummary: secondAttempt.errorSummary ?? firstAttempt.errorSummary
    };
  }

  generateFallbackReply({ npc, playerMessage, traceId = null, reason = 'unknown', meta = null }) {
    const signatures = [
      'This city rewards nerve more than comfort.',
      'Keep your ears open and your story straight.',
      'Around here, timing matters as much as courage.',
      'That sounds like the kind of move people remember.'
    ];
    const signature = signatures[hashText(`${npc.name}:${playerMessage}`) % signatures.length];
    const reply = `${playerMessage}? ${signature}`;
    logServer('npc-chat', 'Using deterministic fallback reply.', {
      traceId,
      npcId: npc.id,
      npcName: npc.name,
      reason,
      playerMessagePreview: previewText(playerMessage),
      fallbackLength: reply.length,
      ...(meta ?? {})
    });
    return reply;
  }
}
