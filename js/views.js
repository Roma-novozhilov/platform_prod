/* Экраны: функции возвращают HTML-строки */
const UI = {
  expView: (()=>{ try{return localStorage.getItem('pp_expview')||'board';}catch(e){return 'board';} })(),
  q:'', niche:'', taskFilter:'open', msgDirty:false
};

const fill = (txt, v={}) => {
  const a = S.profile.gender==='f' ? 'а' : '';
  return String(txt).replace(/\{f\}|\{fa\}/g, a).replace(/\{(\w+)\}/g,(m,k)=> v[k]!=null && v[k]!=='' ? v[k] : '['+k+']');
};
const chip = (txt,cls='') => `<span class="chip ${cls}">${esc(txt)}</span>`;
const stageChip = id => { const s=stageOf(id); return `<span class="chip ph-${s.phase}">${esc(s.label)}</span>`; };
const empty = (icon,title,text,btn='') => `<div class="empty"><div class="empty-i">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${btn}</div>`;
const ring = (val,norm,label) => {
  const p = Math.min(100, Math.round(val/Math.max(norm,1)*100));
  return `<div class="ring-card"><div class="ring ${val>=norm?'done':''}" style="--p:${p}"><b>${val}</b><small>из ${norm}</small></div><div class="ring-l">${label}</div></div>`;
};
const bar = (val,max,cls='') => `<div class="bar"><i class="${cls}" style="width:${Math.min(100,Math.round(val/Math.max(max,1)*100))}%"></i></div>`;

/* ---------- Сеть экспертов (фирменная визуализация) ---------- */
const PHASE_COLOR = {search:'var(--accent)', call:'var(--warn)', work:'var(--accent2)', arch:'var(--muted)'};
function netViz(){
  const list = S.experts.filter(e=>e.stage!=='lost').sort((a,b)=>STAGE_ORDER.indexOf(b.stage)-STAGE_ORDER.indexOf(a.stage)).slice(0,16);
  const W=560,H=300,cx=W/2,cy=H/2, rx=215, ry=105;
  const nodes = list.map((e,i)=>{
    const a = -Math.PI/2 + i/list.length*2*Math.PI, ph=stageOf(e.stage).phase;
    return {e, x:cx+rx*Math.cos(a), y:cy+ry*Math.sin(a), ph, r:8+Math.min(e.touches.length,6)*1.6};
  });
  const lines = nodes.map(n=>`<line class="ln ${n.ph==='work'?'w':''}" x1="${cx}" y1="${cy}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" stroke="${PHASE_COLOR[n.ph]}"/>`).join('');
  const dots = nodes.map(n=>`<a href="#expert/${n.e.id}"><title>${esc(n.e.name)} — ${esc(stageOf(n.e.stage).label)}</title>
    <circle class="nd" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}" fill="${PHASE_COLOR[n.ph]}" ${n.ph==='work'?'style="filter:drop-shadow(0 0 6px var(--accent2))"':''}/>
    <text class="nlbl" x="${n.x.toFixed(1)}" y="${(n.y+n.r+14).toFixed(1)}" text-anchor="middle">${esc((n.e.name||'').split(' ')[0].slice(0,12))}</text></a>`).join('');
  return `<section class="card net-card"><div class="card-h"><h3>Твоя сеть</h3><a href="#experts" class="link">Все эксперты →</a></div>
  ${nodes.length?`<svg class="net" viewBox="0 0 ${W} ${H}" role="img" aria-label="Сеть экспертов">${lines}${dots}
    <circle cx="${cx}" cy="${cy}" r="30" fill="url(#ng)"/><circle cx="${cx}" cy="${cy}" r="11" fill="var(--bg)"/>
    <defs><linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs></svg>
    <div class="legend">${[['search','Поиск'],['call','Созвон'],['work','В работе'],['arch','Пауза']].map(x=>`<span><i style="background:${PHASE_COLOR[x[0]]}"></i>${x[1]}</span>`).join('')}<span>размер узла = касания</span></div>`
   : `<p class="muted">Добавь первого эксперта — он появится узлом в твоей сети.</p>`}</section>`;
}

