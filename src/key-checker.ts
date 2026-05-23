export interface TokenCheckResult {
  valid: boolean;
  httpStatus: number;
  error?: string;
  checkedAt: number;
}

export async function checkTokenValidity(token: string, targetBaseUrl: string): Promise<TokenCheckResult> {
  const checkedAt = Date.now();
  try {
    // 采用真实的对话测试来验证 Key 是否可用
    const targetUrl = targetBaseUrl.endsWith('/') ? targetBaseUrl.slice(0, -1) : targetBaseUrl;

    const testPayload = {
      model: "Google/gemini-3.1-pro-preview", // 使用用户指定的基础测试模型
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
      stream: false
    };

    const resp = await fetch(`${targetUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-api-key': token
      },
      body: JSON.stringify(testPayload)
    });

    if (resp.ok) {
      return { valid: true, httpStatus: resp.status, checkedAt };
    }

    if (resp.status === 401 || resp.status === 403 || resp.status === 429 || resp.status === 400 || resp.status === 404) {
      const body = await resp.text().catch(() => '');
      return { valid: false, httpStatus: resp.status, error: body || `HTTP ${resp.status}`, checkedAt };
    }

    // 5xx or other errors — server issue, not necessarily invalid key
    return { valid: true, httpStatus: resp.status, checkedAt };
  } catch (err) {
    // Network error — can't determine validity, assume valid to avoid disabling by mistake
    return { valid: true, httpStatus: 0, error: (err as Error).message, checkedAt };
  }
}


