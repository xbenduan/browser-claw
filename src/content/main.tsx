// ============ Browser Claw — Enhanced Content Script ============
// 运行在目标网页上下文中，负责：
// 1. 代理执行 HTTP 请求（自动携带站点 Cookie）
// 2. CSRF Token 自动检测
// 3. 页面信息收集
// 4. 页面内容读取
// 5. 请求超时 & 取消支持

console.log('[Browser Claw] Content Script loaded on', window.location.hostname);

// ============ 请求执行器 ============
class RequestExecutor {
  private pendingRequests: Map<string, AbortController> = new Map();

  async execute(payload: {
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
    requestId?: string;
  }) {
    const { method, url, body, headers, timeout = 30000, requestId } = payload;

    const controller = new AbortController();
    if (requestId) {
      this.pendingRequests.set(requestId, controller);
    }

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const csrfToken = this.getCSRFToken();
      const finalHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };
      if (csrfToken) {
        finalHeaders['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: 'include',
      });

      const contentType = response.headers.get('content-type');
      let data: unknown;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else if (contentType?.includes('text/')) {
        data = { text: await response.text() };
      } else {
        data = { blob: true, size: response.headers.get('content-length') };
      }

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { success: false, error: 'Request timed out or was cancelled' };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeoutId);
      if (requestId) {
        this.pendingRequests.delete(requestId);
      }
    }
  }

  cancel(requestId: string): void {
    const controller = this.pendingRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.pendingRequests.delete(requestId);
    }
  }

  private getCSRFToken(): string | null {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) return meta.getAttribute('content');

    const match = document.cookie.match(/(?:^|;\s*)csrf[_-]?token=([^;]+)/i);
    if (match) return decodeURIComponent(match[1]);

    return null;
  }
}

// ============ 页面信息收集器 ============
class PageInfoCollector {
  getPageInfo() {
    return {
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
    };
  }
}

// ============ 页面内容读取器 ============
class PageContentReader {
  readContent(options?: { maxLength?: number; includeLinks?: boolean; includeHeadings?: boolean }) {
    const maxLength = options?.maxLength ?? 15000;
    const includeLinks = options?.includeLinks ?? true;
    const includeHeadings = options?.includeHeadings ?? true;

    try {
      const url = window.location.href;
      const title = document.title;
      const hostname = window.location.hostname;

      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ||
        document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        '';

      const bodyContent = this.extractMainContent();

      const truncated = bodyContent.length > maxLength
        ? bodyContent.slice(0, maxLength) + '\n\n[内容过长，已截断...]'
        : bodyContent;

      const headings: { level: number; text: string }[] = [];
      if (includeHeadings) {
        const headingEls = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headingEls.forEach((el) => {
          const text = (el as HTMLElement).innerText?.trim();
          if (text && text.length < 200) {
            const level = parseInt(el.tagName.charAt(1));
            headings.push({ level, text });
          }
        });
      }

      const links: { text: string; href: string }[] = [];
      if (includeLinks) {
        const linkEls = document.querySelectorAll('a[href]');
        const seen = new Set<string>();
        linkEls.forEach((el) => {
          const href = (el as HTMLAnchorElement).href;
          const text = (el as HTMLElement).innerText?.trim();
          if (text && href && !seen.has(href) && !href.startsWith('javascript:') && text.length < 200) {
            seen.add(href);
            links.push({ text: text.slice(0, 100), href });
          }
        });
        links.splice(50);
      }

      return {
        success: true,
        url,
        title,
        hostname,
        content: truncated,
        contentLength: bodyContent.length,
        excerpt: truncated.slice(0, 300),
        metaDescription: metaDesc,
        headings: headings.slice(0, 30),
        links,
      };
    } catch (error: unknown) {
      return {
        success: false,
        url: window.location.href,
        title: document.title,
        hostname: window.location.hostname,
        content: '',
        contentLength: 0,
        excerpt: '',
        metaDescription: '',
        headings: [],
        links: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private extractMainContent(): string {
    const candidateSelectors: string[] = [
      'article',
      'main',
      '[role="main"]',
      '#content',
      '.content',
      '#main-content',
      '.main-content',
    ];

    const candidates: HTMLElement[] = [];
    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el) candidates.push(el as HTMLElement);
    }

    let mainEl: HTMLElement | null = null;
    let maxLen = 0;
    for (const el of candidates) {
      const text = el.innerText?.trim() || '';
      if (text.length > maxLen) {
        maxLen = text.length;
        mainEl = el;
      }
    }

    if (!mainEl || maxLen < 200) {
      mainEl = document.body;
    }

    const clone = mainEl.cloneNode(true) as HTMLElement;

    const noiseSelectors: string[] = [
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header', 'footer',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '.sidebar', '.nav', '.menu', '.ad', '.advertisement', '.ads',
      '.cookie-banner', '.popup', '.modal',
      '[aria-hidden="true"]',
    ];
    for (const selector of noiseSelectors) {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    }

    const text = clone.innerText || '';
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }
}

// ============ 初始化 & 消息监听 ============
const executor = new RequestExecutor();
const collector = new PageInfoCollector();
const contentReader = new PageContentReader();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  switch (request.type) {
    case 'EXECUTE_API':
      executor
        .execute(request.payload)
        .then((result) => sendResponse(result))
        .catch((err: Error) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'CANCEL_REQUEST':
      executor.cancel(request.payload.requestId);
      sendResponse({ success: true });
      return false;

    case 'GET_PAGE_INFO':
      sendResponse(collector.getPageInfo());
      return false;

    case 'READ_PAGE_CONTENT':
      try {
        const result = contentReader.readContent(request.payload);
        sendResponse(result);
      } catch (err: unknown) {
        sendResponse({
          success: false,
          url: window.location.href,
          title: document.title,
          hostname: window.location.hostname,
          content: '',
          contentLength: 0,
          excerpt: '',
          metaDescription: '',
          headings: [],
          links: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return false;

    case 'PING':
      sendResponse({ type: 'PONG', timestamp: Date.now() });
      return false;
  }
});
