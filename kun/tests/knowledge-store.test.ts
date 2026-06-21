import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CapabilityRegistry } from '../src/adapters/tool/capability-registry.js'
import { buildKnowledgeToolProviders } from '../src/adapters/tool/knowledge-tool-provider.js'
import { LocalToolHost } from '../src/adapters/tool/local-tool-host.js'
import { KunCapabilitiesConfig, type KnowledgeCapabilityConfig } from '../src/contracts/capabilities.js'
import { SqliteKnowledgeStore } from '../src/knowledge/sqlite-knowledge-store.js'
import { modelCapabilitiesForModel } from '../src/loop/model-context-profile.js'
import { dispatchRequest } from '../src/server/http-server.js'
import { buildHarness, readJson } from './http-server-test-harness.js'

describe('SqliteKnowledgeStore', () => {
  let dir = ''
  let nextId = 1
  let stores: SqliteKnowledgeStore[] = []

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kun-knowledge-'))
    nextId = 1
    stores = []
  })

  afterEach(async () => {
    for (const store of stores) store.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('indexes local text, searches CJK content, and keeps bases isolated by workspace', async () => {
    const store = createStore()
    const workspaceA = join(dir, 'workspace-a')
    const workspaceB = join(dir, 'workspace-b')
    const base = await store.createKnowledgeBase({
      name: 'Project docs',
      workspace: workspaceA
    })
    const document = await store.addDocument({
      knowledgeBaseId: base.id,
      name: 'Kun RAG guide',
      text: 'Kun 内置知识库支持 TypeScript 项目资料、本地 RAG、embedding 和 reranker。'
    })

    expect(await store.listDocuments(base.id)).toMatchObject([
      { id: document.id, name: 'Kun RAG guide', chunkCount: 1, status: 'ready' }
    ])

    const hits = await store.search({
      query: 'TypeScript 知识库',
      workspace: workspaceA,
      topK: 5
    })
    expect(hits[0]).toMatchObject({
      documentId: document.id,
      knowledgeBaseName: 'Project docs',
      documentName: 'Kun RAG guide'
    })

    await expect(store.search({
      query: 'TypeScript 知识库',
      workspace: workspaceB,
      knowledgeBaseIds: [base.id],
      topK: 5
    })).resolves.toEqual([])

    await expect(store.diagnostics()).resolves.toMatchObject({
      available: true,
      knowledgeBaseCount: 1,
      documentCount: 1,
      chunkCount: 1
    })

    await expect(store.deleteDocument(base.id, document.id)).resolves.toMatchObject({
      id: document.id,
      status: 'deleted'
    })
    await expect(store.search({ query: 'TypeScript', workspace: workspaceA, topK: 5 })).resolves.toEqual([])
    await store.deleteKnowledgeBase(base.id)
    await expect(store.diagnostics()).resolves.toMatchObject({
      knowledgeBaseCount: 0,
      documentCount: 0,
      chunkCount: 0
    })
  })

  it('queries external RAG providers without breaking local search compatibility', async () => {
    const requested: Array<{ url: string; body: unknown; authorization?: string }> = []
    const store = createStore({}, {
      fetchImpl: async (url, init) => {
        requested.push({
          url: String(url),
          body: JSON.parse(String(init?.body ?? '{}')),
          authorization: new Headers(init?.headers).get('authorization') ?? undefined
        })
        return new Response(JSON.stringify({
          results: [{
            text: 'External RAGFlow result about Kun knowledge bases.',
            documentName: 'RAGFlow Doc',
            sourcePath: 'ragflow://doc/1',
            score: 0.92
          }]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
    })
    const workspace = join(dir, 'workspace')
    const external = await store.createKnowledgeBase({
      name: 'RAGFlow',
      workspace,
      providerKind: 'external',
      external: {
        provider: 'ragflow',
        endpoint: 'https://ragflow.example/api/search',
        apiKey: 'secret'
      }
    })

    const hits = await store.search({
      query: 'knowledge base',
      workspace,
      knowledgeBaseIds: [external.id],
      topK: 3
    })

    expect(requested).toEqual([{
      url: 'https://ragflow.example/api/search',
      authorization: 'Bearer secret',
      body: {
        query: 'knowledge base',
        topK: 3,
        workspace,
        knowledgeBaseId: external.id,
        provider: 'ragflow'
      }
    }])
    expect(hits).toEqual([
      expect.objectContaining({
        knowledgeBaseId: external.id,
        documentName: 'RAGFlow Doc',
        sourceType: 'external',
        score: 0.92
      })
    ])
  })

  it('exposes knowledge_search as a read-only retrieval tool', async () => {
    const store = createStore()
    const workspace = join(dir, 'workspace')
    const base = await store.createKnowledgeBase({ name: 'Team notes', workspace })
    await store.addDocument({
      knowledgeBaseId: base.id,
      name: 'Tooling',
      text: 'The team uses pnpm for frontend package management.'
    })
    const host = new LocalToolHost({
      registry: new CapabilityRegistry(buildKnowledgeToolProviders(store))
    })

    const result = await host.execute({
      callId: 'call_1',
      toolName: 'knowledge_search',
      arguments: { query: 'frontend package manager', topK: 2 }
    }, {
      threadId: 'thr_1',
      turnId: 'turn_1',
      workspace,
      threadMode: 'agent',
      model: modelCapabilitiesForModel('deepseek-chat'),
      memoryPolicy: { enabled: false },
      delegationPolicy: { enabled: false },
      approvalPolicy: 'auto',
      abortSignal: new AbortController().signal,
      awaitApproval: async () => 'allow'
    })

    expect(result.approved).toBe(true)
    expect(result.item).toMatchObject({
      kind: 'tool_result',
      isError: false,
      output: {
        query: 'frontend package manager',
        resultCount: 1,
        results: [
          expect.objectContaining({
            knowledgeBaseName: 'Team notes',
            documentName: 'Tooling',
            citation: 'Team notes / Tooling #1'
          })
        ]
      }
    })
  })

  it('exposes authenticated HTTP routes for knowledge base management', async () => {
    const h = buildHarness()
    h.runtime.knowledgeStore = createStore()
    const workspace = join(dir, 'workspace')
    const created = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/knowledge-bases', {
        method: 'POST',
        headers: { authorization: 'Bearer tok-1', 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Docs', workspace })
      })
    )
    expect(created.status).toBe(201)
    const createdBody = await readJson(created) as { knowledgeBase: { id: string } }

    const added = await dispatchRequest(
      h.router,
      new Request(`http://localhost/v1/knowledge-bases/${createdBody.knowledgeBase.id}/documents`, {
        method: 'POST',
        headers: { authorization: 'Bearer tok-1', 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Readme', text: 'Kun local RAG search route test' })
      })
    )
    expect(added.status).toBe(201)

    const searched = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/knowledge-bases/search', {
        method: 'POST',
        headers: { authorization: 'Bearer tok-1', 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'local RAG', workspace })
      })
    )
    expect(await readJson(searched)).toMatchObject({
      results: [expect.objectContaining({ documentName: 'Readme' })]
    })

    const diagnostics = await dispatchRequest(
      h.router,
      new Request('http://localhost/v1/knowledge-bases/diagnostics', {
        headers: { authorization: 'Bearer tok-1' }
      })
    )
    expect(await readJson(diagnostics)).toMatchObject({
      available: true,
      knowledgeBaseCount: 1,
      documentCount: 1
    })
  })

  function createStore(
    overrides: Partial<KnowledgeCapabilityConfig> = {},
    extra: {
      fetchImpl?: typeof fetch
    } = {}
  ) {
    const store = new SqliteKnowledgeStore({
      rootDir: join(dir, 'knowledge'),
      config: knowledgeConfig(overrides),
      nowIso: () => '2026-06-21T00:00:00.000Z',
      idGenerator: () => `knowledge_${nextId++}`,
      ...extra
    })
    stores.push(store)
    return store
  }

  function knowledgeConfig(overrides: Partial<KnowledgeCapabilityConfig> = {}) {
    return KunCapabilitiesConfig.parse({
      knowledge: {
        enabled: true,
        defaultChunkSizeChars: 600,
        defaultChunkOverlapChars: 80,
        ...overrides
      }
    }).knowledge
  }
})
