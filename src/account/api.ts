export function csrfToken(): string | null {
  const row = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("meeplemark_csrf="));
  return row ? decodeURIComponent(row.slice(row.indexOf("=") + 1)) : null;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json", ...init.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

