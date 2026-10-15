(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const panel = $('#chatPanel'), input = $('#chatInput'), messages = $('#chatMessages');
  const history = [];
  let pending = false, catalog = [];
  const mascotState = state => document.dispatchEvent(new CustomEvent('gadoal:state',{detail:{state}}));
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const readSaved = () => { try { const saved = JSON.parse(localStorage.getItem('thread-books') || '[]'); return Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []; } catch { return []; } };
  async function checkHealth() {
    document.querySelector("#modelStatus").textContent = "무료 웹 데모 · 로컬 AI 실행 안내를 확인해 주세요"; return;
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error();
      const health = await response.json();
      $('#modelStatus').textContent = health.ready ? `● 로컬 Qwen 연결됨 · 도서 ${health.books}권` : health.missing?.length ? '모델 설치 필요 · 실행 안내 확인' : 'Ollama 연결 대기 중';
    } catch { $('#modelStatus').textContent = '서버 연결 대기 · start.ps1로 실행해 주세요'; }
  }
  function toggleChat(open) {
    panel.hidden = !open;
    $('#chatToggle').setAttribute('aria-expanded', String(open));
    document.dispatchEvent(new CustomEvent('gadoal:panel',{detail:{open}}));
    if (open) { input.focus({preventScroll:true}); checkHealth(); }
    else $('#chatToggle').focus({preventScroll:true});
  }
  $('#chatToggle').addEventListener('click', () => toggleChat(panel.hidden));
  $('#chatClose').addEventListener('click', () => toggleChat(false));
  document.querySelectorAll('[data-open-chat]').forEach(button => button.addEventListener('click', () => toggleChat(true)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) toggleChat(false); });
  function addMessage(text, type = '') {
    const node = document.createElement('div');
    node.className = `message ${type}`;
    node.textContent = text;
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }
  async function send(prompt) {
    prompt = prompt.trim();
    if (!prompt || pending) return;
    toggleChat(true); addMessage("웹 데모에는 AI 서버가 연결되어 있지 않습니다. 화면 상단의 로컬 AI 실행·시연 안내를 확인해 주세요."); return;
    if (prompt.length > 2000) return;
    toggleChat(true);
    pending = true;
    mascotState('reading');
    $('#chatSend').disabled = true;
    document.querySelectorAll('[data-prompt]').forEach(button => button.disabled = true);
    addMessage(prompt, 'user');
    input.value = '';
    const waiting = addMessage('가도알이 책장을 살펴보고 있어요. 첫 답변은 조금 걸릴 수 있어요…','waiting');
    waiting.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 240000);
    try {
      const bookTitle = $('#detailTitle') && /이\s*책|그\s*책|이\s*작품/.test(prompt) ? new URLSearchParams(location.search).get('title') || '' : '';
      const response = await fetch('/api/v1/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,history:history.slice(-8),book_title:bookTitle}),signal:controller.signal});
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || '답변을 받지 못했습니다.');
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('빈 답변을 받았습니다. 다시 질문해 주세요.');
      waiting.textContent = result.answer;
      waiting.classList.remove('waiting');
      mascotState('happy');
      if (result.sources?.length) {
        const sources = document.createElement('small');
        sources.className = 'source-list';
        sources.append('검색 참고 도서 · ');
        result.sources.forEach((book,index) => {
          if(index)sources.append(', ');
          const link = document.createElement('a');
          link.href = 'book-detail.html?title='+encodeURIComponent(book.title);
          link.textContent = book.title;
          sources.append(link);
          if(/^https:\/\//.test(book.url || '')){
            const source = document.createElement('a');
            source.href=book.url;source.target='_blank';source.rel='noopener noreferrer';source.textContent=' [소개 출처 ↗]';sources.append(source);
          }
        });
        waiting.append(sources);
      }
      history.push({role:'user',content:prompt},{role:'assistant',content:result.answer});
    } catch (error) {
      mascotState('error');
      waiting.classList.remove('waiting');
      waiting.classList.add('error');
      waiting.textContent = error.name === 'AbortError' ? '응답 시간이 초과되었습니다. 조금 더 짧은 질문으로 다시 시도해 주세요.' : (error.message.includes('fetch') ? '서버에 연결할 수 없습니다. start.ps1로 실행한 페이지인지 확인해 주세요.' : error.message);
      const retry = document.createElement('button');
      retry.className = 'btn btn-sm btn-light d-block mt-2'; retry.textContent = '다시 시도';
      retry.addEventListener('click', () => { if (!pending) { waiting.remove(); send(prompt); } });
      waiting.append(retry);
    } finally {
      clearTimeout(timer); pending = false; waiting.removeAttribute('aria-busy');
      $('#chatSend').disabled = false;
      document.querySelectorAll('[data-prompt]').forEach(button => button.disabled = false);
      messages.scrollTop = messages.scrollHeight;
    }
  }
  $('#chatForm').addEventListener('submit', event => { event.preventDefault(); send(input.value); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(input.value); } });
  document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => send(button.dataset.prompt)));
  document.querySelectorAll('[data-genre]').forEach(button => button.addEventListener('click', () => { toggleChat(true); input.value = `${button.dataset.genre} 분야의 책을 추천해줘`; }));
  $('#bookCarousel')?.addEventListener('slid.bs.carousel', event => { $('#slideNumber').textContent = String(event.to + 1).padStart(2, '0'); });

  const threads = window.THREADS || [];
  function renderThreads(page = 1) {
    const grid = $('#threadGrid');
    if (!grid) return;
    // Six provided sample posts, three per page.
    grid.innerHTML = threads.map((thread,index) => ({thread,index})).slice((page-1)*3,page*3).map(({thread,index}) => `<div class="col-12 col-sm-4"><article class="card"><img class="card-img-top" src="assets/threads/img${index+1}.jpg" alt="쓰레드 이야기 이미지" loading="lazy"><div class="card-body"><h3 class="card-title"><button class="text-start border-0 bg-transparent p-0" data-thread="${index}">${escapeHTML(thread[0])}</button></h3><p class="card-text">${escapeHTML(thread[1])}</p><div class="card-footer">${escapeHTML(thread[2])} <span aria-hidden="true">·</span> <span class="book-name">${escapeHTML(thread[3])}</span></div></div></article></div>`).join('');
    document.querySelectorAll('[data-page]').forEach(button => { const active = Number(button.dataset.page) === page; button.parentElement.classList.toggle('active', active); if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); });
    grid.querySelectorAll('[data-thread]').forEach(button => button.addEventListener('click', () => {
      const thread = threads[Number(button.dataset.thread)];
      $('#threadModalTitle').textContent = thread[0];
      $('#threadModalBody').innerHTML = `<p>${escapeHTML(thread[1])}</p><p class="small text-muted">${escapeHTML(thread[2])} · ${escapeHTML(thread[3])}</p><small class="text-muted">레이아웃 확인을 위한 예시 쓰레드입니다.</small>`;
      bootstrap.Modal.getOrCreateInstance($('#threadModal')).show();
    }));
  }
  renderThreads();
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => renderThreads(Number(button.dataset.page))));
  async function loadBooks() {
    if (catalog.length) return catalog;
    const response = await fetch('/api/books');
    if (!response.ok) throw new Error('도서 목록을 불러오지 못했습니다.');
    catalog = await response.json();
    return catalog;
  }
  function searchBooks() {
    const query = $('#bookSearch').value.trim().toLocaleLowerCase();
    const found = catalog.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(query));
    $('#searchResults').innerHTML = found.length ? found.slice(0,30).map(book => `<div class="search-result"><a href="book-detail.html?title=${encodeURIComponent(book.title)}">${escapeHTML(book.title)} ↗</a><p>${escapeHTML(book.author)} · ${escapeHTML(book.category)} · ${escapeHTML(book.date)}</p></div>`).join('') : '<p class="small mt-3">검색 결과가 없습니다.</p>';
  }
  $('#searchModal').addEventListener('shown.bs.modal', async () => { $('#bookSearch').focus(); try { await loadBooks(); searchBooks(); } catch { $('#searchResults').textContent = '검색하려면 start.ps1로 실행해 주세요.'; } });
  $('#bookSearch').addEventListener('input', searchBooks);
  $('#myModal').addEventListener('show.bs.modal', () => {
    const saved = readSaved();
    $('#savedBooks').innerHTML = saved.length ? saved.map(title => `<div class="search-result"><a href="book-detail.html?title=${encodeURIComponent(title)}">${escapeHTML(title)} ↗</a></div>`).join('') : '<p>아직 담은 책이 없어요. 도서 상세 페이지에서 관심 도서를 담아보세요.</p>';
  });
  if ($('#detailTitle')) {
    const title = new URLSearchParams(location.search).get('title') || '채식주의자';
    $('#detailTitle').textContent = title;
    if ($('#recordBookLink')) $('#recordBookLink').href = '06-main.html?recordBook=' + encodeURIComponent(title) + '#sentences';
    $('#detailAsk').addEventListener('click', () => send(`${title}에 대해 알려줘`));
    $('#detailCover').hidden = true;
    loadBooks().then(books => {
      const book = books.find(book => book.title === title);
      $('#detailAuthor').textContent = book ? [book.author,book.publisher,book.date].filter(Boolean).join(' · ') : '등록된 서지 정보가 없는 책입니다.';
      if(book?.cover){$('#detailCover').hidden=false;$('#detailCover').src=book.cover;$('#detailCover').alt=`${book.title} 표지`;}
      $('#detailDescription').textContent = book ? [book.description || `${book.category || '문학'} 분야의 도서입니다.`, book.price?`정가 ${Number(book.price).toLocaleString()}원`:'',book.isbn?`ISBN ${book.isbn}`:'','궁금한 점은 가도알에게 물어보세요.'].filter(Boolean).join(' ') : '이 책의 상세 정보는 아직 등록되지 않았습니다.';
      if(/^https:\/\//.test(book?.source_url || '')){
        const source=document.createElement('a');source.href=book.source_url;source.target='_blank';source.rel='noopener noreferrer';source.className='d-block small mt-2 text-white';source.textContent='도서 소개 출처 확인 ↗';$('#detailDescription').append(source);
      }
    }).catch(() => { $('#detailAuthor').textContent = '도서 정보를 불러오려면 로컬 서버를 실행해 주세요.'; });
    const saveButton = $('#saveBook');
    const refresh = () => { const saved = readSaved().includes(title); saveButton.textContent = saved ? '♥ 나의 책장에 담았어요' : '♡ 나의 책장에 담기'; saveButton.setAttribute('aria-pressed',String(saved)); };
    refresh();
    saveButton.addEventListener('click', () => { const saved = readSaved(); try { localStorage.setItem('thread-books',JSON.stringify(saved.includes(title) ? saved.filter(item => item !== title) : [...saved,title])); refresh(); } catch { saveButton.textContent = '브라우저 저장 공간을 사용할 수 없어요'; } });
  }
})();
