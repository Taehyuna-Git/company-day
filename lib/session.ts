/** Only use with identity headers supplied by the Sites dispatcher. */
export function sessionFromHeaders(headers: Pick<Headers, 'get'>) {
  const id = headers.get('oai-authenticated-user-id');
  const email = headers.get('oai-authenticated-user-email');
  if (!id || !email) return null;
  let name = email;
  if (headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(headers.get('oai-authenticated-user-full-name') || '') || email; } catch {}
  }
  return {name, email, provider: 'ChatGPT' as const};
}

export function sessionResponse(headers: Pick<Headers, 'get'>) {
  return Response.json({user: sessionFromHeaders(headers)}, {
    headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'},
  });
}
