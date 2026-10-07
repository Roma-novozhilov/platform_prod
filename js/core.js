/* Хранилище, даты и бизнес-логика трекера */
const pad = n => String(n).padStart(2,'0');
const D = {
  iso: d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),
  today(){ return D.iso(new Date()); },
  parse(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); },
  add(s,n){ const d=D.parse(s); d.setDate(d.getDate()+n); return D.iso(d); },
  diff(a,b){ return Math.round((D.parse(a)-D.parse(b))/864e5); },
  weekStart(s){ const d=D.parse(s); d.setDate(d.getDate()-((d.getDay()+6)%7)); return D.iso(d); },
  monthStart(s){ return s.slice(0,8)+'01'; },
  fmt(s){ if(!s) return '—'; const d=D.parse(s); return d.getDate()+' '+MONTHS_RU[d.getMonth()]; },
  fmtDow(s){ const d=D.parse(s); return DAYS_RU[d.getDay()]+', '+d.getDate()+' '+MONTHS_RU[d.getMonth()]; },
  rel(s){
    const n=D.diff(s,D.today());
    if(n===0) return 'сегодня'; if(n===1) return 'завтра'; if(n===-1) return 'вчера';
    return n>0 ? 'через '+n+' дн.' : 'просрочено на '+(-n)+' дн.';
  }
};
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stageOf = id => STAGES.find(s=>s.id===id) || STAGES[0];

const KEY = 'producer_platform_v1';
function freshState(){
  return {
    v:1,
    profile:{name:'', role:'assistant', niche:'', gender:'m', startDate:D.today()},
    norms:{day:NORMS.day, week:NORMS.week, month:NORMS.month},
    experts:[],
    tasks: STARTER_TASKS.map(t=>({id:uid(), title:t.title, note:t.note, due:D.add(D.today(),7), done:false, expertId:null})),
    callDraft:null,
    theme:'auto',
    lastBackup:null
  };
}
let S = (function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){ const p=JSON.parse(raw); return Object.assign(freshState(), p); }
  }catch(e){}
  return freshState();
})();
const listeners = [];
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){ console.warn('save failed', e); }
  listeners.forEach(f=>f());
}
function onChange(f){ listeners.push(f); }

/* ---------- эксперты ---------- */
const getExpert = id => S.experts.find(e=>e.id===id);
function addLog(e, text){ e.log.unshift({t:new Date().toISOString(), text}); }

function newExpert(data){
  const e = Object.assign({
    id:uid(), name:'', link:'', niche:S.profile.niche||'', channel:'Telegram', why:'',
    criteria:{}, flags:{}, stage:'found', touches:[], calls:[],
    repliedAt:null, callAgreedAt:null, callDoneAt:null, activatedAt:null,
    callAt:null, next:null, returnDate:null, notes:'', log:[], createdAt:D.today()
  }, data);
  addLog(e,'Эксперт добавлен');
  S.experts.unshift(e);
  save();
  return e;
}

function setNext(e, date, text){ e.next = date ? {date, text} : null; }

function setStage(e, stage, opts={}){
  if(e.stage===stage) return;
  const prev = e.stage, today = D.today();
  e.stage = stage;
  addLog(e, 'Статус: '+stageOf(prev).label+' → '+stageOf(stage).label);
  if(stage==='replied'){
    e.repliedAt = e.repliedAt || today;
    setNext(e, today, 'Ответь и переведи на созвон — не продавай в переписке');
  }
  if(stage==='call_set'){
    e.callAgreedAt = e.callAgreedAt || today;
    if(!e.repliedAt) e.repliedAt = today;
    setNext(e, e.callAt || D.add(today,1), 'Созвон: структура на 15 минут');
  }
  if(stage==='thinking') setNext(e, D.add(today,NORMS.thinkDays), 'Напомнить + скинуть 2–3 идеи под его нишу');
  if(stage==='warmup'){
    e.activatedAt = e.activatedAt || today;
    if(!e.callDoneAt) e.callDoneAt = today;
    setNext(e, D.add(today,1), 'Зафиксировать условия, назначить дату старта');
  }
  if(stage==='webinar') setNext(e, D.add(today,3), 'Подготовить запуск вебинара');
  if(stage==='sale')    setNext(e, D.add(today,2), 'Закрыть сделку');
  if(stage==='repeat')  setNext(e, D.add(today,14), 'Касание для удержания эксперта');
  if(stage==='paused'){
    e.returnDate = opts.returnDate || D.add(today,NORMS.returnDays);
    setNext(e, e.returnDate, 'Вернуться: ситуация могла измениться');
  }
  if(stage==='lost') setNext(e, null);
  if(stage==='found' || stage==='touched') { if(stage==='found') setNext(e,null); }
  save();
}

