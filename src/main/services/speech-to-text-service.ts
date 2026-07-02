import {
  resolveKunSpeechToTextSettings,
  type AppSettingsV1,
  type KunSpeechToTextSettingsV1
} from '../../shared/app-settings'
import {
  SPEECH_TRANSCRIPTION_MAX_BASE64_CHARS,
  type SpeechTranscriptionRequest,
  type SpeechTranscriptionResult
} from '../../shared/speech-to-text'
import { describeNetworkError } from '../../../kun/src/adapters/tool/image-gen-tool-provider.js'
import { transcribeViaLocalWhisper } from './local-whisper-service'

const FILE_EXTENSION_BY_MIME: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac'
}

export function isSpeechToTextConfigured(
  speechToText: Pick<KunSpeechToTextSettingsV1, 'enabled' | 'protocol' | 'baseUrl' | 'apiKey' | 'model'>
): boolean {
  if (speechToText.protocol === 'local-whisper') {
    return speechToText.enabled && Boolean(speechToText.model.trim())
  }
  return (
    speechToText.enabled &&
    Boolean(speechToText.baseUrl.trim()) &&
    Boolean(speechToText.apiKey.trim()) &&
    Boolean(speechToText.model.trim())
  )
}

export async function requestSpeechTranscription(
  settings: AppSettingsV1,
  request: SpeechTranscriptionRequest,
  options: {
    fetchImpl?: typeof fetch
    localWhisperTranscriber?: (
      request: SpeechTranscriptionRequest,
      speechToText: KunSpeechToTextSettingsV1
    ) => Promise<string>
  } = {}
): Promise<SpeechTranscriptionResult> {
  const speechToText = request.speechToText ?? resolveKunSpeechToTextSettings(settings)
  if (!isSpeechToTextConfigured(speechToText)) {
    return { ok: false, message: 'speech-to-text provider is not configured' }
  }
  if (!request.audioBase64 || request.audioBase64.length > SPEECH_TRANSCRIPTION_MAX_BASE64_CHARS) {
    return { ok: false, message: 'audio payload is empty or too large' }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  try {
    const text = speechToText.protocol === 'local-whisper'
      ? await (options.localWhisperTranscriber ?? transcribeViaLocalWhisper)(request, speechToText)
      : speechToText.protocol === 'mimo-asr'
        ? await transcribeViaMimoAsr(speechToText, request, fetchImpl)
        : await transcribeViaOpenAiTranscriptions(speechToText, request, fetchImpl)
    const trimmed = text.trim()
    if (!trimmed) return { ok: false, message: 'transcription result is empty' }
    return { ok: true, text: trimmed }
  } catch (error) {
    return { ok: false, message: describeTranscriptionError(error, speechToText.timeoutMs) }
  }
}

/**
 * Xiaomi MiMo ASR rides the OpenAI-compatible chat completions endpoint:
 * the audio goes in as a base64 data URI inside an `input_audio` content
 * part and the transcript comes back as the assistant message content.
 */
async function transcribeViaMimoAsr(
  speechToText: KunSpeechToTextSettingsV1,
  request: SpeechTranscriptionRequest,
  fetchImpl: typeof fetch
): Promise<string> {
  const url = joinSpeechApiUrl(speechToText.baseUrl, 'chat/completions')
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${speechToText.apiKey}`,
      'api-key': speechToText.apiKey
    },
    body: JSON.stringify({
      model: speechToText.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: `data:${request.mimeType};base64,${request.audioBase64}`
              }
            }
          ]
        }
      ],
      asr_options: {
        language: speechToText.language || 'auto'
      },
      stream: false
    }),
    signal: AbortSignal.timeout(speechToText.timeoutMs)
  })
  const body = await response.text()
  if (!response.ok) throw new SpeechHttpError(response.status, body)
  const parsed = JSON.parse(body) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = parsed.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof (part as { text?: unknown })?.text === 'string' ? (part as { text: string }).text : ''))
      .join('')
  }
  throw new Error('speech response has no transcript content')
}

/** Standard OpenAI-style multipart upload to {baseUrl}/audio/transcriptions. */
async function transcribeViaOpenAiTranscriptions(
  speechToText: KunSpeechToTextSettingsV1,
  request: SpeechTranscriptionRequest,
  fetchImpl: typeof fetch
): Promise<string> {
  const url = joinSpeechApiUrl(speechToText.baseUrl, 'audio/transcriptions')
  const audio = Buffer.from(request.audioBase64, 'base64')
  const form = new FormData()
  const extension = FILE_EXTENSION_BY_MIME[request.mimeType.toLowerCase()] ?? 'wav'
  form.append('file', new Blob([new Uint8Array(audio)], { type: request.mimeType }), `recording.${extension}`)
  form.append('model', speechToText.model)
  form.append('response_format', 'json')
  if (speechToText.language && speechToText.language !== 'auto') {
    form.append('language', speechToText.language)
  }
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${speechToText.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(speechToText.timeoutMs)
  })
  const body = await response.text()
  if (!response.ok) throw new SpeechHttpError(response.status, body)
  const parsed = JSON.parse(body) as { text?: unknown }
  if (typeof parsed.text !== 'string') throw new Error('speech response has no transcript text')
  return parsed.text
}

export class SpeechHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`HTTP ${status}: ${body.slice(0, 500)}`)
  }
}

export function joinSpeechApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/${path}`
}

function describeTranscriptionError(error: unknown, timeoutMs: number): string {
  if (error instanceof SpeechHttpError) return error.message
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `speech request timed out after ${timeoutMs}ms`
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'speech request was canceled'
  }
  if (error instanceof SyntaxError) return 'speech response is not valid JSON'
  return describeNetworkError(error)
}
