export interface TokenCheckResult {
  valid: boolean;
  httpStatus: number;
  error?: string;
  checkedAt: number;
}

export async function checkTokenValidity(token: string, targetBaseUrl: string): Promise<TokenCheckResult> {
  const checkedAt = Date.now();
  try {
    const targetUrl = targetBaseUrl.endsWith('/') ? targetBaseUrl.slice(0, -1) : targetBaseUrl;

    const testPayload = {
      model: "Anthropic/sonnet-4.6",
      messages: [{ role: "user", content: "echo 1" }],
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

    // 任何明确的 HTTP 状态码（不论是 4xx 还是 5xx）都不能直接武断地标为 valid。
    // 但是，上游服务器的 5xx (如 500, 502, 503, 504) 代表上游宕机了，而不是 Key 错了。
    // 所以如果是 5xx，我们返回 valid: true 以防把用户的 Key 错杀标红（或者也可以加上状态说明）。
    // 但是对于 401 (未授权), 403 (禁止访问), 404 (找不到模型), 400 (请求错误) 则绝对是 Key 不合法或被限。
    if (resp.status >= 400 && resp.status < 500) {
      // 特殊处理 429: 有些提供商并发过高时会报 429。批量检测极易触发 429。
      // 我们将其认定为 valid，因为 429 意味着 Key 身份有效，只是额度/并发超了。
      if (resp.status === 429) {
        return { valid: true, httpStatus: resp.status, error: "Rate Limited (Assuming valid)", checkedAt };
      }

      const body = await resp.text().catch(() => '');
      return { valid: false, httpStatus: resp.status, error: body || `HTTP ${resp.status}`, checkedAt };
    }

    // 对于 5xx，我们不能简单地将它禁用，因为等上游恢复后 Key 还是好的
    return { valid: true, httpStatus: resp.status, error: "Upstream 5xx Error", checkedAt };

  } catch (err) {
    // Network error (比如 DNS 解析失败，网络不通)
    // 不能将 Key 标为 Invalid，因为等网络恢复后 Key 是可以用的
    return { valid: true, httpStatus: 0, error: (err as Error).message, checkedAt };
  }
}