function logTouch(e, {channel, text, date}={}){
  date = date || D.today();
  e.touches.push({id:uid(), date, channel: channel||e.channel, text:text||''});
  const n = e.touches.length;
  addLog(e, 'Касание №'+n+' ('+(channel||e.channel)+')');
  if(e.stage==='found' || e.stage==='paused'){
    const was = e.stage;
    e.stage='touched'; e.returnDate=null;
    if(was==='paused') addLog(e,'Вернулся из паузы');
  }
  if(e.stage==='touched'){
    if(n<NORMS.maxTouches) setNext(e, D.add(date,NORMS.followUpDays), (n+1)+'-е касание: дай новую идею под его нишу');
    else setNext(e, D.add(date,NORMS.followUpDays), 'Тишина после '+n+' касаний? Отпусти в паузу на 2–3 месяца');
  }
  save();
}

function markReplied(e){ setStage(e,'replied'); }
function pauseExpert(e, days){ setStage(e,'paused',{returnDate:D.add(D.today(), days||NORMS.returnDays)}); }

function scheduleCall(e, date, time){
  e.callAt = date; e.callTime = time||'';
  e.callAgreedAt = e.callAgreedAt || D.today();
  if(!e.repliedAt) e.repliedAt = D.today();
  if(e.stage!=='call_set') { const old=e.stage; e.stage='call_set'; addLog(e,'Статус: '+stageOf(old).label+' → Созвон назначен'); }
  addLog(e,'Созвон назначен на '+D.fmt(date)+(time?' '+time:''));
  setNext(e, date, 'Созвон'+(time?' в '+time:'')+': структура на 15 минут');
  save();
}

function finishCall(e, {outcome, nextText, nextDate, conditions, notes, secs, callNotes}){
  const today = D.today();
  e.callDoneAt = today;
  e.calls.push({id:uid(), date:today, outcome, nextText, nextDate, notes, secs, callNotes});
  addLog(e,'Созвон проведён: '+({agreed:'согласился',thinking:'думает',second:'нужна 2-я встреча',refused:'отказ'}[outcome]));
  if(outcome==='agreed'){
    e.stage='warmup'; e.activatedAt = e.activatedAt||today;
    setNext(e, nextDate, nextText);
    if(conditions) addLog(e,'Условия зафиксированы');
  } else if(outcome==='thinking'){
    e.stage='thinking'; setNext(e, nextDate, nextText);
  } else if(outcome==='second'){
    e.stage='call_set'; e.callAt=nextDate; setNext(e, nextDate, nextText);
  } else {
    e.stage='lost'; setNext(e,null);
  }
  S.callDraft=null;
  save();
}

function deleteExpert(id){ S.experts = S.experts.filter(e=>e.id!==id); S.tasks.forEach(t=>{ if(t.expertId===id) t.expertId=null; }); save(); }

function criteriaScore(e){ return CRITERIA.filter(c=>e.criteria[c.id]).length; }
function flagCount(e){ return RED_FLAGS.filter(f=>e.flags[f.id]).length; }

