(() => {
  'use strict';
  const launcher = document.querySelector('#chatToggle');
  const bubble = document.querySelector('#mascotBubble');
  if (!launcher || !bubble) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let state = 'idle', happyTimer, scrollTimer, frame = 0, lastY = window.scrollY;
  const labels = {idle:'다음 한 권, 같이 찾을까요?',reading:'책장을 살펴보고 있어요…',happy:'마음에 남을 이야기를 찾았어요!',error:'괜찮아요. 다시 함께 살펴봐요.'};
  // app.js dispatches events; no model/network dependency in the mascot controller.
  document.addEventListener('gadoal:state', event => {
    if (!Object.hasOwn(labels,event.detail?.state)) return;
    state = event.detail.state;
    clearTimeout(happyTimer);
    launcher.classList.remove('is-reading','is-happy','is-error');
    if (state !== 'idle') launcher.classList.add('is-'+state);
    bubble.textContent = labels[state];
    if (state === 'happy') happyTimer = setTimeout(() => {
      state = 'idle';launcher.classList.remove('is-happy');bubble.textContent=labels.idle;
    },2600);
  });
  document.addEventListener('gadoal:panel',event => {
    launcher.classList.toggle('is-open',!!event.detail?.open);
    launcher.setAttribute('aria-label',event.detail?.open?'가도알 독서 대화 닫기':'가도알과 독서 대화 열기');
  });
  window.addEventListener('scroll',() => {
    if (reducedMotion.matches || document.hidden || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const delta = window.scrollY-lastY;lastY=window.scrollY;
      if (Math.abs(delta)<2) return;
      launcher.style.setProperty('--scroll-lean',delta>0?'4deg':'-4deg');
      launcher.classList.add('is-scrolling');
      clearTimeout(scrollTimer);
      scrollTimer=setTimeout(()=>launcher.classList.remove('is-scrolling'),350);
    });
  },{passive:true});
  reducedMotion.addEventListener('change',()=>{lastY=window.scrollY;if(reducedMotion.matches)launcher.classList.remove('is-scrolling');});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearTimeout(scrollTimer);launcher.classList.remove('is-scrolling');}
    else lastY=window.scrollY;
  });
})();
