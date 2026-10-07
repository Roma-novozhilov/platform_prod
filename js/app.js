/* Контроллер: роутинг, события, модальные окна */
const $ = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => [...r.querySelectorAll(s)];
const viewEl = $('#view');
let lastRoute = null, timerInt = null;

function saveQuiet(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h=setTimeout(()=>t.classList.remove('show'),3200);
}
function applyTheme(){ if(S.theme==='auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme=S.theme; }

/* ---------- роутер ---------- */
function parseRoute(){ const h=(location.hash||'#today').slice(1); const [a,b]=h.split('/'); return {name:a||'today', arg:b}; }
function render(){
  const r=parseRoute();
  let html='';
  switch(r.name){
    case 'experts': html=vExperts(); break;
    case 'expert': html=vExpert(r.arg); break;
    case 'call': html=vCall(r.arg); break;
    case 'scripts': html=vScripts(r.arg); break;
    case 'tasks': html=vTasks(); break;
    case 'stats': html=vStats(r.arg); break;
    case 'path': html=vPath(); break;
    case 'settings': html=vSettings(); break;
    default: r.name='today'; html=vToday();
  }
  viewEl.innerHTML = html;
  const key=r.name+'/'+(r.arg||'');
  if(key!==lastRoute){ window.scrollTo(0,0); lastRoute=key; }
  const base = r.name==='expert' ? 'experts' : r.name;
  $$('[data-nav]').forEach(a=>a.classList.toggle('on', a.dataset.nav===base));
  const n = todayActions().length + S.tasks.filter(x=>!x.done&&x.due&&x.due<=D.today()).length;
  $$('.nav-badge').forEach(b=>{ b.textContent=n; b.hidden=!n; });
  clearInterval(timerInt);
  if(r.name==='scripts' && (!r.arg||r.arg==='first')) lintNow();
  if(r.name==='stats') calcNow();
  if(r.name==='call' && S.callDraft && S.callDraft.running) timerInt=setInterval(tick,500);
}
function tick(){
  const dr=S.callDraft, t=$('#timer'); if(!dr||!t){ clearInterval(timerInt); return; }
  const el=callElapsed(dr); t.textContent=fmtTime(el);
  const total=CALL_STEPS.reduce((a,s)=>a+s.min,0);
  t.classList.toggle('over', el>total*60000);
  let acc=0, idx=CALL_STEPS.length-1;
  for(let i=0;i<CALL_STEPS.length;i++){ acc+=CALL_STEPS[i].min*60000; if(el<acc){ idx=i; break; } }
  const ts=$('#tstep'); if(ts) ts.textContent='Шаг '+(idx+1)+': '+CALL_STEPS[idx].title;
}
window.addEventListener('hashchange', render);
onChange(render);

/* ---------- модальные окна ---------- */
function modal(title, body){
  const m=$('#modal');
  m.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-h"><h3>${esc(title)}</h3><button class="icon-btn" data-a="close" aria-label="Закрыть">✕</button></div>${body}</div>`;
  m.hidden=false; document.body.classList.add('noscroll');
  const f=$('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea', m); if(f && !matchMedia('(pointer:coarse)').matches) f.focus();
}
function closeModal(){ const m=$('#modal'); m.hidden=true; m.innerHTML=''; document.body.classList.remove('noscroll'); }
$('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });

const opt = (arr,sel) => arr.map(x=>`<option ${x===sel?'selected':''}>${esc(x)}</option>`).join('');
function expertForm(e){
  const x=e||{criteria:{}};
  modal(e?'Изменить эксперта':'Новый эксперт',`<form data-form="expert"><input type="hidden" name="id" value="${esc(x.id||'')}">
    <div class="form-grid">
    <label>Имя / ник*<input class="inp" name="name" required value="${esc(x.name||'')}" autocomplete="off"></label>
    <label>Ссылка на профиль<input class="inp" name="link" type="url" inputmode="url" value="${esc(x.link||'')}" placeholder="https://"></label>
    <label>Ниша<input class="inp" name="niche" list="niches" value="${esc(x.niche!=null?x.niche:S.profile.niche)}"><datalist id="niches">${['Спорт','Финансы','Психология','Обучение','Красота'].map(n=>`<option>${n}</option>`).join('')}</datalist></label>
    <label>Где нашёл / канал связи<select class="inp" name="channel">${opt([...new Set([...CHANNELS_CONTACT,...CHANNELS_SEARCH])], x.channel||'Telegram')}</select></label></div>
    <label>Почему выбрал именно его<textarea class="inp" name="why" rows="2" placeholder="Одна фраза">${esc(x.why||'')}</textarea></label>
    ${e?'':`<fieldset><legend>Критерии (отметь, что видно)</legend>${CRITERIA.map(c=>`<label class="chk row-chk"><input type="checkbox" name="crit_${c.id}"><span></span>${esc(c.label)}</label>`).join('')}</fieldset>`}
    <div class="row end gap"><button type="button" class="btn" data-a="close">Отмена</button><button class="btn primary" type="submit">Сохранить</button></div></form>`);
}
function touchForm(id){
  const list=S.experts.filter(e=>e.stage!=='lost');
  if(!list.length){ toast('Сначала добавь эксперта'); expertForm(); return; }
  const cur = id ? getExpert(id) : null;
  modal('Записать касание',`<form data-form="touch">
    <div class="form-grid">
    <label>Эксперт<select class="inp" name="expertId" id="tExp">${list.map(e=>`<option value="${e.id}" ${cur&&cur.id===e.id?'selected':''}>${esc(e.name)} · ${esc(stageOf(e.stage).label)}</option>`).join('')}</select></label>
    <label>Канал<select class="inp" name="channel" id="tCh">${opt(CHANNELS_CONTACT,(cur||list[0]).channel)}</select></label>
    <label>Дата<input class="inp" type="date" name="date" value="${D.today()}"></label></div>
    <label>Что написал (по желанию)<textarea class="inp" name="text" rows="2" placeholder="Кратко: идея / вопрос"></textarea></label>
    <p class="muted sm">Следующее касание поставится автоматически через ${NORMS.followUpDays} дня. Максимум ${NORMS.maxTouches} попытки.</p>
    <div class="row end gap"><button type="button" class="btn" data-a="close">Отмена</button><button class="btn primary" type="submit">Записать</button></div></form>`);
}
function schedForm(id){
  const e=getExpert(id);
  modal('Назначить созвон',`<form data-form="sched"><input type="hidden" name="id" value="${id}">
    <p class="sm">Эксперт: <b>${esc(e.name)}</b>. Созвон — 15 минут, не больше. Зафиксируй время в переписке.</p>
    <div class="form-grid"><label>Дата<input class="inp" type="date" name="date" required value="${D.add(D.today(),1)}"></label><label>Время<input class="inp" type="time" name="time"></label></div>
    <div class="row end gap"><button type="button" class="btn" data-a="close">Отмена</button><button class="btn primary" type="submit">Назначить</button></div></form>`);
}
function nextForm(id){
  const e=getExpert(id), n=e.next||{date:D.add(D.today(),1),text:''};
  modal('Следующее действие',`<form data-form="next"><input type="hidden" name="id" value="${id}">
    <label>Что сделать*<input class="inp" name="text" required value="${esc(n.text)}"></label>
    <label>Когда<input class="inp" type="date" name="date" required value="${n.date}"></label>
    <div class="row end gap">${e.next?'<button type="button" class="btn danger-o" data-a="next-clear" data-id="'+id+'">Убрать</button>':''}<button type="button" class="btn" data-a="close">Отмена</button><button class="btn primary" type="submit">Сохранить</button></div></form>`);
}
function pauseForm(id){
  const e=getExpert(id);
  modal('Поставить на паузу',`<form data-form="pause"><input type="hidden" name="id" value="${id}">
    <p class="sm"><b>${esc(e.name)}</b> уходит в архив. Вернуться стоит через 2–3 месяца — ситуация меняется.</p>
    <label>Вернуться через<select class="inp" name="days"><option value="30">1 месяц</option><option value="60">2 месяца</option><option value="75" selected>2,5 месяца</option><option value="90">3 месяца</option></select></label>
    <div class="row end gap"><button type="button" class="btn" data-a="close">Отмена</button><button class="btn primary" type="submit">В паузу</button></div></form>`);
}
function taskForm(){
  modal('Новая задача',`<form data-form="task"><label>Что сделать*<input class="inp" name="title" required></label>
    <div class="form-grid"><label>Срок<input class="inp" type="date" name="due" value="${D.add(D.today(),1)}"></label>
    <label>Эксперт<select class="inp" name="expertId"><option value="">—</option>${S.experts.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label></div>
    <label>Заметка<input class="inp" name="note"></label>
    <div class="row end gap"><button type="button" class="btn" data-a="close">Отмена</button><button class="btn primary" type="submit">Добавить</button></div></form>`);
}
function moreSheet(){
  modal('Разделы',`<div class="more">${[['scripts','💬','Скрипты'],['call','📞','Созвон'],['stats','📊','Аналитика'],['path','🧭','Путь и условия'],['settings','⚙️','Настройки и данные']].map(x=>`<a href="#${x[0]}" data-a="close"><span>${x[1]}</span>${x[2]}</a>`).join('')}</div>`);
}
function finishCallForm(){
  const dr=S.callDraft, e=getExpert(dr.expertId);
  if(dr.running){ dr.elapsed=callElapsed(dr); dr.running=false; saveQuiet(); }
  const notes = CALL_STEPS.map(s=>dr.notes[s.id]?`${s.title}: ${dr.notes[s.id]}`:'').filter(Boolean).join('\n');
  modal('Итог созвона',`<form data-form="callfinish">
    <p class="sm">Эксперт: <b>${esc(e.name)}</b> · ${Math.round(dr.elapsed/60000)} мин. «Созвон без фиксации результата — это просто разговор».</p>
    <fieldset class="radios"><legend>Чем закончилось</legend>
      <label><input type="radio" name="outcome" value="agreed" checked> ✅ Согласился</label>
      <label><input type="radio" name="outcome" value="thinking"> 🤔 Думает</label>
      <label><input type="radio" name="outcome" value="second"> 🔁 Нужна 2-я встреча</label>
      <label><input type="radio" name="outcome" value="refused"> ❌ Отказ</label></fieldset>
    <div id="nextBlock"><label>Следующий шаг*<input class="inp" name="nextText" id="cfText" value="Старт: он присылает материалы, я готовлю план"></label>
    <label>Когда<input class="inp" type="date" name="nextDate" id="cfDate" value="${D.add(D.today(),3)}"></label>
    <label class="chk row-chk" id="condRow"><input type="checkbox" name="conditions"><span></span>Условия зафиксированы в переписке</label></div>
    <label>Итог / заметки<textarea class="inp" name="notes" rows="4">${esc(notes)}</textarea></label>
    <div class="row end gap"><button type="button" class="btn" data-a="close">Назад</button><button class="btn primary" type="submit">Записать в трекер</button></div></form>`);
}

/* ---------- формы ---------- */
const F = {
  expert(fd){
    const id=fd.get('id'), data={name:fd.get('name').trim(), link:fd.get('link').trim(), niche:fd.get('niche').trim(), channel:fd.get('channel'), why:fd.get('why').trim()};
    if(id){ Object.assign(getExpert(id),data); save(); toast('Сохранено'); }
    else { data.criteria={}; CRITERIA.forEach(c=>{ if(fd.get('crit_'+c.id)) data.criteria[c.id]=true; });
      const e=newExpert(data); toast('Эксперт добавлен'); if(parseRoute().name!=='experts') location.hash='#expert/'+e.id; }
    closeModal();
  },
  touch(fd){
    const e=getExpert(fd.get('expertId'));
    logTouch(e,{channel:fd.get('channel'), text:fd.get('text').trim(), date:fd.get('date')||D.today()});
    closeModal(); toast('Касание №'+e.touches.length+' записано. Дальше: '+(e.next?e.next.text:'—'));
  },
  sched(fd){ scheduleCall(getExpert(fd.get('id')), fd.get('date'), fd.get('time')); closeModal(); toast('Созвон назначен'); },
  next(fd){ const e=getExpert(fd.get('id')); setNext(e, fd.get('date'), fd.get('text').trim()); save(); closeModal(); },
  pause(fd){ pauseExpert(getExpert(fd.get('id')), +fd.get('days')); closeModal(); toast('В паузе. Вернёмся позже'); },
  task(fd){ S.tasks.push({id:uid(), title:fd.get('title').trim(), due:fd.get('due')||null, expertId:fd.get('expertId')||null, note:fd.get('note').trim(), done:false}); save(); closeModal(); },
  callfinish(fd){
    const dr=S.callDraft, e=getExpert(dr.expertId), outcome=fd.get('outcome');
    if(outcome!=='refused' && !fd.get('nextText').trim()){ toast('Укажи следующий шаг — без него созвон «просто разговор»'); return; }
    finishCall(e,{outcome, nextText:fd.get('nextText').trim(), nextDate:fd.get('nextDate'), conditions:!!fd.get('conditions'), notes:fd.get('notes').trim(), secs:Math.round(dr.elapsed/1000)});
    closeModal(); toast('Созвон записан в трекер'); location.hash='#expert/'+e.id;
  },
  profile(fd){
    Object.assign(S.profile,{name:fd.get('name').trim(), gender:fd.get('gender'), role:fd.get('role'), niche:fd.get('niche').trim(), startDate:fd.get('startDate')||D.today()});
    S.norms={day:+fd.get('nd')||4, week:+fd.get('nw')||20, month:+fd.get('nm')||120};
    save(); toast('Сохранено');
  }
};
document.addEventListener('submit',e=>{
  const f=e.target.closest('form[data-form]'); if(!f) return;
  e.preventDefault(); F[f.dataset.form](new FormData(f));
});

/* ---------- утилиты ---------- */
function download(name, text, type){
  const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); }
  catch(e){ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(_){} ta.remove(); }
  toast('Скопировано');
}
function lintNow(){
  const ta=$('#msgTa'), ul=$('#lint'); if(!ta||!ul) return;
  ul.innerHTML=lintMsg(ta.value).map(l=>`<li class="${l.ok?'ok':'no'}">${l.ok?'✓':'✕'} ${esc(l.t)}</li>`).join('');
}
function msgRebuild(){
  const ta=$('#msgTa'); if(!ta) return;
  ta.value=FIRST_MSG({name:$('#mName').value.trim(), topic:$('#mTopic').value.trim(), detail:$('#mDetail').value.trim(), f:S.profile.gender==='f'});
  lintNow();
}
function calcNow(){
  const o=$('#calcOut'); if(!o) return;
  o.innerHTML=calcHtml(+$('#cRev').value||0, +$('#cExp').value||0, $('#cFirst').checked);
}

/* ---------- действия ---------- */
const A = {
  close: ()=>closeModal(),
  touch: el=>touchForm(el.dataset.id),
  'add-expert': ()=>expertForm(),
  'edit-expert': el=>expertForm(getExpert(el.dataset.id)),
  replied: el=>{ markReplied(getExpert(el.dataset.id)); toast('Отлично! Цель — созвон, не продажа в переписке'); },
  sched: el=>schedForm(el.dataset.id),
  pause: el=>pauseForm(el.dataset.id),
  lost: el=>{ if(confirm('Отметить отказ? Отказ — это данные, а не приговор.')) setStage(getExpert(el.dataset.id),'lost'); },
  'edit-next': el=>nextForm(el.dataset.id),
  'next-clear': el=>{ const e=getExpert(el.dataset.id); e.next=null; save(); closeModal(); },
  'del-expert': el=>{ if(confirm('Удалить эксперта и всю историю?')){ deleteExpert(el.dataset.id); location.hash='#experts'; } },
  'start-call': el=>{ location.hash='#call/'+el.dataset.id; },
  expview: el=>{ UI.expView=el.dataset.v; try{localStorage.setItem('pp_expview',UI.expView);}catch(e){} render(); },
  'task-add': ()=>taskForm(),
  'task-del': el=>{ S.tasks=S.tasks.filter(t=>t.id!==el.dataset.id); save(); },
  'task-filter': el=>{ UI.taskFilter=el.dataset.v; render(); },
  'copy-el': el=>{ const t=$('#'+el.dataset.t); copyText(t.value!==undefined&&t.tagName==='TEXTAREA'?t.value:t.innerText); },
  'msg-reset': ()=>{ UI.msgDirty=false; msgRebuild(); },
  'msg-touch': ()=>{ const id=$('#mExp').value; touchForm(id||undefined); const ta=$('#msgTa'); },
  'call-toggle': ()=>{ const d=S.callDraft; if(d.running){ d.elapsed=callElapsed(d); d.running=false; } else { d.startedAt=Date.now(); d.running=true; } saveQuiet(); render(); },
  'call-reset': ()=>{ if(confirm('Сбросить таймер?')){ const d=S.callDraft; d.elapsed=0; d.running=false; saveQuiet(); render(); } },
  'call-finish': ()=>finishCallForm(),
  'call-leave': el=>{ /* черновик сохраняется */ },
  theme: el=>{ S.theme=el.dataset.v; applyTheme(); save(); },
  'export-json': ()=>{ download('producer-backup-'+D.today()+'.json', exportJSON(), 'application/json'); toast('Копия сохранена'); },
  'export-csv': ()=>download('experts-'+D.today()+'.csv', exportCSV(), 'text/csv;charset=utf-8'),
  demo: ()=>{ if(!S.experts.length || confirm('Добавить демо-данные к текущим?')){ loadDemo(); toast('Демо-данные загружены'); } },
  reset: ()=>{ if(confirm('Стереть ВСЕ данные? Это нельзя отменить. Сделай резервную копию!')){ resetAll(); toast('Данные стёрты'); } },
  more: ()=>moreSheet()
};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-a]'); if(!el) return;
  if(['INPUT','SELECT','TEXTAREA'].includes(el.tagName)) return;
  const f=A[el.dataset.a]; if(f) f(el,e);
});

