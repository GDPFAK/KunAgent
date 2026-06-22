export const LOCAL_WHISPER_PROVIDER_ID = 'local-whisper'
export const LOCAL_WHISPER_PROTOCOL = 'local-whisper'
export const LOCAL_WHISPER_BASE_MODEL_ID = 'whisper-base-q5_1'
export const LOCAL_WHISPER_SMALL_MODEL_ID = 'whisper-small-q5_1'
export const LOCAL_WHISPER_MEDIUM_MODEL_ID = 'whisper-medium-q5_0'
export const LOCAL_WHISPER_DEFAULT_MODEL_ID = LOCAL_WHISPER_SMALL_MODEL_ID
export const LOCAL_WHISPER_DOWNLOAD_SOURCES = [
  {
    id: 'huggingface',
    label: 'Hugging Face'
  },
  {
    id: 'hf-mirror',
    label: 'HF-Mirror'
  },
  {
    id: 'hf-sufy',
    label: 'HF CDN'
  }
] as const
export const LOCAL_WHISPER_DEFAULT_DOWNLOAD_SOURCE_ID = 'huggingface'

export const LOCAL_WHISPER_MODELS = [
  {
    id: LOCAL_WHISPER_BASE_MODEL_ID,
    label: 'Whisper Base (Q5_1)',
    shortName: 'Base',
    fileName: 'ggml-base-q5_1.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin',
    downloadMirrors: [
      {
        id: 'hf-mirror',
        label: 'HF-Mirror',
        downloadUrl: 'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin'
      },
      {
        id: 'hf-sufy',
        label: 'HF CDN',
        downloadUrl: 'https://hf-cdn.sufy.com/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin'
      }
    ],
    sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898',
    sizeBytes: 59_707_625,
    maxBytes: 100 * 1024 * 1024,
    license: 'MIT',
    source: 'ggerganov/whisper.cpp',
    resourceTier: 'low',
    resourceEstimate: {
      memory: '100-300 MB',
      cpuThreads: '1-2'
    },
    qualityTier: 'basic',
    recommended: false
  },
  {
    id: LOCAL_WHISPER_SMALL_MODEL_ID,
    label: 'Whisper Small (Q5_1)',
    shortName: 'Small',
    fileName: 'ggml-small-q5_1.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin',
    downloadMirrors: [
      {
        id: 'hf-mirror',
        label: 'HF-Mirror',
        downloadUrl: 'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin'
      },
      {
        id: 'hf-sufy',
        label: 'HF CDN',
        downloadUrl: 'https://hf-cdn.sufy.com/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin'
      }
    ],
    sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb',
    sizeBytes: 190_085_487,
    maxBytes: 400 * 1024 * 1024,
    license: 'MIT',
    source: 'ggerganov/whisper.cpp',
    resourceTier: 'medium',
    resourceEstimate: {
      memory: '300-600 MB',
      cpuThreads: '2-4'
    },
    qualityTier: 'balanced',
    recommended: true
  },
  {
    id: LOCAL_WHISPER_MEDIUM_MODEL_ID,
    label: 'Whisper Medium (Q5_0)',
    shortName: 'Medium',
    fileName: 'ggml-medium-q5_0.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin',
    downloadMirrors: [
      {
        id: 'hf-mirror',
        label: 'HF-Mirror',
        downloadUrl: 'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin'
      },
      {
        id: 'hf-sufy',
        label: 'HF CDN',
        downloadUrl: 'https://hf-cdn.sufy.com/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin'
      }
    ],
    sha256: '19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f',
    sizeBytes: 539_212_467,
    maxBytes: 600 * 1024 * 1024,
    license: 'MIT',
    source: 'ggerganov/whisper.cpp',
    resourceTier: 'high',
    resourceEstimate: {
      memory: '800-1200 MB',
      cpuThreads: '4-8'
    },
    qualityTier: 'strong',
    recommended: false
  }
] as const

export type LocalWhisperModelId = (typeof LOCAL_WHISPER_MODELS)[number]['id']
export type LocalWhisperResourceTier = (typeof LOCAL_WHISPER_MODELS)[number]['resourceTier']
export type LocalWhisperQualityTier = (typeof LOCAL_WHISPER_MODELS)[number]['qualityTier']
export type LocalWhisperDownloadSourceId = (typeof LOCAL_WHISPER_DOWNLOAD_SOURCES)[number]['id']

export type LocalWhisperModelStatus = {
  modelId: LocalWhisperModelId
  label: string
  fileName: string
  source: string
  license: string
  sha256: string
  sizeBytes: number
  maxBytes: number
  resourceTier: LocalWhisperResourceTier
  resourceEstimate: {
    memory: string
    cpuThreads: string
  }
  qualityTier: LocalWhisperQualityTier
  recommended?: boolean
  state: 'not_downloaded' | 'downloading' | 'ready' | 'error'
  path?: string
  downloadedBytes?: number
  totalBytes?: number
  speedBytesPerSecond?: number
  message?: string
}

export type LocalWhisperModelProgress = {
  modelId: LocalWhisperModelId
  downloadedBytes: number
  totalBytes?: number
  percent?: number
  speedBytesPerSecond?: number
}

export type LocalWhisperDownloadSourceStatus = {
  sourceId: LocalWhisperDownloadSourceId
  label: string
  url: string
  state: 'available' | 'unavailable'
  httpStatus?: number
  responseTimeMs?: number
  message?: string
}

export type LocalWhisperDownloadSourceStatusResult = {
  modelId: LocalWhisperModelId
  sources: LocalWhisperDownloadSourceStatus[]
}

export type LocalWhisperModelDownloadResult =
  | {
      ok: true
      status: LocalWhisperModelStatus
    }
  | {
      ok: false
      message: string
      status?: LocalWhisperModelStatus
    }

export type LocalWhisperModelDeleteResult =
  | {
      ok: true
      status: LocalWhisperModelStatus
    }
  | {
      ok: false
      message: string
      status?: LocalWhisperModelStatus
    }

export function isLocalWhisperModelId(value: unknown): value is LocalWhisperModelId {
  return LOCAL_WHISPER_MODELS.some((model) => model.id === value)
}

export function isLocalWhisperDownloadSourceId(value: unknown): value is LocalWhisperDownloadSourceId {
  return LOCAL_WHISPER_DOWNLOAD_SOURCES.some((source) => source.id === value)
}

export function localWhisperModelById(modelId: unknown) {
  return LOCAL_WHISPER_MODELS.find((model) => model.id === modelId)
    ?? LOCAL_WHISPER_MODELS.find((model) => model.id === LOCAL_WHISPER_DEFAULT_MODEL_ID)
    ?? LOCAL_WHISPER_MODELS[0]
}

export function localWhisperDownloadSourceById(sourceId: unknown) {
  return LOCAL_WHISPER_DOWNLOAD_SOURCES.find((source) => source.id === sourceId)
    ?? LOCAL_WHISPER_DOWNLOAD_SOURCES.find((source) => source.id === LOCAL_WHISPER_DEFAULT_DOWNLOAD_SOURCE_ID)
    ?? LOCAL_WHISPER_DOWNLOAD_SOURCES[0]
}
