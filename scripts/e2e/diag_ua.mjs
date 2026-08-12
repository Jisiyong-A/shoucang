/* Check what the anonymous resolver's exact fetch sees (custom UA) and
 * whether the SSR DOM carries title/desc/images. */
const url = process.argv[2];
const res = await fetch(url, {
  method: 'GET',
  redirect: 'manual',
  credentials: 'omit',
  signal: AbortSignal.timeout(30000),
  headers: {
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'User-Agent': 'ShouCangFavorites/0.1 anonymous-local-resolver',
  },
});
console.log('status:', res.status, '| redirect:', res.headers.get('location') || '-');
let html = '';
if (res.status >= 300 && res.status < 400) {
  const loc = res.headers.get('location');
  const r2 = await fetch(new URL(loc, url).toString(), {
    headers: { 'User-Agent': 'ShouCangFavorites/0.1 anonymous-local-resolver', 'Accept-Language': 'zh-CN,zh;q=0.9' },
    credentials: 'omit',
    signal: AbortSignal.timeout(30000),
  });
  console.log('followed redirect ->', r2.status);
  html = await r2.text();
} else {
  html = await res.text();
}
console.log('html bytes:', html.length);

// marker checks
console.log('has __INITIAL_STATE__:', html.includes('window.__INITIAL_STATE__='));
console.log('has noteDetailMap:', html.includes('noteDetailMap'));
console.log('has xsec_token page:', html.includes('xsec_token'));
console.log('has og:title:', html.includes('og:title'));

// extract og meta + title/desc via regex
const ogTitle = html.match(/property="og:title"\s+content="([^"]*)"/)?.[1] || '';
const ogDesc = html.match(/property="og:description"\s+content="([^"]*)"/)?.[1] || '';
console.log('og:title:', ogTitle.slice(0, 60));
console.log('og:description len:', ogDesc.length);

// count image urls that look like note images
const imgMatches = html.match(/https:\/\/sns-webpic-qc\.xhscdn\.com\/[^"\\'\\s)]+/g) || [];
const unique = [...new Set(imgMatches)];
console.log('xhscdn image urls found:', unique.length);
unique.slice(0, 5).forEach((u) => console.log('  ', u.slice(0, 90)));
