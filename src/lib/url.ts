// 직접 입력 URL 검증 — 순수 로직 (단위 테스트 대상)

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * 배경화면 이미지 URL로 쓸 수 있는지 검사한다.
 * - http(s)://host 형태만 허용. 그 외(빈 값·일반 문자열·javascript:·data:·file: 등)는 거부.
 * - http 도 허용한다: 직접 URL 기능은 임의 호스트의 http 이미지를 받아야 하고, 앱이 cleartext 를
 *   전역 허용(AndroidManifest usesCleartextTraffic, docs/REMAINING_ISSUES.md R7)하는 것이 의도된 계약이다.
 */
export function validateImageUrl(raw: string): UrlCheck {
  const v = raw.trim();
  if (!v) return { ok: false, error: "이미지 URL을 입력해 주세요" };
  let u: URL;
  try { u = new URL(v); } catch { return { ok: false, error: "올바른 URL 형식이 아니에요 (예: https://example.com/image.png)" }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "http:// 또는 https:// 로 시작하는 주소만 사용할 수 있어요" };
  if (!u.hostname) return { ok: false, error: "올바른 URL 형식이 아니에요 (호스트가 없어요)" };
  return { ok: true, url: v };
}
