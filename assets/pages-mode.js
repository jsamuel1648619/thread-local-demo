const originalFetch = window.fetch.bind(window);
window.fetch = function(input, options) {
 const path = typeof input === 'string' ? input : input.url;
 if (path === '/api/books') return originalFetch('assets/books.json', options);
 if (path.startsWith('/api/')) return Promise.resolve(new Response(JSON.stringify({detail:'무료 웹 데모에서는 로컬 AI와 문장 커뮤니티를 실행하지 않습니다. 로컬 AI 실행·시연 안내를 확인해 주세요.'}), {status:503, headers:{'Content-Type':'application/json'}}));
 return originalFetch(input, options);
};
