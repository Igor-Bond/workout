(function(){
  'use strict';

  // ================== ДАННЫЕ-СПРАВОЧНИКИ ==================
  const WORKOUT_TYPES = [
    { id: 'strength', name: 'Силовая', ic: '🏋️' },
    { id: 'cardio',   name: 'Кардио',  ic: '🏃' },
    { id: 'stretch',  name: 'Растяжка', ic: '🧘' },
    { id: 'home',     name: 'Дома без инвентаря', ic: '🏠' },
    { id: 'custom',   name: 'Свой вариант', ic: '✏️' }
  ];

  const PRESET_EXERCISES = ['Отжимания', 'Приседания', 'Подтягивания', 'Пресс'];

  const STORAGE_KEY = 'workout_history_v2';

  // ================== ЭЛЕМЕНТЫ ==================
  const typeScreen = document.getElementById('typeScreen');
  const setupScreen = document.getElementById('setupScreen');
  const sessionScreen = document.getElementById('sessionScreen');
  const summaryScreen = document.getElementById('summaryScreen');
  const historyScreen = document.getElementById('historyScreen');
  const statsScreen = document.getElementById('statsScreen');

  const typeGrid = document.getElementById('typeGrid');
  const customTypeField = document.getElementById('customTypeField');
  const customTypeName = document.getElementById('customTypeName');
  const toPlanBtn = document.getElementById('toPlanBtn');
  const backToType = document.getElementById('backToType');

  const presetPicker = document.getElementById('presetPicker');
  const exerciseList = document.getElementById('exerciseList');
  const addExerciseBtn = document.getElementById('addExerciseBtn');
  const startBtn = document.getElementById('startBtn');

  const sessExerciseName = document.getElementById('sessExerciseName');
  const setProgress = document.getElementById('setProgress');
  const exProgress = document.getElementById('exProgress');
  const elapsedTimeEl = document.getElementById('elapsedTime');
  const repsInput = document.getElementById('repsInput');
  const repsWeight = document.getElementById('repsWeight');
  const doneBtn = document.getElementById('doneBtn');
  const skipExBtn = document.getElementById('skipExBtn');
  const logTable = document.getElementById('logTable');
  const logBody = document.getElementById('logBody');

  const summaryTitle = document.getElementById('summaryTitle');
  const summaryMeta = document.getElementById('summaryMeta');
  const summaryBlocks = document.getElementById('summaryBlocks');
  const totalExercises = document.getElementById('totalExercises');
  const totalSets = document.getElementById('totalSets');
  const totalReps = document.getElementById('totalReps');
  const totalTime = document.getElementById('totalTime');
  const totalVolumeWrap = document.getElementById('totalVolumeWrap');
  const totalVolume = document.getElementById('totalVolume');
  const avgReps = document.getElementById('avgReps');
  const restartBtn = document.getElementById('restartBtn');

  const historyFilter = document.getElementById('historyFilter');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const statsContent = document.getElementById('statsContent');

  const tabWorkout = document.getElementById('tabWorkout');
  const tabHistory = document.getElementById('tabHistory');
  const tabStats = document.getElementById('tabStats');

  const installBanner = document.getElementById('installBanner');
  const installBtn = document.getElementById('installBtn');

  // ================== ХРАНИЛИЩЕ ==================
  function loadHistory(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return []; }
  }
  function saveHistory(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }catch(e){}
  }
  let history = loadHistory();

  // ================== СОСТОЯНИЕ ВЫБОРА ТИПА ==================
  let selectedTypeId = WORKOUT_TYPES[0].id;

  function renderTypeGrid(){
    typeGrid.innerHTML = '';
    WORKOUT_TYPES.forEach(t => {
      const card = document.createElement('div');
      card.className = 'type-card' + (t.id === selectedTypeId ? ' selected' : '');
      card.innerHTML = `<span class="ic">${t.ic}</span>${t.name}`;
      card.addEventListener('click', () => {
        selectedTypeId = t.id;
        customTypeField.style.display = (t.id === 'custom') ? 'block' : 'none';
        renderTypeGrid();
      });
      typeGrid.appendChild(card);
    });
  }

  function currentTypeLabel(){
    if (selectedTypeId === 'custom'){
      return customTypeName.value.trim() || 'Свой вариант';
    }
    const t = WORKOUT_TYPES.find(x => x.id === selectedTypeId);
    return t ? t.name : 'Тренировка';
  }

  // ================== КОНСТРУКТОР ПЛАНА ==================
  function addExerciseRow(prefill){
    const row = document.createElement('div');
    row.className = 'exercise-row';
    row.innerHTML = `
      <div class="ex-fields">
        <div class="ex-top-row">
          <input type="text" class="ex-name" placeholder="Название упражнения" value="${prefill && prefill.name ? prefill.name : ''}">
        </div>
        <div class="ex-bottom-row">
          <div>
            <label style="margin-bottom:4px;">Подходы</label>
            <input type="number" class="ex-sets" min="1" value="${prefill && prefill.sets ? prefill.sets : 3}">
          </div>
          <div>
            <label style="margin-bottom:4px;">Вес, кг</label>
            <input type="number" class="ex-weight" min="0" step="0.5" placeholder="—" value="${prefill && prefill.weight ? prefill.weight : ''}">
          </div>
        </div>
      </div>
      <button class="remove-x" title="Удалить">×</button>
    `;
    row.querySelector('.remove-x').addEventListener('click', ()=>{
      if (exerciseList.children.length > 1){
        row.remove();
      } else {
        row.querySelector('.ex-name').value = '';
        row.querySelector('.ex-sets').value = 3;
        row.querySelector('.ex-weight').value = '';
      }
    });
    exerciseList.appendChild(row);
  }

  function renderPresetPicker(){
    presetPicker.innerHTML = '';
    PRESET_EXERCISES.forEach(name => {
      const chip = document.createElement('div');
      chip.className = 'picker-chip';
      chip.textContent = name;
      chip.addEventListener('click', ()=>{
        const firstEmpty = Array.from(exerciseList.querySelectorAll('.exercise-row')).find(r => r.querySelector('.ex-name').value.trim() === '');
        if (firstEmpty){
          firstEmpty.querySelector('.ex-name').value = name;
        } else {
          addExerciseRow({ name, sets: 3, weight: '' });
        }
      });
      presetPicker.appendChild(chip);
    });
  }

  function readPlan(){
    const rows = Array.from(exerciseList.querySelectorAll('.exercise-row'));
    return rows.map((row, idx) => {
      const name = row.querySelector('.ex-name').value.trim() || `Упражнение ${idx+1}`;
      const sets = Math.max(1, parseInt(row.querySelector('.ex-sets').value, 10) || 1);
      const weight = parseFloat(row.querySelector('.ex-weight').value) || 0;
      return { name, totalSets: sets, weight };
    });
  }

  // ================== СОСТОЯНИЕ АКТИВНОЙ ТРЕНИРОВКИ ==================
  let plan = [];
  let exIndex = 0;
  let setIndex = 0;
  let sessionLog = [];
  let workoutTypeLabel = '';
  let startTime = null;
  let timerHandle = null;

  function fmtElapsed(ms){
    const totalSec = Math.floor(ms/1000);
    const m = Math.floor(totalSec/60).toString().padStart(2,'0');
    const s = (totalSec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  function tickTimer(){
    elapsedTimeEl.textContent = fmtElapsed(Date.now() - startTime);
  }

  function startWorkout(){
    plan = readPlan().filter(p => p.totalSets > 0);
    if (plan.length === 0) return;

    workoutTypeLabel = currentTypeLabel();
    exIndex = 0;
    setIndex = 0;
    sessionLog = plan.map(p => ({ name: p.name, weight: p.weight, sets: [] }));
    startTime = Date.now();

    showScreen('session');
    loadCurrentExercise();

    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(tickTimer, 1000);
    tickTimer();
  }

  function loadCurrentExercise(){
    const ex = plan[exIndex];
    sessExerciseName.textContent = ex.name;
    repsWeight.value = ex.weight > 0 ? ex.weight : '';
    repsInput.value = '';
    renderProgress();
    logBody.innerHTML = '';
    logTable.style.display = 'none';
    setTimeout(()=>repsInput.focus(), 50);
  }

  function renderProgress(){
    const ex = plan[exIndex];
    setProgress.textContent = `Подход ${setIndex+1} из ${ex.totalSets}`;
    exProgress.textContent = `Упражнение ${exIndex+1} из ${plan.length}`;
  }

  function flashError(el){
    el.focus();
    el.style.borderColor = 'var(--bad)';
    setTimeout(()=>{ el.style.borderColor = ''; }, 600);
  }

  function completeSet(){
    const reps = parseInt(repsInput.value, 10);
    if (isNaN(reps) || reps < 0){ flashError(repsInput); return; }
    const weight = parseFloat(repsWeight.value) || 0;

    sessionLog[exIndex].sets.push({ set: setIndex+1, reps, weight });
    sessionLog[exIndex].weight = weight || sessionLog[exIndex].weight;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${setIndex+1}</td><td>${reps}</td><td>${weight > 0 ? weight : '—'}</td>`;
    logBody.appendChild(tr);
    logTable.style.display = 'table';

    const ex = plan[exIndex];
    if (setIndex + 1 >= ex.totalSets){
      advanceExercise();
    } else {
      setIndex += 1;
      repsInput.value = '';
      renderProgress();
      repsInput.focus();
    }
  }

  function advanceExercise(){
    if (exIndex + 1 >= plan.length){
      finishWorkout();
      return;
    }
    exIndex += 1;
    setIndex = 0;
    loadCurrentExercise();
  }

  function skipExercise(){ advanceExercise(); }

  function finishWorkout(){
    if (timerHandle) clearInterval(timerHandle);
    const durationMs = Date.now() - startTime;

    const record = {
      date: new Date().toISOString(),
      type: workoutTypeLabel,
      durationMs: durationMs,
      exercises: sessionLog.filter(e => e.sets.length > 0)
    };
    history.unshift(record);
    saveHistory();
    renderSummary(record);
    showScreen('summary');
  }

  function renderSummary(record){
    summaryTitle.textContent = 'Итоги тренировки';
    summaryMeta.textContent = `${record.type} · ${formatDate(record.date)}`;
    summaryBlocks.innerHTML = '';

    let setsSum = 0, repsSum = 0, volumeSum = 0, hasWeight = false;

    record.exercises.forEach(ex => {
      const block = document.createElement('div');
      block.className = 'ex-block';
      let exReps = 0, exSets = ex.sets.length;
      let rowsHtml = '';
      ex.sets.forEach(s => {
        exReps += s.reps;
        if (s.weight > 0){ hasWeight = true; volumeSum += s.reps * s.weight; }
        rowsHtml += `<tr><td>${s.set}</td><td>${s.reps}</td><td>${s.weight > 0 ? s.weight : '—'}</td></tr>`;
      });
      setsSum += exSets;
      repsSum += exReps;

      block.innerHTML = `
        <div class="ex-block-title">${ex.name} <span class="sub">${exSets} подх. · ${exReps} повт.</span></div>
        <table class="log">
          <thead><tr><th>Подход</th><th>Повторы</th><th>Вес</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
      summaryBlocks.appendChild(block);
    });

    totalExercises.textContent = record.exercises.length;
    totalSets.textContent = setsSum;
    totalReps.textContent = repsSum;
    totalTime.textContent = fmtElapsed(record.durationMs || 0);
    avgReps.textContent = setsSum > 0 ? (repsSum/setsSum).toFixed(1) : '0';
    if (hasWeight){
      totalVolumeWrap.classList.remove('hidden');
      totalVolume.textContent = volumeSum.toFixed(1).replace(/\.0$/, '');
    } else {
      totalVolumeWrap.classList.add('hidden');
    }
  }

  // ================== ЭКРАНЫ / НАВИГАЦИЯ ==================
  function showScreen(name){
    const all = { type: typeScreen, setup: setupScreen, session: sessionScreen, summary: summaryScreen, history: historyScreen, stats: statsScreen };
    Object.entries(all).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));

    const isMainFlow = (name === 'type' || name === 'setup' || name === 'session' || name === 'summary');
    tabWorkout.classList.toggle('active', isMainFlow);
    tabHistory.classList.toggle('active', name === 'history');
    tabStats.classList.toggle('active', name === 'stats');
  }

  function goToPlan(){
    if (selectedTypeId === 'custom' && !customTypeName.value.trim()){
      flashError(customTypeName);
      return;
    }
    showScreen('setup');
  }

  function resetToTypeSelect(){
    showScreen('type');
  }

  // ================== ИСТОРИЯ ==================
  function formatDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }) +
           ' ' + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
  }

  let activeHistoryFilter = 'all';

  function uniqueTypesInHistory(){
    const set = new Set(history.map(r => r.type));
    return Array.from(set);
  }

  function renderHistoryFilter(){
    historyFilter.innerHTML = '';
    const types = ['all', ...uniqueTypesInHistory()];
    types.forEach(t => {
      const chip = document.createElement('div');
      chip.className = 'picker-chip' + (activeHistoryFilter === t ? ' selected' : '');
      chip.textContent = t === 'all' ? 'Все' : t;
      chip.addEventListener('click', ()=>{ activeHistoryFilter = t; renderHistoryFilter(); renderHistoryList(); });
      historyFilter.appendChild(chip);
    });
  }

  function renderHistoryList(){
    historyList.innerHTML = '';
    const filtered = activeHistoryFilter === 'all' ? history : history.filter(r => r.type === activeHistoryFilter);

    clearHistoryBtn.classList.toggle('hidden', history.length === 0);

    if (filtered.length === 0){
      historyList.innerHTML = '<div class="empty-note">Пока нет тренировок в этой категории</div>';
      return;
    }
    filtered.forEach((rec) => {
      let setsSum = 0, repsSum = 0;
      rec.exercises.forEach(ex => { setsSum += ex.sets.length; ex.sets.forEach(s => repsSum += s.reps); });
      const namesShort = rec.exercises.map(e => e.name).join(', ');

      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="h-date"><span>${formatDate(rec.date)}</span><span class="h-type-badge">${rec.type}</span></div>
        <div class="h-name">${namesShort}</div>
        <div class="h-stats">${setsSum} подходов · ${repsSum} повторений · ${fmtElapsed(rec.durationMs || 0)}</div>
      `;
      item.addEventListener('click', ()=>{
        renderSummary(rec);
        showScreen('summary');
      });
      historyList.appendChild(item);
    });
  }

  function openHistory(){
    renderHistoryFilter();
    renderHistoryList();
    showScreen('history');
  }

  // ================== СТАТИСТИКА / ВИЗУАЛИЗАЦИЯ ==================
  function buildStats(){
    if (history.length === 0){
      statsContent.innerHTML = '<div class="card"><div class="empty-note">Нет данных — сначала проведи тренировку</div></div>';
      return;
    }

    let totalWorkouts = history.length;
    let totalSetsAll = 0, totalRepsAll = 0, totalTimeAll = 0, totalVolumeAll = 0;
    const byType = {};
    const last7 = []; // последние тренировки по дате для графика

    history.forEach(rec => {
      let s = 0, r = 0, v = 0;
      rec.exercises.forEach(ex => ex.sets.forEach(set => {
        s += 1; r += set.reps; if (set.weight > 0) v += set.reps * set.weight;
      }));
      totalSetsAll += s; totalRepsAll += r; totalVolumeAll += v;
      totalTimeAll += (rec.durationMs || 0);
      byType[rec.type] = (byType[rec.type] || 0) + 1;
    });

    const avgSetsPerWorkout = (totalSetsAll/totalWorkouts).toFixed(1);
    const avgRepsPerSet = totalSetsAll > 0 ? (totalRepsAll/totalSetsAll).toFixed(1) : '0';
    const avgDuration = fmtElapsed(totalTimeAll/totalWorkouts);

    // последние до 8 тренировок, в хронологическом порядке (старые слева)
    const recent = history.slice(0, 8).slice().reverse();
    const repsPerWorkout = recent.map(rec => {
      let r = 0; rec.exercises.forEach(ex => ex.sets.forEach(set => r += set.reps));
      return { label: new Date(rec.date).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}), value: r };
    });

    statsContent.innerHTML = '';

    // блок основных показателей
    const statCard = document.createElement('div');
    statCard.className = 'card';
    statCard.innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><strong>${totalWorkouts}</strong><label2>Тренировок</label2></div>
        <div class="stat-box"><strong>${totalSetsAll}</strong><label2>Подходов всего</label2></div>
        <div class="stat-box"><strong>${totalRepsAll}</strong><label2>Повторений всего</label2></div>
        <div class="stat-box"><strong>${avgSetsPerWorkout}</strong><label2>Подх. / тренировку</label2></div>
        <div class="stat-box"><strong>${avgRepsPerSet}</strong><label2>Повт. / подход</label2></div>
        <div class="stat-box"><strong>${avgDuration}</strong><label2>Сред. длительность</label2></div>
        ${totalVolumeAll > 0 ? `<div class="stat-box"><strong>${totalVolumeAll.toFixed(0)}</strong><label2>Тоннаж всего, кг</label2></div>` : ''}
      </div>
    `;
    statsContent.appendChild(statCard);

    // график: повторения по последним тренировкам (bar chart svg)
    const chartCard = document.createElement('div');
    chartCard.className = 'card chart-wrap';
    chartCard.innerHTML = `<div class="chart-title">Повторения по тренировкам</div>`;
    chartCard.appendChild(buildBarChart(repsPerWorkout));
    statsContent.appendChild(chartCard);

    // график: распределение по типам тренировок
    const typeEntries = Object.entries(byType);
    const typeCard = document.createElement('div');
    typeCard.className = 'card chart-wrap';
    typeCard.innerHTML = `<div class="chart-title">Типы тренировок</div>`;
    typeCard.appendChild(buildBarChart(typeEntries.map(([label, value]) => ({ label, value }))));
    statsContent.appendChild(typeCard);
  }

  function buildBarChart(data){
    const width = 420, height = 180, padding = 28;
    const max = Math.max(1, ...data.map(d => d.value));
    const barW = (width - padding*2) / data.length;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'chart');

    // ось
    const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axis.setAttribute('x1', padding); axis.setAttribute('x2', width-padding);
    axis.setAttribute('y1', height-30); axis.setAttribute('y2', height-30);
    axis.setAttribute('stroke', '#332c26');
    svg.appendChild(axis);

    data.forEach((d, i) => {
      const barH = Math.max(2, (d.value / max) * (height - 60));
      const x = padding + i*barW + barW*0.15;
      const w = barW*0.7;
      const y = (height-30) - barH;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y);
      rect.setAttribute('width', w); rect.setAttribute('height', barH);
      rect.setAttribute('rx', 3);
      rect.setAttribute('fill', '#ff7a33');
      svg.appendChild(rect);

      const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valText.setAttribute('x', x + w/2); valText.setAttribute('y', y - 6);
      valText.setAttribute('text-anchor', 'middle');
      valText.setAttribute('class', 'bar-value');
      valText.textContent = d.value;
      svg.appendChild(valText);

      const lblText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lblText.setAttribute('x', x + w/2); lblText.setAttribute('y', height-14);
      lblText.setAttribute('text-anchor', 'middle');
      lblText.setAttribute('class', 'bar-label');
      lblText.textContent = d.label.length > 8 ? d.label.slice(0,8) : d.label;
      svg.appendChild(lblText);
    });

    return svg;
  }

  // ================== УСТАНОВКА PWA ==================
  let deferredInstallEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallEvent = e;
    installBanner.classList.remove('hidden');
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredInstallEvent) return;
    deferredInstallEvent.prompt();
    await deferredInstallEvent.userChoice;
    installBanner.classList.add('hidden');
    deferredInstallEvent = null;
  });
  window.addEventListener('appinstalled', () => {
    installBanner.classList.add('hidden');
  });

  // ================== СЕРВИС-ВОРКЕР ==================
  if ('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    });
  }

  // ================== СЛУШАТЕЛИ ==================
  toPlanBtn.addEventListener('click', goToPlan);
  backToType.addEventListener('click', resetToTypeSelect);
  addExerciseBtn.addEventListener('click', ()=>addExerciseRow());
  startBtn.addEventListener('click', startWorkout);
  doneBtn.addEventListener('click', completeSet);
  skipExBtn.addEventListener('click', skipExercise);
  restartBtn.addEventListener('click', resetToTypeSelect);

  repsInput.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') completeSet(); });

  clearHistoryBtn.addEventListener('click', ()=>{
    history = [];
    saveHistory();
    renderHistoryFilter();
    renderHistoryList();
  });

  tabWorkout.addEventListener('click', resetToTypeSelect);
  tabHistory.addEventListener('click', openHistory);
  tabStats.addEventListener('click', ()=>{ buildStats(); showScreen('stats'); });

  // ================== СТАРТ ==================
  renderTypeGrid();
  renderPresetPicker();
  addExerciseRow();
  showScreen('type');
})();