/* ---------- метрики ---------- */
function allTouches(){
  const out=[];
  S.experts.forEach(e=>e.touches.forEach(t=>out.push(Object.assign({expertId:e.id, expert:e}, t))));
  return out;
}
function countTouches(from,to){ return allTouches().filter(t=>t.date>=from && t.date<=to).length; }
function inRange(d,from,to){ return !!d && d>=from && d<=to; }
function funnel(from,to){
  return {
    touches: countTouches(from,to),
    replies: S.experts.filter(e=>inRange(e.repliedAt,from,to)).length,
    agreed:  S.experts.filter(e=>inRange(e.callAgreedAt,from,to)).length,
    calls:   S.experts.filter(e=>inRange(e.callDoneAt,from,to)).length,
    active:  S.experts.filter(e=>inRange(e.activatedAt,from,to)).length
  };
}
function periodRange(p){
  const t=D.today();
  if(p==='day') return [t,t];
  if(p==='week') return [D.weekStart(t), D.add(D.weekStart(t),6)];
  if(p==='month') { const ms=D.monthStart(t); const d=D.parse(ms); d.setMonth(d.getMonth()+1); d.setDate(0); return [ms, D.iso(d)]; }
  return ['2000-01-01','2999-12-31'];
}
function pct(a,b){ return b ? Math.round(a/b*100) : 0; }

/* Диагностика по правилам из презентации (слайд «Конверсия») */
function diagnose(f){
  const out=[];
  if(f.touches<NORMS.week) { out.push({lvl:'info', t:'Мало данных: сделай хотя бы '+NORMS.week+' касаний, чтобы выводы были честными.'}); return out; }
  if(f.replies===0) out.push({lvl:'bad', t:'0 ответов на '+f.touches+' касаний — проблема в тексте сообщения. Поменяй формулировку и разбери с наставником.', go:'#scripts'});
  else if(f.agreed===0) out.push({lvl:'bad', t:'Ответы есть, но 0 согласий на созвон — проблема в переводе диалога. Разбери, что писать после ответа.', go:'#scripts/replies'});
  else if(f.calls>0 && f.active===0 && f.calls>=2) out.push({lvl:'warn', t:'Созвоны есть, но эксперты не доходят до работы — пересмотри критерии отбора и работу с возражениями.', go:'#scripts/objections'});
  const rr = f.touches ? f.replies/f.touches : 0;
  if(f.replies>0 && rr>=0.2) out.push({lvl:'good', t:'Отклик '+pct(f.replies,f.touches)+'% — в пределах нормы (20–30%). Так держать.'});
  if(!out.length) out.push({lvl:'good', t:'Воронка выглядит здоровой. Продолжай по норме и фиксируй результат.'});
  return out;
}

/* ---------- сегодняшние действия ---------- */
function todayActions(){
  const t=D.today(), items=[];
  S.experts.forEach(e=>{
    if(e.stage==='lost') return;
    if(e.next && e.next.date<=t) items.push({kind:'next', expert:e, date:e.next.date, text:e.next.text, overdue:e.next.date<t});
  });
  items.sort((a,b)=>a.date.localeCompare(b.date));
  return items;
}
function stuckExperts(){
  const t=D.today();
  return S.experts.filter(e=>e.stage==='touched' && e.touches.length>=NORMS.maxTouches &&
    D.diff(t, e.touches[e.touches.length-1].date)>=NORMS.followUpDays);
}
function programMonth(){ return Math.max(1, Math.floor(D.diff(D.today(), S.profile.startDate)/30)+1); }

/* ---------- резервные копии ---------- */
function exportJSON(){
  S.lastBackup = D.today(); save();
  return JSON.stringify(S,null,2);
}
function importJSON(txt){
  const p = JSON.parse(txt);
  if(!p || !Array.isArray(p.experts)) throw new Error('Неверный формат файла');
  S = Object.assign(freshState(), p); save();
}
function exportCSV(){
  const q = v => '"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const rows=[['Имя эксперта','Ссылка','Ниша','Канал','Дата последнего касания','Касаний','Ответил?','Согласился на созвон?','Статус','Следующее действие','Дата']];
  S.experts.forEach(e=>{
    const last=e.touches.length?e.touches[e.touches.length-1].date:'';
    rows.push([e.name,e.link,e.niche,e.channel,last,e.touches.length,e.repliedAt?'да':'нет',e.callAgreedAt?'да':'нет',stageOf(e.stage).label,e.next?e.next.text:'',e.next?e.next.date:'']);
  });
  return '﻿'+rows.map(r=>r.map(q).join(';')).join('\r\n');
}
function resetAll(){ S=freshState(); save(); }