/* ---------- Сегодня ---------- */
function vToday(){
  const t=D.today(), [wf,wt]=periodRange('week'), [mf,mt]=periodRange('month');
  const d=countTouches(t,t), w=countTouches(wf,wt), m=countTouches(mf,mt);
  const daysLeft=D.diff(wt,t)+1, need=Math.max(0,S.norms.week-w);
  const perDay = need? Math.ceil(need/daysLeft) : 0;
  const pace = d>=S.norms.day ? '🎉 Норма дня выполнена!' :
    need===0 ? '✅ Недельная норма уже закрыта' :
    `Осталось на сегодня: <b>${S.norms.day-d}</b>. До конца недели нужно ещё <b>${need}</b> (≈${perDay} в день)`;
  const acts = todayActions();
  const tasks = S.tasks.filter(x=>!x.done && x.due && x.due<=t).sort((a,b)=>a.due.localeCompare(b.due));
  const stuck = stuckExperts();
  const f = funnel(wf,wt);
  const hello = S.profile.name ? `Привет, ${esc(S.profile.name)}!` : 'Привет!';
  const role = ROLES.find(r=>r.id===S.profile.role);
  const pm = programMonth();

  const st=streak();
  return `
  <div class="brand-m"><img class="logo" src="icons/icon.svg" alt="">NEXUS</div>
  <header class="page-h"><div><h1>${hello}</h1><p class="muted"><span class="streak ${st>=3?'hot':''}" title="Дней подряд с выполненной нормой">🔥 ${st}</span> ${D.fmtDow(t)} · ${role.icon} ${role.name} · месяц ${pm}${pm===1?' (0% наставнику)':' (40% с прибыли)'}</p></div>
    <div class="row"><button class="btn primary" data-a="touch">＋ Касание</button><button class="btn" data-a="add-expert">＋ Эксперт</button></div></header>

  <section class="card">
    <div class="rings">${ring(d,S.norms.day,'Сегодня')}${ring(w,S.norms.week,'Неделя')}${ring(m,S.norms.month,'Месяц')}</div>
    <p class="pace">${pace}</p>
  </section>

  ${stuck.length?`<section class="card warn"><h3>⚠️ Пора отпускать</h3>
    <p class="muted">После 3 касаний тишина. Не спамим — в паузу на 2–3 месяца.</p>
    ${stuck.map(e=>`<div class="line"><a href="#expert/${e.id}">${esc(e.name)}</a><button class="btn sm" data-a="pause" data-id="${e.id}">В паузу</button></div>`).join('')}</section>`:''}

  ${netViz()}

  <section class="card">
    <div class="card-h"><h3>Что сделать сегодня</h3>${chip(String(acts.length+tasks.length))}</div>
    ${(acts.length+tasks.length)===0 ? empty('☀️','На сегодня всё чисто','Сделай касания по норме или добавь нового эксперта.',`<button class="btn primary" data-a="touch">＋ Касание</button>`) : ''}
    ${acts.map(a=>actionRow(a)).join('')}
    ${tasks.map(x=>taskRow(x)).join('')}
  </section>

  <section class="card">
    <div class="card-h"><h3>Воронка недели</h3><a href="#stats" class="link">Аналитика →</a></div>
    ${funnelHtml(f)}
  </section>`;
}
function actionRow(a){
  const e=a.expert, st=e.stage;
  const btns=[];
  if(['found','touched','thinking','paused','repeat'].includes(st)) btns.push(`<button class="btn sm primary" data-a="touch" data-id="${e.id}">Касание</button>`);
  if(st==='touched') btns.push(`<button class="btn sm" data-a="replied" data-id="${e.id}">Ответил</button>`);
  if(st==='replied') btns.push(`<button class="btn sm primary" data-a="sched" data-id="${e.id}">Назначить созвон</button>`);
  if(st==='call_set') btns.push(`<button class="btn sm primary" data-a="start-call" data-id="${e.id}">📞 Провести</button>`);
  if(['thinking','warmup','webinar','sale'].includes(st)) btns.push(`<button class="btn sm" data-a="edit-next" data-id="${e.id}">Перенести</button>`);
  return `<div class="act ${a.overdue?'over':''}">
    <div class="act-main"><a class="act-n" href="#expert/${e.id}">${esc(e.name)}</a> ${stageChip(st)}
      <div class="act-t">${esc(a.text)}</div><div class="muted sm">${a.overdue?'⏰ '+D.rel(a.date):'Сегодня'}</div></div>
    <div class="act-b">${btns.join('')}</div></div>`;
}
function taskRow(x){
  const e = x.expertId && getExpert(x.expertId);
  const over = x.due && x.due<D.today();
  return `<div class="act task ${over?'over':''}"><label class="chk"><input type="checkbox" data-a="task-toggle" data-id="${x.id}" ${x.done?'checked':''}><span></span></label>
    <div class="act-main"><div class="act-t ${x.done?'done':''}">${esc(x.title)}</div>
    <div class="muted sm">${x.due?(over?'⏰ ':'')+D.fmt(x.due)+' · '+D.rel(x.due):'Без срока'}${e?' · <a href="#expert/'+e.id+'">'+esc(e.name)+'</a>':''}${x.note?' · '+esc(x.note):''}</div></div>
    <button class="icon-btn" data-a="task-del" data-id="${x.id}" title="Удалить">✕</button></div>`;
}
function funnelHtml(f){
  const steps=[['Касания',f.touches,'t'],['Ответы',f.replies,'r'],['Согласия на созвон',f.agreed,'a'],['Созвоны',f.calls,'c'],['В работу',f.active,'w']];
  const max=Math.max(1,...steps.map(s=>s[1]));
  return `<div class="funnel">${steps.map((s,i)=>`<div class="fr"><span class="fl">${s[0]}</span>${bar(s[1],max,'b'+s[2])}<b>${s[1]}</b>${i>0&&steps[i-1][1]?`<small class="muted">${pct(s[1],steps[i-1][1])}%</small>`:'<small></small>'}</div>`).join('')}</div>`;
}

