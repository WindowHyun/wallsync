// 직접 입력 URL 검증 — 순수 로직 (단위 테스트 대상)

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * 배경화면 이미지 URL로 쓸 수 있는지 검사한다.
 * - http(s)://host 형태만 허용. 그 외(빈 값·일반 문자열·javascript: 등)는 거부.
 * - http 는 거부한다: 앱이 cleartext 를 허용하지 않아(Android 9+ 기본 차단) 적용·자동 갱신이 실패한다.
 */
export function validateImageUrl(raw: string): UrlCheck {
  const v = raw.trim();
  if (!v) return { ok: false, error: "이미지 URL을 입력하세요" };
  let u: URL;
  try { u = new URL(v); } catch { return { ok: false, error: "올바른 URL 형식이 아닙니다 (예: https://example.com/image.png)" }; }
  if (u.protocol === "http:") return { ok: false, error: "https:// 주소만 사용할 수 있습니다 (http는 Android에서 차단됩니다)" };
  if (u.protocol !== "https:") return { ok: false, error: "https:// 로 시작하는 주소만 사용할 수 있습니다" };
  if (!u.hostname) return { ok: false, error: "올바른 URL 형식이 아닙니다 (호스트가 없습니다)" };
  return { ok: true, url: v };
}