/* change/input: чекбоксы, селекты, текстовые поля */
document.addEventListener('change',e=>{
  const el=e.target, a=el.dataset && el.dataset.a;
  if(a==='task-toggle'){ const t=S.tasks.find(x=>x.id===el.dataset.id); t.done=el.checked; save(); }
  else if(a==='crit'||a==='flag'){ const x=getExpert(el.dataset.id); x[a==='crit'?'criteria':'flags'][el.dataset.k]=el.checked; save(); }
  else if(a==='stage-sel'){ const x=getExpert(el.dataset.id);
    if(el.value==='paused') { el.value=x.stage; pauseForm(x.id); }
    else if(el.value==='call_set' && !x.callAt){ el.value=x.stage; schedForm(x.id); }
    else setStage(x, el.value); }
  else if(a==='call-step'){ S.callDraft.done[el.dataset.k]=el.checked; saveQuiet(); $$('.segs i').forEach((i,idx)=>i.classList.toggle('ok', !!S.callDraft.done[CALL_STEPS[idx].id])); }
  else if(el.id==='tExp'){ const x=getExpert(el.value); if(x) $('#tCh').value=x.channel; }
  else if(el.id==='nicheF'){ UI.niche=el.value; render(); }
  else if(el.id==='mExp'){ const x=getExpert(el.value); if(x){ $('#mName').value=x.name.split(' ')[0]; $('#mTopic').value=x.niche; UI.msgDirty=false; msgRebuild(); } }
  else if(el.id==='cFirst') calcNow();
  else if(el.id==='importFile'){
    const file=el.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=()=>{ try{ if(confirm('Заменить текущие данные загруженной копией?')){ importJSON(r.result); applyTheme(); toast('Данные загружены'); } }catch(err){ toast('Ошибка: '+err.message); } };
    r.readAsText(file);
  }
  else if(el.name==='outcome'){
    const preset={agreed:['Старт: он присылает материалы, я готовлю план',3],thinking:['Напомнить + скинуть 2–3 идеи под его нишу',NORMS.thinkDays],second:['Вторая встреча',3],refused:['',0]}[el.value];
    $('#cfText').value=preset[0]; $('#cfDate').value=D.add(D.today(),preset[1]);
    $('#nextBlock').style.display = el.value==='refused'?'none':''; $('#condRow').style.display = el.value==='agreed'?'':'none';
  }
});
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.dataset.a==='notes'){ getExpert(el.dataset.id).notes=el.value; saveQuiet(); }
  else if(el.dataset.a==='call-note'){ S.callDraft.notes[el.dataset.k]=el.value; saveQuiet(); }
  else if(el.id==='q'){ UI.q=el.value; render(); const q=$('#q'); q.focus(); q.setSelectionRange(q.value.length,q.value.length); }
  else if(['mName','mTopic','mDetail'].includes(el.id)){ if(!UI.msgDirty) msgRebuild(); }
  else if(el.id==='msgTa'){ UI.msgDirty=true; lintNow(); }
  else if(el.id==='objQ'){ const q=el.value.toLowerCase(); $$('.obj').forEach(c=>c.hidden = !c.innerText.toLowerCase().includes(q)); }
  else if(el.id==='cRev'||el.id==='cExp') calcNow();
});

/* drag & drop на доске (десктоп) */
document.addEventListener('dragstart',e=>{ const c=e.target.closest('[data-drag]'); if(c){ e.dataTransfer.setData('text/plain',c.dataset.drag); e.dataTransfer.effectAllowed='move'; } });
document.addEventListener('dragover',e=>{ const c=e.target.closest('[data-drop]'); if(c){ e.preventDefault(); $$('.col.over').forEach(x=>x.classList.remove('over')); c.classList.add('over'); } });
document.addEventListener('dragend',()=>$$('.col.over').forEach(x=>x.classList.remove('over')));
document.addEventListener('drop',e=>{
  const c=e.target.closest('[data-drop]'); if(!c) return; e.preventDefault();
  const ex=getExpert(e.dataTransfer.getData('text/plain')); if(!ex) return;
  const to=c.dataset.drop;
  if(to==='paused') pauseForm(ex.id); else if(to==='call_set' && !ex.callAt) schedForm(ex.id); else setStage(ex,to);
});

/* ---------- старт ---------- */
applyTheme();
render();
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
