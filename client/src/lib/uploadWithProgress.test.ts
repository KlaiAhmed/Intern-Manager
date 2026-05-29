import { uploadWithProgress } from './uploadWithProgress'

class FakeXMLHttpRequest {
  static instances: FakeXMLHttpRequest[] = []

  upload = {} as XMLHttpRequestUpload
  method = ''
  url = ''
  requestBody: Document | XMLHttpRequestBodyInit | null = null
  requestHeaders = new Map<string, string>()
  responseHeaders = new Map<string, string>()
  responseText = ''
  status = 0
  statusText = ''
  withCredentials = false
  onabort: ((this: XMLHttpRequest, ev: ProgressEvent) => unknown) | null = null
  onerror: ((this: XMLHttpRequest, ev: ProgressEvent) => unknown) | null = null
  onload: ((this: XMLHttpRequest, ev: ProgressEvent) => unknown) | null = null

  constructor() {
    FakeXMLHttpRequest.instances.push(this)
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders.set(name, value)
  }

  getResponseHeader(name: string) {
    return this.responseHeaders.get(name.toLowerCase()) ?? null
  }

  send(body?: Document | XMLHttpRequestBodyInit | null) {
    this.requestBody = body ?? null
  }

  abort() {
    this.onabort?.call(this as unknown as XMLHttpRequest, new ProgressEvent('abort'))
  }

  emitProgress(loaded: number, total: number) {
    const event = {
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent<XMLHttpRequestEventTarget>

    this.upload.onprogress?.call(this as unknown as XMLHttpRequest, event)
  }

  respond(status: number, payload: unknown) {
    this.status = status
    this.responseHeaders.set('content-type', 'application/json')
    this.responseText = JSON.stringify(payload)
    this.onload?.call(this as unknown as XMLHttpRequest, new ProgressEvent('load'))
  }
}

describe('uploadWithProgress', () => {
  beforeEach(() => {
    FakeXMLHttpRequest.instances = []
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
    document.cookie = 'csrf_token=test-csrf'
  })

  afterEach(() => {
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    vi.unstubAllGlobals()
  })

  it('sends cookie-authenticated XHR uploads and reports computed progress', async () => {
    const formData = new FormData()
    formData.append('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }))
    const progressValues: number[] = []

    const uploadPromise = uploadWithProgress<{ ok: boolean }>({
      path: '/api/files',
      formData,
      onProgress: (progress) => {
        if (progress.percent !== null) {
          progressValues.push(progress.percent)
        }
      },
    })

    const xhr = FakeXMLHttpRequest.instances[0]
    expect(xhr).toBeDefined()
    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('http://localhost:5184/api/files')
    expect(xhr.withCredentials).toBe(true)
    expect(xhr.requestBody).toBe(formData)
    expect(xhr.requestHeaders.get('accept')).toBe('application/json')
    expect(xhr.requestHeaders.get('x-csrf-token')).toBe('test-csrf')

    xhr.emitProgress(40, 100)
    xhr.respond(200, { ok: true })

    await expect(uploadPromise).resolves.toEqual({ ok: true })
    expect(progressValues).toEqual([40])
  })
})
