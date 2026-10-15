(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  if (!$('#sentences')) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const sourceInfo = q => {
    if (!q.source_url || !/^https:\/\//.test(q.source_url)) return '';
    return `<div class="sentence-citation">${q.curated?'<span class="curation-label">시연용 큐레이션</span>':''}<small>${esc(q.edition || '')}</small><a href="${esc(q.source_url)}" target="_blank" rel="noopener noreferrer">인용 출처 · ${esc(q.source_label || '확인하기')} ↗</a></div>`;
  };
  const modal = id => bootstrap.Modal.getOrCreateInstance($(id));
  let profile = null, tab = 'all', quotes = [], cup = null, afterProfile = null, discussion = null, feedVersion = 0;
  let cupBusy = false;
  async function api(path, body) {
    const response = await fetch('/api/community/'+path, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data = await response.json().catch(()=>({detail:'서버를 통해 페이지를 열어 주세요.'}));
    if (!response.ok) throw new Error(data.detail || '요청을 처리하지 못했습니다.');
    return data;
  }
  function requireProfile(action) {
    if (profile) return action();
    afterProfile = action;
    $('#readerName').value = '';
    $('#profileStatus').textContent = '';
    modal('#profileModal').show();
  }
  function updateProfile() { $('#readerProfile').textContent = profile ? `${profile.name} 님의 독서 프로필 ↗` : '독서 프로필 만들기 ↗'; }
  $('#readerProfile').addEventListener('click',()=>{afterProfile=null;$('#readerName').value=profile?.name || '';modal('#profileModal').show();});
  $('#profileModal').addEventListener('shown.bs.modal',()=>$('#readerName').focus());
  $('#profileModal').addEventListener('hidden.bs.modal',()=>{const action=afterProfile;afterProfile=null;if(action && profile) action();});
  $('#readerForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;
    try { const data=await api('profile',{name:$('#readerName').value.trim()});profile=data.profile;updateProfile();modal('#profileModal').hide();await loadFeed(); }
    catch(error){$('#profileStatus').textContent=error.message;}finally{button.disabled=false;}
  });
  function showWriter(){requireProfile(()=>{$('#sentenceFormStatus').textContent='';modal('#sentenceModal').show();});}
  $('#writeSentence').addEventListener('click',showWriter);$('#emptyWrite').addEventListener('click',showWriter);
  $('#sentenceModal').addEventListener('shown.bs.modal',()=>$('#sentenceBook').focus());
  $('#sentenceText').addEventListener('input',()=>{$('#sentenceLength').textContent=`${$('#sentenceText').value.length} / 200`;});
  let books=[];
  fetch('/api/books').then(r=>r.ok?r.json():[]).then(data=>{books=data;$('#sentenceBooks').innerHTML=books.map(b=>`<option value="${esc(b.title)}"></option>`).join('');}).catch(()=>{});
  $('#sentenceBook').addEventListener('input',()=>{const book=books.find(b=>b.title===$('#sentenceBook').value);if(book)$('#sentenceAuthor').value=book.author;});
  $('#sentenceForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;$('#sentenceFormStatus').textContent='저장하고 있어요…';
    try{
      await api('quotes',{book:$('#sentenceBook').value,author:$('#sentenceAuthor').value,sentence:$('#sentenceText').value,page:$('#sentencePage').value,memo:$('#sentenceMemo').value,public:$('#sentencePublic').checked});
      const isPublic=$('#sentencePublic').checked;
      $('#sentenceForm').reset();$('#sentenceLength').textContent='0 / 200';modal('#sentenceModal').hide();
      tab=isPublic?'all':'mine';await loadFeed();$('#sentenceNotice').textContent=isPublic?'한 문장을 나눴어요. 누군가의 다음 책이 될지도 몰라요.':'나만의 독서 노트에 저장했어요.';
    }catch(error){$('#sentenceFormStatus').textContent=error.message;}finally{button.disabled=false;}
  });
  async function loadFeed(){
    const version=++feedVersion;
    try{
      const params=new URLSearchParams({mine:tab==='mine'?'1':'0',saved:tab==='saved'?'1':'0',q:$('#sentenceSearch').value,sort:$('#sentenceSort').value});
      const data=await api('quotes?'+params);
      if(version!==feedVersion)return;
      quotes=data.quotes;$('#publicCount').textContent=data.stats.public;$('#sentenceBookCount').textContent=data.stats.books;$('#mySentenceCount').textContent=data.stats.mine;
      $('#sentenceNotice').textContent='';
      document.querySelectorAll('[data-sentence-tab]').forEach(button=>{const active=button.dataset.sentenceTab===tab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
      $('#sentenceEmpty').hidden=quotes.length>0;
      $('#sentenceEmpty h3').textContent=$('#sentenceSearch').value?'검색에 맞는 문장이 없어요.':tab==='saved'?'오래 간직하고 싶은 문장을 저장해 보세요.':tab==='mine'?'나만의 독서 노트를 채워보세요.':'첫 번째 밑줄을 기다리고 있어요.';
      $('#sentenceEmpty p').textContent=tab==='saved'?'모두의 밑줄에서 문장의 북마크 버튼을 누르면 여기에 모여요.':'책 제목과 인상 깊은 문장 하나면 충분해요. 당신의 기록이 누군가에게는 새로운 책의 시작이 됩니다.';
      $('#emptyWrite').hidden=tab==='saved';
      $('#sentenceGrid').innerHTML=quotes.map(q=>`<article class="sentence-card"><span class="quote-mark" aria-hidden="true">“</span><blockquote>${esc(q.sentence)}</blockquote>${q.memo?`<p class="sentence-memo">${esc(q.memo)}</p>`:''}<div class="sentence-source"><a href="book-detail.html?title=${encodeURIComponent(q.book)}">${esc(q.book)} ↗</a><small>${esc(q.author)}${q.page?' · '+esc(q.page):''}</small>${sourceInfo(q)}</div><div class="sentence-person"><span>${esc(q.name)} · ${new Date(q.created).toLocaleDateString('ko-KR')}</span>${!q.public?'<span class="sentence-private">나만 보기</span>':''}</div><div class="sentence-actions"><button data-like="${q.id}" class="${q.liked?'liked':''}" aria-pressed="${!!q.liked}" aria-label="문장 공감 ${q.likes}개">${q.liked?'♥':'♡'} ${q.likes}</button>${q.public?`<button data-comments="${q.id}">이야기 ${q.comments}</button>`:''}<button data-bookmark="${q.id}" class="${q.bookmarked?'bookmarked':''}" aria-pressed="${!!q.bookmarked}" aria-label="${q.bookmarked?'문장 북마크 해제':'문장 북마크 저장'}">${q.bookmarked?'▣ 저장됨':'▢ 북마크'}</button><button data-read="${q.id}">읽고 싶어요 ↗</button>${q.mine?`<button data-delete="${q.id}" aria-label="내 문장 삭제">삭제</button>`:''}</div></article>`).join('');
      $('#readingIntentions').hidden=tab!=='mine'||!data.intentions.length;
      $('#readingIntentions').innerHTML='<h3>문장으로 만난 다음 책</h3>'+data.intentions.map(item=>`<a href="book-detail.html?title=${encodeURIComponent(item.book)}">${item.kind==='reread'?'↺ 다시 읽기':'＋ 읽고 싶어요'} · ${esc(item.book)} ↗</a>`).join('');
    }catch(error){if(version===feedVersion){$('#sentenceNotice').textContent=error.message+' 로컬 서버를 실행한 뒤 새로고침해 주세요.';}}
  }
  document.querySelectorAll('[data-sentence-tab]').forEach(button=>button.addEventListener('click',()=>{const next=button.dataset.sentenceTab;if(next!=='all')requireProfile(()=>{tab=next;loadFeed();});else{tab='all';loadFeed();}}));
  let searchTimer;$('#sentenceSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadFeed,250);});$('#sentenceSort').addEventListener('change',loadFeed);
  $('#sentenceGrid').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const q=quotes.find(q=>q.id===Number(Object.values(button.dataset)[0]));if(!q)return;
    if(button.dataset.comments){discussion=q;$('#discussionQuote').textContent=q.sentence;$('#commentStatus').textContent='';modal('#sentenceDiscussion').show();loadComments();return;}
    if(button.dataset.delete){
      if(!button.dataset.confirm){button.dataset.confirm='yes';button.textContent='정말 삭제';return;}
      button.disabled=true;api('delete',{id:q.id}).then(loadFeed).catch(error=>{$('#sentenceNotice').textContent=error.message;button.disabled=false;});return;
    }
    requireProfile(async()=>{
      button.disabled=true;
      try{if(button.dataset.like)await api('like',{id:q.id});else if(button.dataset.bookmark)await api('bookmark',{id:q.id,saved:!q.bookmarked});else await api('intention',{book:q.book,kind:'read'});await loadFeed();if(button.dataset.bookmark)$('#sentenceNotice').textContent=q.bookmarked?'문장 북마크를 해제했어요.':'저장한 문장에 담았어요. 나중에 다시 꺼내 읽어보세요.';if(button.dataset.read)$('#sentenceNotice').textContent='나의 독서 노트에 읽고 싶은 책으로 담았어요.';}
      catch(error){$('#sentenceNotice').textContent=error.message;}finally{button.disabled=false;}
    });
  });
  async function loadComments(){
    const id=discussion?.id;if(!id)return;
    try{const data=await api('comments/'+id);if(id!==discussion?.id)return;$('#sentenceComments').innerHTML=data.comments.length?data.comments.map(c=>`<div class="sentence-comment"><small>${esc(c.name)} · ${new Date(c.created).toLocaleDateString('ko-KR')}</small><p>${esc(c.text)}</p></div>`).join(''):'<p class="small text-muted">이 문장에 첫 번째 이야기를 남겨보세요.</p>';}
    catch(error){$('#commentStatus').textContent=error.message;}
  }
  $('#sentenceCommentForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!profile){$('#commentStatus').textContent='창을 닫고 독서 프로필을 먼저 만들어 주세요.';return;}
    const button=event.submitter;button.disabled=true;
    try{await api('comment',{id:discussion.id,text:$('#sentenceCommentText').value});$('#sentenceCommentForm').reset();$('#commentStatus').textContent='댓글을 남겼어요.';await loadComments();await loadFeed();}catch(error){$('#commentStatus').textContent=error.message;}finally{button.disabled=false;}
  });
  $('#openWorldcup').addEventListener('click',()=>{modal('#worldcupModal').show();if(cup)renderCup();});
  $('#resetCup').addEventListener('click',()=>{if(!cupBusy){cup=null;renderCup();}});
  const examples=[
    '접힌 페이지를 펴자, 잊었다고 생각했던 하루가 다시 시작되었다.',
    '아직 가보지 않은 길에도 내가 좋아할 풍경은 있을 것이다.',
    '나는 대답 대신 의자를 조금 더 가까이 옮겼다.',
    '늦게 피는 꽃에게도 자기만의 계절이 있었다.'
  ].map((sentence,index)=>({id:index+1,sentence,book:'체험용 창작 예문',author:'ThRead 기능 시연',name:'예시',page:''}));
  $('#demoWorldcup').addEventListener('click',()=>{cup={demo:true,size:4,step:0,round:[...examples].sort(()=>Math.random()-.5),winners:[],done:false};renderCup();});
  $('#startWorldcup').addEventListener('click',async()=>{
    if(!profile){$('#cupStatus').textContent='월드컵 창을 닫고 독서 프로필을 먼저 만들어 주세요. 창작 예문 체험은 바로 가능합니다.';return;}
    const button=$('#startWorldcup');button.disabled=true;
    try{cup=await api('cups',{size:Number($('#cupSize').value)});renderCup();}catch(error){$('#cupStatus').textContent=error.message;}finally{button.disabled=false;}
  });
  function renderCup(){
    $('#cupStatus').textContent='';$('#cupIntro').hidden=!!cup;$('#cupPlay').hidden=!cup||cup.done;$('#cupResult').hidden=!cup?.done;
    $('#resetCup').hidden=!cup||cup.done;
    if(!cup)return;
    if(cup.demo){cup.round_size=cup.round.length;cup.match=cup.winners.length+1;cup.pair=cup.round.slice(cup.winners.length*2,cup.winners.length*2+2);if(cup.done)cup.winner=cup.round[0];}
    if(cup.done){
      const q=cup.winner;
      $('#cupResult').innerHTML=`<div class="cup-winner"><span class="eyebrow">${cup.demo?'DEMO · 창작 예문 체험':'YOUR ONE LINE'}</span><h3>당신의 마음에 남은 한 문장</h3><blockquote>“${esc(q.sentence)}”</blockquote><p class="winner-source">${esc(q.book)}<br><small>${esc(q.author)}${q.page?' · '+esc(q.page):''}</small></p>${sourceInfo(q)}<p class="small text-muted">${esc(q.name)} 님이 남긴 문장${cup.demo?' · 실제 도서 인용문이 아닙니다.':''}</p><p class="winner-message">${cup.demo?'공개 문장을 기록하면 실제 책을 발견하는 월드컵을 열 수 있어요.':'이미 읽은 책이라면 다시, 처음 만난 책이라면 첫 페이지부터.'}</p><div class="cup-result-actions">${cup.demo?'':`<button class="btn line-primary" data-cup-intent="read">처음 만난 책, 읽고 싶어요</button><button class="btn line-dark" data-cup-intent="reread">읽었던 책, 다시 읽고 싶어요</button><a class="btn btn-outline-secondary" href="book-detail.html?title=${encodeURIComponent(q.book)}">책 살펴보기 ↗</a>`}<button class="btn btn-outline-secondary" id="cupRestart">새 월드컵</button></div></div>`;
      $('#cupRestart').addEventListener('click',()=>{cup=null;renderCup();});
      document.querySelectorAll('[data-cup-intent]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api('intention',{book:q.book,kind:button.dataset.cupIntent});$('#cupStatus').textContent='나의 독서 노트에 담았어요. 문장에서 시작된 다음 독서를 응원해요.';await loadFeed();}catch(error){$('#cupStatus').textContent=error.message;}finally{button.disabled=false;}}));
      return;
    }
    const progress=Math.round(cup.step/(cup.size-1)*100);$('#cupStage').textContent=`${cup.demo?'체험 · ':''}${cup.round_size===2?'결승':cup.round_size+'강'} ${cup.match} / ${cup.round_size/2}`;$('#cupProgressText').textContent=`${cup.step} / ${cup.size-1} 선택`;
    $('#cupProgress').setAttribute('aria-valuenow',progress);$('#cupProgress .progress-bar').style.width=progress+'%';
    $('#cupPair').innerHTML=cup.pair.map((q,index)=>`<button class="cup-choice" data-cup-choice="${q.id}"><span class="choice-label">SENTENCE ${index?'B':'A'}</span><blockquote>${esc(q.sentence)}</blockquote><small>이 문장이 더 마음에 남아요 ↗</small></button>`).join('');
    $('#cupPair').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>pick(Number(button.dataset.cupChoice))));
  }
  async function pick(id){
    if(cupBusy)return;cupBusy=true;$('#cupPair').querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      if(cup.demo){cup.winners.push(cup.pair.find(q=>q.id===id));cup.step++;if(cup.winners.length*2===cup.round.length){cup.round=cup.winners;cup.winners=[];cup.done=cup.round.length===1;}}
      else cup=await api('pick',{cup:cup.id,step:cup.step,id});
      renderCup();
    }catch(error){$('#cupStatus').textContent=error.message;$('#cupPair').querySelectorAll('button').forEach(b=>b.disabled=false);}finally{cupBusy=false;}
  }
  api('profile').then(async data=>{
    profile=data.profile;updateProfile();await loadFeed();
    const book=new URLSearchParams(location.search).get('recordBook');
    if(book){$('#sentenceBook').value=book.slice(0,120);const known=books.find(b=>b.title===book);if(known)$('#sentenceAuthor').value=known.author;showWriter();}
  }).catch(error=>{$('#sentenceNotice').textContent='문장 커뮤니티에 연결하지 못했습니다. 서버를 실행한 뒤 새로고침해 주세요.';});
})();