/* ---------- Эксперты ---------- */
function filteredExperts(){
  const q=UI.q.trim().toLowerCase();
  return S.experts.filter(e=>(!q || (e.name+' '+e.niche+' '+e.link).toLowerCase().includes(q)) && (!UI.niche || e.niche===UI.niche));
}
function expCard(e){
  const last = e.touches.length ? e.touches[e.touches.length-1].date : null;
  const over = e.next && e.next.date<=D.today() && e.stage!=='lost';
  const fl = flagCount(e);
  return `<article class="xcard ${over?'due':''}" draggable="true" data-drag="${e.id}">
    <a class="xn" href="#expert/${e.id}">${esc(e.name||'Без имени')}</a>
    <div class="muted sm">${esc(e.niche||'ниша не указана')} · ${esc(e.channel)}</div>
    <div class="xmeta">${chip('✉ '+e.touches.length)}${chip('★ '+criteriaScore(e)+'/'+CRITERIA.length)}${fl>=2?chip('🚩 '+fl,'bad'):''}${last?chip('посл. '+D.fmt(last)):''}</div>
    ${e.next?`<div class="xnext ${over?'over':''}">${over?'⏰':'→'} ${esc(e.next.text)} <small>(${D.fmt(e.next.date)})</small></div>`:''}
  </article>`;
}
function vExperts(){
  const list=filteredExperts();
  const niches=[...new Set(S.experts.map(e=>e.niche).filter(Boolean))];
  const toolbar=`<div class="toolbar">
    <input class="inp" type="search" id="q" placeholder="Поиск по имени, нише, ссылке" value="${esc(UI.q)}">
    <select class="inp" id="nicheF"><option value="">Все ниши</option>${niches.map(n=>`<option ${UI.niche===n?'selected':''}>${esc(n)}</option>`).join('')}</select>
    <div class="seg"><button class="${UI.expView==='board'?'on':''}" data-a="expview" data-v="board">Доска</button><button class="${UI.expView==='list'?'on':''}" data-a="expview" data-v="list">Список</button></div>
  </div>`;
  let body='';
  if(!S.experts.length) body=empty('👥','Пока нет экспертов','Добавь 2–3 экспертов из своей ниши — пока без касаний. Сначала учимся видеть, кто подходит.',`<button class="btn primary" data-a="add-expert">＋ Добавить эксперта</button> <button class="btn" data-a="demo">Загрузить демо</button>`);
  else if(UI.expView==='board'){
    body=`<div class="board">${STAGES.map(s=>{
      const col=list.filter(e=>e.stage===s.id);
      return `<section class="col ph-${s.phase}" data-drop="${s.id}"><h4><span>${esc(s.label)}</span>${chip(String(col.length))}</h4><p class="muted xs">${esc(s.hint)}</p>${col.map(expCard).join('')||'<div class="ph">пусто</div>'}</section>`;}).join('')}</div>`;
  } else {
    body = list.length ? `<div class="grid">${list.sort((a,b)=>STAGE_ORDER.indexOf(a.stage)-STAGE_ORDER.indexOf(b.stage)).map(e=>`<div class="lcard">${stageChip(e.stage)}${expCard(e)}</div>`).join('')}</div>` : empty('🔍','Ничего не найдено','Измени поиск или фильтр.');
  }
  return `<header class="page-h"><div><h1>Эксперты</h1><p class="muted">Трекер: кого написали, кто ответил, кто согласился</p></div>
    <div class="row"><button class="btn primary" data-a="add-expert">＋ Эксперт</button></div></header>${toolbar}${body}`;
}