/* ---------- демо-данные ---------- */
function loadDemo(){
  const t=D.today();
  const mk=(name,niche,ch,stage,touchDays,extra={})=>{
    const e={id:uid(),name,link:'https://t.me/'+name.toLowerCase().replace(/[^a-z0-9]/g,'')+'_demo',niche,channel:ch,why:'Живая аудитория, стабильный рост просмотров',
      criteria:{flow:1,income:1,audience:1,charisma:1,experience:1},flags:{},stage,touches:[],calls:[],repliedAt:null,callAgreedAt:null,callDoneAt:null,activatedAt:null,
      callAt:null,next:null,returnDate:null,notes:'',log:[],createdAt:D.add(t,-(touchDays[0]||0))};
    touchDays.forEach(d=>e.touches.push({id:uid(),date:D.add(t,-d),channel:ch,text:''}));
    Object.assign(e,extra); addLog(e,'Демо-данные'); return e;
  };
  const list=[
    mk('Анна Фитнес','Спорт','Instagram','call_set',[6,3],{repliedAt:D.add(t,-2),callAgreedAt:D.add(t,-1),callAt:D.add(t,1),next:{date:D.add(t,1),text:'Созвон: структура на 15 минут'}}),
    mk('Игорь Финансы','Финансы','Telegram','thinking',[9,6],{repliedAt:D.add(t,-6),callAgreedAt:D.add(t,-5),callDoneAt:D.add(t,-3),next:{date:t,text:'Напомнить + скинуть 2–3 идеи под его нишу'}}),
    mk('Мария Психолог','Психология','VK','warmup',[20,17],{repliedAt:D.add(t,-16),callAgreedAt:D.add(t,-15),callDoneAt:D.add(t,-12),activatedAt:D.add(t,-12),next:{date:D.add(t,2),text:'Прогрев: собрать вопросы аудитории'}}),
    mk('Олег Тренер','Спорт','TikTok','touched',[3],{next:{date:t,text:'2-е касание: дай новую идею под его нишу'}}),
    mk('Света Визажист','Красота','Instagram','touched',[8,5,2],{next:{date:t,text:'Тишина после 3 касаний? Отпусти в паузу на 2–3 месяца'}}),
    mk('Денис Инвестор','Финансы','YouTube','replied',[4],{repliedAt:D.add(t,-1),next:{date:t,text:'Ответь и переведи на созвон — не продавай в переписке'}}),
    mk('Лена Нутрициолог','Спорт','Telegram','touched',[1],{next:{date:D.add(t,2),text:'2-е касание: дай новую идею под его нишу'}}),
    mk('Павел Коуч','Обучение','WhatsApp','paused',[95,92,89],{returnDate:D.add(t,-4),next:{date:D.add(t,-4),text:'Вернуться: ситуация могла измениться'}}),
    mk('Кира Стилист','Красота','Telegram','found',[0],{touches:[]}),
    mk('Артур Бизнес','Обучение','VK','lost',[15,12],{repliedAt:D.add(t,-11),callAgreedAt:D.add(t,-10),callDoneAt:D.add(t,-8)}),
    mk('Вика Йога','Спорт','Instagram','touched',[0,0,0,0],{})
  ];
  list[10].touches=[{id:uid(),date:t,channel:'Instagram',text:''}];
  list[10].next={date:D.add(t,3),text:'2-е касание: дай новую идею под его нишу'};
  S.experts = list.concat(S.experts);
  save();
}