function vExpert(id){
  const e=getExpert(id);
  if(!e) return empty('🤷','Эксперт не найден','Возможно, он был удалён.',`<a class="btn primary" href="#experts">К списку</a>`);
  const st=stageOf(e.stage);
  const fl=flagCount(e);
  const acts=[];
  if(!['lost','paused'].includes(e.stage)) acts.push(`<button class="btn primary" data-a="touch" data-id="${e.id}">✉ Касание</button>`);
  if(e.stage==='paused') acts.push(`<button class="btn primary" data-a="touch" data-id="${e.id}">↩ Вернуться касанием</button>`);
  if(['found','touched'].includes(e.stage)) acts.push(`<button class="btn" data-a="replied" data-id="${e.id}">💬 Ответил</button>`);
  if(['found','touched','replied','thinking'].includes(e.stage)) acts.push(`<button class="btn" data-a="sched" data-id="${e.id}">📅 Назначить созвон</button>`);
  if(['call_set','replied','thinking'].includes(e.stage)) acts.push(`<button class="btn" data-a="start-call" data-id="${e.id}">📞 Провести созвон</button>`);
  if(!['paused','lost'].includes(e.stage)) acts.push(`<button class="btn" data-a="pause" data-id="${e.id}">⏸ Пауза</button><button class="btn danger-o" data-a="lost" data-id="${e.id}">Отказ</button>`);
  return `
  <a href="#experts" class="back">← Эксперты</a>
  <header class="page-h"><div><h1>${esc(e.name||'Без имени')}</h1>
    <p class="muted">${esc(e.niche||'ниша не указана')} · ${esc(e.channel)} ${e.link?`· <a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">профиль ↗</a>`:''}</p></div>
    <div class="row"><button class="btn" data-a="edit-expert" data-id="${e.id}">✎ Изменить</button></div></header>

  <section class="card">
    <div class="card-h"><h3>Статус</h3>${stageChip(e.stage)}</div>
    <select class="inp" data-a="stage-sel" data-id="${e.id}">${STAGES.map(s=>`<option value="${s.id}" ${s.id===e.stage?'selected':''}>${esc(s.label)}</option>`).join('')}</select>
    <p class="muted sm">${esc(st.hint)}</p>
    ${e.next?`<div class="nextbox ${e.next.date<D.today()?'over':''}"><div><b>Следующее действие</b><br>${esc(e.next.text)}</div><div class="nd">${D.fmt(e.next.date)}<br><small>${D.rel(e.next.date)}</small></div><button class="icon-btn" data-a="edit-next" data-id="${e.id}" title="Изменить">✎</button></div>`:`<button class="btn sm" data-a="edit-next" data-id="${e.id}">＋ Назначить следующее действие</button>`}
    ${e.returnDate&&e.stage==='paused'?`<p class="muted sm">Вернуться: ${D.fmt(e.returnDate)} (${D.rel(e.returnDate)})</p>`:''}
    <div class="row wrap gap">${acts.join('')}</div>
  </section>

  <div class="two">
  <section class="card"><div class="card-h"><h3>Подходит ли эксперт</h3>${chip(criteriaScore(e)+'/'+CRITERIA.length, criteriaScore(e)>=5?'good':'')}</div>
    ${CRITERIA.map(c=>`<label class="chk row-chk"><input type="checkbox" data-a="crit" data-id="${e.id}" data-k="${c.id}" ${e.criteria[c.id]?'checked':''}><span></span>${esc(c.label)}</label>`).join('')}
    <p class="muted sm">Пишем только когда выполнены условия: стабильность есть, но потолок заработка.</p>
    ${e.why?`<p class="sm"><b>Почему выбрал:</b> ${esc(e.why)}</p>`:''}
  </section>
  <section class="card ${fl>=2?'warn':''}"><div class="card-h"><h3>Риск «сольётся»</h3>${chip(fl+'/'+RED_FLAGS.length, fl>=2?'bad':'')}</div>
    ${RED_FLAGS.map(c=>`<label class="chk row-chk"><input type="checkbox" data-a="flag" data-id="${e.id}" data-k="${c.id}" ${e.flags[c.id]?'checked':''}><span></span>${esc(c.label)}</label>`).join('')}
    ${fl>=2?`<p class="sm"><b>Не уговаривай.</b> Задай прямой вопрос: «Ты готов попробовать или тебе нужно время?» Если молчит — в паузу на 1–3 месяца. Лучше 2 сильных, чем 10 сомневающихся.</p>`:''}
  </section></div>

  <section class="card"><div class="card-h"><h3>Касания (${e.touches.length})</h3></div>
    ${e.touches.length? e.touches.slice().reverse().map((t,i)=>`<div class="line"><span>№${e.touches.length-i} · ${D.fmt(t.date)} · ${esc(t.channel)}${t.text?` — <span class="muted">${esc(t.text)}</span>`:''}</span></div>`).join('') : '<p class="muted">Касаний ещё не было.</p>'}
  </section>

  ${e.calls.length?`<section class="card"><div class="card-h"><h3>Созвоны</h3></div>${e.calls.slice().reverse().map(c=>`<div class="callrec"><b>${D.fmt(c.date)}</b> — ${({agreed:'✅ согласился',thinking:'🤔 думает',second:'🔁 нужна 2-я встреча',refused:'❌ отказ'})[c.outcome]}${c.secs?` · ${Math.round(c.secs/60)} мин`:''}<br><span class="muted">Дальше: ${esc(c.nextText||'—')}${c.nextDate?' ('+D.fmt(c.nextDate)+')':''}</span>${c.notes?`<br><span class="sm">${esc(c.notes)}</span>`:''}</div>`).join('')}</section>`:''}

  <section class="card"><div class="card-h"><h3>Заметки</h3></div>
    <textarea class="inp" rows="4" data-a="notes" data-id="${e.id}" placeholder="Что болит у эксперта, детали, договорённости…">${esc(e.notes)}</textarea></section>

  <section class="card"><div class="card-h"><h3>История</h3></div>
    ${e.log.slice(0,30).map(l=>`<div class="line sm"><span class="muted">${D.fmt(l.t.slice(0,10))}</span><span>${esc(l.text)}</span></div>`).join('')}
    <div class="row end"><button class="btn danger-o sm" data-a="del-expert" data-id="${e.id}">Удалить эксперта</button></div>
  </section>`;
}

/* ---------- Созвон ---------- */
function callElapsed(dr){ return (dr.elapsed||0) + (dr.running ? Date.now()-dr.startedAt : 0); }
function fmtTime(ms){ const s=Math.floor(ms/1000); return pad(Math.floor(s/60))+':'+pad(s%60); }
function vCall(id){
  let dr=S.callDraft;
  if(id && (!dr || dr.expertId!==id)){
    const e=getExpert(id); if(!e) return empty('🤷','Эксперт не найден','');
    S.callDraft = dr = {expertId:id, notes:{}, done:{}, elapsed:0, running:false, startedAt:0};
    try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(_){}
  }
  if(!dr){
    const cands=S.experts.filter(e=>!['lost'].includes(e.stage));
    return `<header class="page-h"><div><h1>Созвон с экспертом</h1><p class="muted">15 минут. Знакомство → Проблема → Что даёшь → Как работает → Вопросы → Следующий шаг</p></div></header>
    <section class="card"><h3>С кем созвон?</h3>
      ${cands.length? cands.map(e=>`<div class="line"><span>${esc(e.name)} ${stageChip(e.stage)}</span><a class="btn sm primary" href="#call/${e.id}">Начать</a></div>`).join('') : empty('📞','Нет экспертов','Сначала добавь эксперта.',`<button class="btn primary" data-a="add-expert">＋ Эксперт</button>`)}
    </section>${callPrimer()}`;
  }
  const e=getExpert(dr.expertId);
  if(!e){ S.callDraft=null; return vCall(); }
  const total=CALL_STEPS.reduce((a,s)=>a+s.min,0);
  const el=callElapsed(dr);
  let acc=0; const bounds=CALL_STEPS.map(s=>{acc+=s.min*60000; return acc;});
  const cur = Math.max(0, bounds.findIndex(b=>el<b)); const curIdx = el>=acc ? CALL_STEPS.length-1 : cur;
  return `
  <a href="#call" class="back" data-a="call-leave">← Все созвоны</a>
  <header class="page-h"><div><h1>Созвон: ${esc(e.name)}</h1><p class="muted">${esc(e.niche||'')} · ${esc(e.channel)} · слушай 70%, говори 30%</p></div></header>
  <section class="card sticky timer-card">
    <div class="timer ${el>total*60000?'over':''}" id="timer">${fmtTime(el)}</div>
    <div class="tmeta"><span id="tstep">Шаг ${curIdx+1}: ${esc(CALL_STEPS[curIdx].title)}</span><span class="muted">из ${total} мин</span></div>
    <div class="segs">${CALL_STEPS.map((s,i)=>`<i class="${dr.done[s.id]?'ok':i===curIdx&&dr.running?'cur':''}" style="flex:${s.min}"></i>`).join('')}</div>
    <div class="row gap"><button class="btn primary" data-a="call-toggle">${dr.running?'⏸ Пауза':(el?'▶ Продолжить':'▶ Старт')}</button><button class="btn" data-a="call-reset">⟲ Сброс</button><button class="btn good" data-a="call-finish">Завершить и записать</button></div>
  </section>
  ${CALL_STEPS.map((s,i)=>`<details class="card step" ${i===curIdx?'open':''}><summary><span class="sn">${i+1}</span><b>${s.title}</b><span class="chip">${s.min} мин</span>
      <label class="chk right" onclick="event.stopPropagation()"><input type="checkbox" data-a="call-step" data-k="${s.id}" ${dr.done[s.id]?'checked':''}><span></span></label></summary>
    <div class="say">${esc(s.say)}</div>
    <div class="two"><div><h5>Делай</h5><ul class="ok">${s.do.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>Не делай</h5><ul class="no">${s.dont.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <p class="goal">🎯 ${esc(s.goal)}</p>
    <textarea class="inp" rows="2" data-a="call-note" data-k="${s.id}" placeholder="Заметки по шагу…">${esc(dr.notes[s.id]||'')}</textarea></details>`).join('')}
  ${callPrimer()}`;
}
function callPrimer(){
  return `<section class="card"><h3>Что убивает созвон</h3><ul class="no">${CALL_KILLERS.map(x=>`<li>${x}</li>`).join('')}</ul>
  <h3>После созвона</h3><ul class="ok">${CALL_AFTER.map(x=>`<li>${x}</li>`).join('')}</ul>
  <p class="goal">Созвон — это не продажа. Это знакомство и понимание, подходите ли вы друг другу. Без следующего шага — это просто разговор.</p></section>`;
}

/* ---------- Скрипты ---------- */
const SCRIPT_TABS=[['first','Первое сообщение'],['replies','Если ответил'],['followups','Если молчит'],['objections','Возражения'],['flags','Сольётся?']];
function lintMsg(text){
  const lines=text.split('\n').filter(l=>l.trim()).length, out=[];
  out.push({ok:lines>=5&&lines<=7, t:`Строк: ${lines} (нужно 5–7)`});
  const bad=(re,t)=>{ out.push({ok:!re.test(text), t}); };
  bad(/%|процент|деньг|₽|руб|оплат|стоимост|заработ/i,'Без процентов и денег — это отпугивает');
  bad(/классн\S* контент|крут\S* контент|круто делаете|огонь контент/i,'Без «у вас классный контент» — это спам');
  bad(/начинающ|новичок|только учусь/i,'Не пиши «я начинающий» — убивает доверие');
  out.push({ok:!/я\s+продюсер/i.test(text), t:'Не «я продюсер», а «я помогаю экспертам запускать курсы»'});
  out.push({ok:/15\s*минут/i.test(text), t:'Есть предложение «давай 15 минут поговорим»'});
  out.push({ok:!/\[[^\]]+\]/.test(text), t:'Нет незаполненных [полей]'});
  return out;
}
function vScripts(tab){
  tab = SCRIPT_TABS.some(t=>t[0]===tab) ? tab : 'first';
  const tabs=`<nav class="tabs">${SCRIPT_TABS.map(t=>`<a href="#scripts/${t[0]}" class="${t[0]===tab?'on':''}">${t[1]}</a>`).join('')}</nav>`;
  let body='';
  const fem=S.profile.gender==='f';
  if(tab==='first'){
    const p={name:'',topic:'',detail:'',give:'',f:fem};
    const txt=FIRST_MSG(p);
    body=`<section class="card"><h3>Конструктор первого сообщения</h3>
      <p class="muted sm">Структура: кто ты (без пафоса) → что именно смотрел → что можешь дать одной фразой → «давай 15 минут». Без процентов и денег.</p>
      <div class="form-grid">
        <label>Эксперт<select class="inp" id="mExp"><option value="">— не выбран —</option>${S.experts.filter(e=>e.stage!=='lost').map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label>
        <label>Имя в обращении<input class="inp" id="mName" placeholder="Анна"></label>
        <label>Тема / ниша<input class="inp" id="mTopic" placeholder="тренировки для мам"></label>
        <label>Что конкретно зацепило<input class="inp" id="mDetail" placeholder="ролик про восстановление после родов"></label>
      </div>
      <label>Текст сообщения<textarea class="inp" id="msgTa" rows="9">${esc(txt)}</textarea></label>
      <div class="row gap wrap"><button class="btn primary" data-a="copy-el" data-t="msgTa">Скопировать</button><button class="btn" data-a="msg-reset">Собрать заново</button><button class="btn" data-a="msg-touch">✉ Записать как касание</button></div>
      <ul class="lint" id="lint"></ul></section>`;
  }
  if(tab==='replies') body=REPLIES.map(r=>`<section class="card"><h3>${esc(r.q)}</h3><p class="rule">${esc(r.rule)}</p>
      <blockquote id="r-${r.id}">${esc(fill(r.text))}</blockquote><button class="btn sm" data-a="copy-el" data-t="r-${r.id}">Скопировать</button></section>`).join('');
  if(tab==='followups') body=`<section class="card info"><b>Ритм:</b> первое касание → через 2–3 дня второе (с новой ценностью) → максимум 3 попытки → «не ответил после 3 касаний» → возвращаемся через 2–3 месяца.</section>`+
    FOLLOWUPS.map(r=>`<section class="card"><div class="card-h"><h3>Касание ${r.n===4?'через 2–3 месяца':'№'+r.n}</h3>${chip(r.when)}</div><p class="rule">${esc(r.rule)}</p>
      <blockquote id="f-${r.n}">${esc(fill(r.text,{name:'Имя',idea:'[идея под нишу]'}))}</blockquote><button class="btn sm" data-a="copy-el" data-t="f-${r.n}">Скопировать</button></section>`).join('');
  if(tab==='objections') body=`<input class="inp" type="search" id="objQ" placeholder="Найти возражение…">`+OBJECTIONS.map(o=>`<section class="card obj"><h3>${esc(o.title)}</h3>
      <h5>Что он имеет в виду</h5><ul>${o.means.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>
      <h5>Что отвечать</h5><blockquote id="o-${o.id}">${esc(o.answer)}</blockquote>
      <p class="goal">💡 ${esc(o.tip)}</p><button class="btn sm" data-a="copy-el" data-t="o-${o.id}">Скопировать</button></section>`).join('');
  if(tab==='flags') body=`<section class="card"><h3>Признаки, что эксперт «сольётся»</h3><ul class="no">${RED_FLAGS.map(f=>`<li>${esc(f.label)}</li>`).join('')}</ul>
      <h5>Что делать</h5><ul class="ok"><li>Не уговаривать</li><li>Задать прямой вопрос: «Ты готов попробовать или тебе нужно время?»</li><li>Если «время» — назначить конкретный день</li><li>Если молчит — в таблицу и попробовать через 1–3 месяца</li></ul>
      <p class="goal">Не трать время на тех, кто не готов. Лучше 2 сильных, чем 10 сомневающихся.</p></section>`;
  return `<header class="page-h"><div><h1>Скрипты</h1><p class="muted">Готовые формулировки из обучения — копируй и адаптируй</p></div></header>${tabs}${body}`;
}

/* ---------- Задачи ---------- */
function vTasks(){
  const t=D.today(), f=UI.taskFilter;
  let list=S.tasks.slice();
  if(f==='open') list=list.filter(x=>!x.done);
  if(f==='today') list=list.filter(x=>!x.done&&x.due&&x.due<=t);
  if(f==='week') list=list.filter(x=>!x.done&&x.due&&x.due<=D.add(t,7));
  if(f==='done') list=list.filter(x=>x.done);
  list.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
  const open=S.tasks.filter(x=>!x.done).length, done=S.tasks.length-open;
  return `<header class="page-h"><div><h1>Задачи</h1><p class="muted">Домашние задания, дела по экспертам, личные напоминания</p></div><div class="row"><button class="btn primary" data-a="task-add">＋ Задача</button></div></header>
  <section class="card"><div class="card-h"><b>Выполнено ${done} из ${S.tasks.length}</b></div>${bar(done,Math.max(S.tasks.length,1),'bw')}</section>
  <div class="seg wide">${[['open','Все открытые'],['today','Сегодня'],['week','7 дней'],['done','Готово']].map(x=>`<button class="${f===x[0]?'on':''}" data-a="task-filter" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
  <section class="card">${list.length? list.map(taskRow).join('') : empty('🎯','Здесь пусто','Добавь задачу или смени фильтр.')}</section>
  <p class="muted sm">Действия по экспертам (напоминания, возвраты, созвоны) подтягиваются автоматически на экране «Сегодня».</p>`;
}

/* ---------- Аналитика ---------- */
function vStats(period){
  period = ['week','month','all'].includes(period)?period:'week';
  const [from,to]=periodRange(period), f=funnel(from,to), dx=diagnose(f);
  const lbl={week:'Неделя',month:'Месяц',all:'Всё время'};
  const days=[]; for(let i=13;i>=0;i--) days.push(D.add(D.today(),-i));
  const cnt=days.map(d=>countTouches(d,d)), mx=Math.max(S.norms.day,...cnt);
  const chans={};
  allTouches().filter(x=>inRange(x.date,from,to)).forEach(x=>{ (chans[x.channel]=chans[x.channel]||{t:0,r:0,a:0}).t++; });
  S.experts.forEach(e=>{ const c=chans[e.channel]; if(!c) return; if(inRange(e.repliedAt,from,to)) c.r++; if(inRange(e.callAgreedAt,from,to)) c.a++; });
  const bench = period==='all' ? '' : `<p class="muted sm">Ориентир на 20 касаний: 4–6 ответов → 1–2 согласия на созвон → 1 эксперт в работе. Это не гарантия — главное считать и понимать, где теряешь.</p>`;
  return `<header class="page-h"><div><h1>Аналитика</h1><p class="muted">Где теряются эксперты</p></div></header>
  <div class="seg wide">${['week','month','all'].map(p=>`<a class="${p===period?'on':''}" href="#stats/${p}">${lbl[p]}</a>`).join('')}</div>
  <section class="card"><div class="card-h"><h3>Воронка</h3></div>${funnelHtml(f)}${bench}
    <div class="convs">${[['Отклик',f.replies,f.touches],['На созвон',f.agreed,f.replies],['В работу',f.active,f.calls]].map(c=>`<div><b>${pct(c[1],c[2])}%</b><small>${c[0]}</small></div>`).join('')}</div></section>
  <section class="card"><h3>Диагностика</h3>${dx.map(d=>`<div class="dx ${d.lvl}"><span>${d.t}</span>${d.go?`<a class="btn sm" href="${d.go}">Скрипты</a>`:''}</div>`).join('')}</section>
  <section class="card"><h3>Касания за 14 дней</h3><div class="chart">${days.map((d,i)=>`<div class="cb" title="${D.fmt(d)}: ${cnt[i]}"><i class="${cnt[i]>=S.norms.day?'ok':''}" style="height:${Math.round(cnt[i]/mx*100)}%"></i><small>${D.parse(d).getDate()}</small></div>`).join('')}<div class="norm" style="bottom:${Math.round(S.norms.day/mx*100)}%"><span>норма ${S.norms.day}</span></div></div></section>
  ${Object.keys(chans).length?`<section class="card"><h3>По каналам</h3><div class="tbl-w"><table class="tbl"><tr><th>Канал</th><th>Касаний</th><th>Ответов</th><th>Созвонов</th><th>Отклик</th></tr>${Object.entries(chans).map(([k,c])=>`<tr><td>${esc(k)}</td><td>${c.t}</td><td>${c.r}</td><td>${c.a}</td><td>${pct(c.r,c.t)}%</td></tr>`).join('')}</table></div></section>`:''}
  <section class="card"><div class="card-h"><h3>Отчёт наставнику</h3></div><p class="muted sm">Готовый текст за неделю — скопируй и отправь в чат.</p>
    <pre class="report" id="report">${esc(weeklyReport())}</pre><button class="btn" data-a="copy-el" data-t="report">Скопировать отчёт</button></section>
  <section class="card"><h3>Калькулятор прибыли</h3>
    <div class="form-grid"><label>Выручка, ₽<input class="inp" id="cRev" type="number" inputmode="numeric" value="200000"></label><label>Расходы (реклама и т.п.), ₽<input class="inp" id="cExp" type="number" inputmode="numeric" value="50000"></label></div>
    <label class="chk row-chk"><input type="checkbox" id="cFirst" ${programMonth()===1?'checked':''}><span></span>Первый месяц (0% наставнику)</label>
    <div class="calc" id="calcOut"></div><p class="muted sm">Доля считается с прибыли, а не с выручки: сначала вычитаем расходы, потом делим.</p></section>`;
}
function calcHtml(rev,exp,first){
  const profit=Math.max(0,rev-exp), fee=first?0:Math.round(profit*0.4), mine=profit-fee;
  const n=v=>v.toLocaleString('ru-RU')+' ₽';
  return `<div><small>Прибыль</small><b>${n(profit)}</b></div><div><small>Наставнику ${first?'0%':'40%'}</small><b>${n(fee)}</b></div><div><small>Тебе</small><b class="g">${n(mine)}</b></div>`;
}
function weeklyReport(){
  const [wf,wt]=periodRange('week'), f=funnel(wf,wt);
  const act=S.experts.filter(e=>['warmup','webinar','sale','repeat'].includes(e.stage));
  const next=S.experts.filter(e=>e.next&&e.stage!=='lost').sort((a,b)=>a.next.date.localeCompare(b.next.date)).slice(0,5);
  return `Nexus · отчёт за неделю ${D.fmt(wf)} — ${D.fmt(wt)}${S.profile.name?' ('+S.profile.name+')':''}
Касаний: ${f.touches} из ${S.norms.week}
Ответов: ${f.replies} (${pct(f.replies,f.touches)}%)
Согласий на созвон: ${f.agreed}
Созвонов проведено: ${f.calls}
Эксперты в работе: ${act.length}${act.length?' ('+act.map(e=>e.name).join(', ')+')':''}
Ближайшие шаги:
${next.length?next.map(e=>'• '+e.name+' — '+e.next.text+' ('+D.fmt(e.next.date)+')').join('\n'):'• —'}`;
}

/* ---------- Путь ---------- */
function vPath(){
  const pm=programMonth(), cur=S.profile.role;
  return `<header class="page-h"><div><h1>Путь в Nexus</h1><p class="muted">Роли, этапы работы с экспертом и условия</p></div></header>
  <section class="card hero"><div><small>Ты в программе</small><b>Месяц ${pm}</b></div><div><small>Наставнику</small><b>${pm===1?'0%':'40% с прибыли'}</b></div>
    <p class="muted sm">Первый месяц — учишься и ищешь эксперта, ничего не платишь. Со второго — 40% с прибыли. Нет прибыли — нет оплаты.</p></section>
  <section class="card"><h3>Лестница ролей</h3><div class="ladder">${ROLES.map(r=>`<div class="rung ${r.id===cur?'on':''}"><span class="ri">${r.icon}</span><div><b>${r.name}</b><p class="muted sm">${r.text}</p></div></div>`).join('')}</div></section>
  <section class="card"><h3>Путь с экспертом</h3><div class="journey">${JOURNEY.map((j,i)=>{
    const n=S.experts.filter(e=>j.stages.includes(e.stage)).length;
    return `<a class="jstep" href="#experts"><span class="jn">${i+1}</span><div><b>${j.title}</b><p class="muted sm">${j.text}</p></div>${chip(String(n),n?'good':'')}</a>`;}).join('')}</div></section>
  <section class="card"><h3>Кого выбирать</h3><ul class="ok">${CRITERIA.map(c=>`<li>${esc(c.label)}</li>`).join('')}</ul>
    <p class="muted sm">Где искать: ${CHANNELS_SEARCH.join(', ')}. Где писать: Telegram, VK, WhatsApp, MAX. Онлайн-контакт → договориться об офлайн-встрече.</p></section>
  <section class="card"><h3>Достижения</h3><div class="badges">${badges().map(b=>`<div class="badge ${b.ok?'on':''}"><b>${b.i}</b><small>${b.t}</small></div>`).join('')}</div></section>
  <section class="card"><h3>Нормы</h3><div class="norms"><div><b>${S.norms.day}</b><small>касания в день</small></div><div><b>${S.norms.week}</b><small>в неделю (минимум)</small></div><div><b>${S.norms.month}</b><small>в месяц</small></div></div>
    <p class="muted sm">Почему не больше: не хватит ресурса вести диалог со всеми, пропадёт индивидуальность, эксперт почувствует рассылку.</p></section>`;
}

/* ---------- Настройки ---------- */
function vSettings(){
  const p=S.profile;
  return `<header class="page-h"><div><h1>Настройки</h1></div></header>
  <section class="card"><h3>Профиль</h3><form data-form="profile" class="form-grid">
    <label>Имя<input class="inp" name="name" value="${esc(p.name)}"></label>
    <label>Пол (для текстов сообщений)<select class="inp" name="gender"><option value="m" ${p.gender==='m'?'selected':''}>Мужской</option><option value="f" ${p.gender==='f'?'selected':''}>Женский</option></select></label>
    <label>Роль<select class="inp" name="role">${ROLES.map(r=>`<option value="${r.id}" ${p.role===r.id?'selected':''}>${r.name}</option>`).join('')}</select></label>
    <label>Моя ниша<input class="inp" name="niche" value="${esc(p.niche)}" placeholder="спорт, финансы, красота…"></label>
    <label>Дата старта в программе<input class="inp" type="date" name="startDate" value="${esc(p.startDate)}"></label>
    <label>Норма: в день / в неделю / в месяц<span class="trio"><input class="inp" type="number" min="1" name="nd" value="${S.norms.day}"><input class="inp" type="number" min="1" name="nw" value="${S.norms.week}"><input class="inp" type="number" min="1" name="nm" value="${S.norms.month}"></span></label>
    <div><button class="btn primary" type="submit">Сохранить</button></div></form></section>
  <section class="card"><h3>Оформление</h3><div class="seg wide">${[['auto','Авто'],['light','Светлая'],['dark','Тёмная']].map(x=>`<button class="${S.theme===x[0]?'on':''}" data-a="theme" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></section>
  <section class="card"><h3>Данные</h3>
    <p class="muted sm">Всё хранится только в этом браузере. Делай копию — особенно перед сменой телефона. ${S.lastBackup?'Последняя копия: '+D.fmt(S.lastBackup)+'.':'<b>Копий ещё не было.</b>'}</p>
    <div class="row wrap gap"><button class="btn" data-a="export-json">⬇ Резервная копия (JSON)</button><button class="btn" data-a="export-csv">⬇ Таблица (CSV)</button><label class="btn">⬆ Загрузить копию<input type="file" id="importFile" accept=".json,application/json" hidden></label></div>
    <div class="row wrap gap sp"><button class="btn" data-a="demo">Загрузить демо-данные</button><button class="btn danger-o" data-a="reset">Стереть всё</button></div></section>
  <section class="card"><h3>Установка на телефон</h3><p class="muted sm">Открой сайт в браузере → меню → «Добавить на главный экран» (iPhone: «Поделиться» → «На экран Домой»). Работает без интернета.</p></section>`;
}
