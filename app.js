'use strict';

(function () {
  var REC_KEY = 'weightTracker.records.v1';
  var SET_KEY = 'weightTracker.settings.v1';

  function $(id) { return document.getElementById(id); }

  var els = {
    form: $('entryForm'),
    dateInput: $('dateInput'),
    weightInput: $('weightInput'),
    noteInput: $('noteInput'),
    submitBtn: $('submitBtn'),
    cancelEditBtn: $('cancelEditBtn'),
    themeToggle: $('themeToggle'),
    goalInput: $('goalInput'),
    goalSaveBtn: $('goalSaveBtn'),
    statCurrent: $('statCurrent'),
    statDelta: $('statDelta'),
    statTotal: $('statTotal'),
    statTotalDelta: $('statTotalDelta'),
    statMax: $('statMax'),
    statMin: $('statMin'),
    statAvg: $('statAvg'),
    statCount: $('statCount'),
    statGoal: $('statGoal'),
    statGoalText: $('statGoalText'),
    statStatus: $('statStatus'),
    statStatusText: $('statStatusText'),
    chart: $('chart'),
    chartWrap: $('chartWrap'),
    chartEmpty: $('chartEmpty'),
    tooltip: $('tooltip'),
    chartRange: $('chartRange'),
    recordTable: $('recordTable'),
    recordCount: $('recordCount'),
    listEmpty: $('listEmpty'),
    exportBtn: $('exportBtn'),
    importFile: $('importFile'),
    clearBtn: $('clearBtn'),
    syncToken: $('syncToken'),
    syncAutoMerge: $('syncAutoMerge'),
    syncStatus: $('syncStatus'),
    syncConnectBtn: $('syncConnectBtn'),
    syncUploadBtn: $('syncUploadBtn'),
    syncDownloadBtn: $('syncDownloadBtn'),
    syncDisconnectBtn: $('syncDisconnectBtn'),
    toast: $('toast')
  };

  var records = load(REC_KEY, []);
  var settings = load(SET_KEY, {});
  var syncState = { token: '', gistId: '', user: '' };
  var editingDate = null;
  var chartPoints = [];
  var toastTimer = null;
  var resizeTimer = null;

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      showToast('保存失败：浏览器存储不可用');
    }
  }

  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function sortedAsc() {
    return records.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function fmtWeight(v) {
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  function fmtDateCN(s) {
    var d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) { return s; }
    var wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return s + ' ' + wd;
  }

  function esc(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function deltaClass(v) {
    return v > 0 ? 'up' : (v < 0 ? 'down' : 'zero');
  }

  function signText(v) {
    return v > 0 ? '+' + fmtWeight(v) : fmtWeight(v);
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.add('hidden');
    }, 2400);
  }

  function renderAll() {
    renderStats();
    renderChart();
    renderTable();
  }

  function renderStats() {
    var asc = sortedAsc();
    var n = asc.length;
    var last = n ? asc[n - 1] : null;
    var first = n ? asc[0] : null;
    var prev = n >= 2 ? asc[n - 2] : null;
    var goal = settings.goal || null;

    els.statCurrent.textContent = last ? fmtWeight(last.weight) : '--';

    if (n >= 2) {
      var d = last.weight - prev.weight;
      els.statDelta.textContent = signText(d) + ' kg';
      els.statDelta.className = 'stat-delta ' + deltaClass(d);
      els.statDelta.title = '较 ' + fmtDateCN(prev.date);
    } else if (n === 1) {
      els.statDelta.textContent = '首次记录';
      els.statDelta.className = 'stat-delta zero';
      els.statDelta.title = '';
    } else {
      els.statDelta.textContent = '';
      els.statDelta.className = 'stat-delta zero';
      els.statDelta.title = '';
    }

    if (n >= 2) {
      var total = last.weight - first.weight;
      els.statTotal.textContent = signText(total);
      els.statTotalDelta.textContent = '自 ' + first.date.slice(5).replace('-', '/') + ' 起';
      els.statTotalDelta.className = 'stat-delta ' + deltaClass(total);
    } else {
      els.statTotal.textContent = n === 1 ? '0.0' : '--';
      els.statTotalDelta.textContent = n === 1 ? '首条记录' : '';
      els.statTotalDelta.className = 'stat-delta zero';
    }

    if (n) {
      var weights = asc.map(function (r) { return r.weight; });
      var hi = Math.max.apply(null, weights);
      var lo = Math.min.apply(null, weights);
      var sum = weights.reduce(function (a, b) { return a + b; }, 0);
      els.statMax.textContent = fmtWeight(hi);
      els.statMin.textContent = '最低：' + fmtWeight(lo) + ' kg';
      els.statAvg.textContent = fmtWeight(sum / n);
      els.statCount.textContent = '共 ' + n + ' 天';
    } else {
      els.statMax.textContent = '--';
      els.statMin.textContent = '最低：--';
      els.statAvg.textContent = '--';
      els.statCount.textContent = '共 0 天';
    }

    if (goal && last) {
      var gap = goal - last.weight;
      els.statGoal.textContent = signText(gap);
      els.statGoal.className = 'stat-value ' + (gap > 0 ? 'up' : gap < 0 ? 'down' : 'zero');
      els.statGoalText.textContent = '目标 ' + fmtWeight(goal) + ' kg';
    } else {
      els.statGoal.textContent = '--';
      els.statGoal.className = 'stat-value';
      els.statGoalText.textContent = goal ? '暂无体重记录' : '未设置目标';
    }

    els.statStatus.textContent = n ? '正常' : '空';
    els.statStatusText.textContent = '本地存储';
  }

  function renderTable() {
    var asc = sortedAsc();
    var desc = asc.slice().reverse();
    var n = desc.length;

    els.recordCount.textContent = n ? '共 ' + n + ' 条记录' : '';
    els.listEmpty.classList.toggle('hidden', n > 0);

    els.recordTable.innerHTML = desc.map(function (r, i) {
      var prevRec = desc[i + 1];
      var deltaHtml = '<span class="delta zero">—</span>';
      if (prevRec) {
        var d = r.weight - prevRec.weight;
        deltaHtml = '<span class="delta ' + deltaClass(d) + '">' + (d > 0 ? '+' : '') + fmtWeight(d) + '</span>';
      }
      return '<tr>' +
        '<td>' + esc(fmtDateCN(r.date)) + '</td>' +
        '<td><strong>' + fmtWeight(r.weight) + '</strong> kg</td>' +
        '<td>' + deltaHtml + '</td>' +
        '<td class="note-cell">' + (r.note ? esc(r.note) : '<span class="muted">—</span>') + '</td>' +
        '<td class="actions-cell">' +
          '<button type="button" class="icon-btn" data-action="edit" data-date="' + r.date + '" title="编辑">✏️</button>' +
          '<button type="button" class="icon-btn danger-icon" data-action="delete" data-date="' + r.date + '" title="删除">🗑️</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function renderChart() {
    var canvas = els.chart;
    var ctx = canvas.getContext('2d');
    var asc = sortedAsc();
    chartPoints = [];

    var hasData = asc.length > 0;
    els.chartEmpty.classList.toggle('hidden', hasData);
    if (!hasData) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      els.chartRange.textContent = '';
      return;
    }

    var cssW = canvas.clientWidth || els.chartWrap.clientWidth || 600;
    var cssH = 260;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(cssW * dpr));
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var pad = { l: 52, r: 18, t: 18, b: 34 };
    var plotW = cssW - pad.l - pad.r;
    var plotH = cssH - pad.t - pad.b;

    var vals = asc.map(function (r) { return r.weight; });
    var goal = settings.goal || null;
    var lo = Math.min.apply(null, vals);
    var hi = Math.max.apply(null, vals);
    if (goal !== null) {
      lo = Math.min(lo, goal);
      hi = Math.max(hi, goal);
    }
    lo = Math.floor(lo - 1);
    hi = Math.ceil(hi + 1);
    if (hi - lo < 2) { hi = lo + 2; }

    function xAt(i) {
      return asc.length === 1 ? pad.l + plotW / 2 : pad.l + (i / (asc.length - 1)) * plotW;
    }

    function yAt(v) {
      return pad.t + (hi - v) / (hi - lo) * plotH;
    }

    var themeDark = document.body.classList.contains('dark');
    var gridColor = themeDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.10)';
    var textColor = themeDark ? '#94a3b8' : '#6b7280';
    var accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#0d9488';

    ctx.font = '11px system-ui, "Microsoft YaHei", sans-serif';

    // 横向网格与纵轴刻度
    var steps = 4;
    for (var k = 0; k <= steps; k++) {
      var v = lo + (hi - lo) * k / steps;
      var y = yAt(v);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + plotW, y);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtWeight(v), pad.l - 8, y);
    }

    // 横轴日期
    var maxLabels = 8;
    var step = Math.max(1, Math.ceil(asc.length / maxLabels));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var i = 0; i < asc.length; i += step) {
      ctx.fillText(asc[i].date.slice(5).replace('-', '/'), xAt(i), pad.t + plotH + 8);
    }
    var lastIdx = asc.length - 1;
    if (lastIdx % step !== 0) {
      ctx.fillText(asc[lastIdx].date.slice(5).replace('-', '/'), xAt(lastIdx), pad.t + plotH + 8);
    }

    // 目标虚线
    if (goal !== null) {
      var gy = yAt(goal);
      ctx.strokeStyle = themeDark ? '#fbbf24' : '#d97706';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.l, gy);
      ctx.lineTo(pad.l + plotW, gy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = themeDark ? '#fbbf24' : '#d97706';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('目标 ' + fmtWeight(goal), pad.l + 6, gy - 4);
    }

    // 折线与面积
    ctx.beginPath();
    asc.forEach(function (r, idx) {
      var x = xAt(idx);
      var yy = yAt(r.weight);
      if (idx === 0) { ctx.moveTo(x, yy); } else { ctx.lineTo(x, yy); }
    });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.lineTo(xAt(lastIdx), pad.t + plotH);
    ctx.lineTo(xAt(0), pad.t + plotH);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
    grad.addColorStop(0, themeDark ? 'rgba(45, 212, 191, 0.24)' : 'rgba(13, 148, 136, 0.17)');
    grad.addColorStop(1, 'rgba(13, 148, 136, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 数据点
    asc.forEach(function (r, idx) {
      var x = xAt(idx);
      var yy = yAt(r.weight);
      var isLast = idx === lastIdx;
      ctx.beginPath();
      ctx.arc(x, yy, isLast ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = themeDark ? '#0f172a' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isLast) {
        ctx.beginPath();
        ctx.arc(x, yy, 9, 0, Math.PI * 2);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      chartPoints.push({ x: x, y: yy, date: r.date, weight: r.weight });
    });

    els.chartRange.textContent = asc[0].date.slice(5).replace('-', '/') + ' 至 ' + asc[lastIdx].date.slice(5).replace('-', '/');
  }

  function bindChartTooltip() {
    els.chart.addEventListener('mousemove', function (e) {
      if (!chartPoints.length) { return; }
      var rect = els.chart.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var best = null;
      var bestDist = 26;
      chartPoints.forEach(function (p) {
        var d = Math.hypot(p.x - mx, p.y - my);
        if (d < bestDist) { bestDist = d; best = p; }
      });
      if (best) {
        els.tooltip.classList.remove('hidden');
        els.tooltip.style.left = (best.x + 10) + 'px';
        els.tooltip.style.top = (best.y - 8) + 'px';
        els.tooltip.innerHTML = '<strong>' + esc(fmtDateCN(best.date)) + '</strong><br>' + fmtWeight(best.weight) + ' kg';
        els.chart.style.cursor = 'crosshair';
      } else {
        els.tooltip.classList.add('hidden');
        els.chart.style.cursor = 'default';
      }
    });

    els.chart.addEventListener('mouseleave', function () {
      els.tooltip.classList.add('hidden');
      els.chart.style.cursor = 'default';
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    var date = els.dateInput.value;
    var weight = parseFloat(els.weightInput.value);
    var note = els.noteInput.value.trim();

    if (!date) { showToast('请选择日期'); return; }
    if (!isFinite(weight) || weight < 20 || weight > 300) {
      showToast('请输入 20–300 之间的体重（kg）');
      return;
    }

    weight = Math.round(weight * 10) / 10;

    if (editingDate) {
      var idx = records.findIndex(function (r) { return r.date === editingDate; });
      if (idx >= 0) {
        if (date === editingDate) {
          records[idx].weight = weight;
          records[idx].note = note;
        } else {
          records.splice(idx, 1);
          records.push({ date: date, weight: weight, note: note });
        }
      }
      editingDate = null;
      showToast('已保存修改');
    } else {
      var existing = records.find(function (r) { return r.date === date; });
      if (existing) {
        existing.weight = weight;
        existing.note = note;
        showToast('已更新 ' + date + ' 的记录');
      } else {
        records.push({ date: date, weight: weight, note: note });
        showToast('已添加记录');
      }
    }

    save(REC_KEY, records);
    resetForm();
    renderAll();
  }

  function startEdit(date) {
    var r = records.find(function (x) { return x.date === date; });
    if (!r) { return; }
    editingDate = date;
    els.dateInput.value = date;
    els.weightInput.value = r.weight;
    els.noteInput.value = r.note || '';
    els.submitBtn.textContent = '保存修改';
    els.cancelEditBtn.classList.remove('hidden');
    els.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    els.weightInput.focus();
  }

  function cancelEdit() {
    editingDate = null;
    resetForm();
    showToast('已取消编辑');
  }

  function resetForm() {
    els.form.reset();
    els.dateInput.value = todayStr();
    els.submitBtn.textContent = '添加记录';
    els.cancelEditBtn.classList.add('hidden');
  }

  function deleteRecord(date) {
    var r = records.find(function (x) { return x.date === date; });
    if (!r) { return; }
    var ok = confirm('确定删除 ' + fmtDateCN(date) + ' 的记录（' + fmtWeight(r.weight) + ' kg）吗？');
    if (!ok) { return; }
    records = records.filter(function (x) { return x.date !== date; });
    save(REC_KEY, records);
    if (editingDate === date) { cancelEdit(); }
    renderAll();
    showToast('已删除记录');
  }

  function handleTableClick(e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) { return; }
    var date = btn.getAttribute('data-date');
    var action = btn.getAttribute('data-action');
    if (action === 'edit') { startEdit(date); }
    if (action === 'delete') { deleteRecord(date); }
  }

  function saveGoal() {
    var raw = els.goalInput.value.trim();
    if (raw === '') {
      settings.goal = null;
      save(SET_KEY, settings);
      renderChart();
      renderStats();
      showToast('已清除目标');
      return;
    }
    var v = parseFloat(raw);
    if (!isFinite(v) || v < 20 || v > 300) {
      showToast('请输入 20–300 之间的目标体重');
      return;
    }
    settings.goal = Math.round(v * 10) / 10;
    save(SET_KEY, settings);
    renderChart();
    renderStats();
    showToast('目标已设为 ' + fmtWeight(settings.goal) + ' kg');
  }

  function applyTheme() {
    var dark = settings.theme === 'dark';
    document.body.classList.toggle('dark', dark);
    els.themeToggle.textContent = dark ? '☀️' : '🌙';
    renderChart();
  }

  function toggleTheme() {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    save(SET_KEY, settings);
    applyTheme();
  }

  function exportData() {
    var payload = {
      exportedAt: new Date().toISOString(),
      goal: settings.goal || null,
      records: records
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '体重记录备份_' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    showToast('已导出备份文件');
  }

  function handleImport(e) {
    var file = els.importFile.files[0];
    if (!file) { return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var list = Array.isArray(data) ? data : (data && Array.isArray(data.records) ? data.records : null);
        if (!list) { throw new Error('bad format'); }
        var cleaned = normalizeRecords(list);
        if (!cleaned.length) {
          showToast('备份文件中没有有效记录');
          return;
        }
        var msg = '将用备份替换当前 ' + records.length + ' 条记录，导入 ' + cleaned.length + ' 条。继续吗？';
        if (!confirm(msg)) { return; }
        records = cleaned;
        if (data && data.goal != null && isFinite(Number(data.goal))) {
          settings.goal = Math.round(Number(data.goal) * 10) / 10;
          els.goalInput.value = settings.goal;
        }
        save(REC_KEY, records);
        save(SET_KEY, settings);
        renderAll();
        showToast('导入成功');
      } catch (err) {
        showToast('导入失败：不是有效的备份文件');
      } finally {
        els.importFile.value = '';
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    var ok = confirm('确定清空所有体重记录吗？此操作不可撤销，建议先导出备份。');
    if (!ok) { return; }
    records = [];
    save(REC_KEY, records);
    if (editingDate) { cancelEdit(); }
    renderAll();
    showToast('已清空所有记录');
  }

  // ---------- 云端同步（GitHub Gist） ----------

  function normalizeRecords(list) {
    var cleaned = [];
    var seen = {};
    list.forEach(function (item) {
      var date = item && typeof item.date === 'string' ? item.date : null;
      var weight = item ? Number(item.weight) : NaN;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && isFinite(weight) && weight >= 20 && weight <= 300 && !seen[date]) {
        seen[date] = true;
        cleaned.push({
          date: date,
          weight: Math.round(weight * 10) / 10,
          note: item.note && typeof item.note === 'string' ? item.note.slice(0, 50) : ''
        });
      }
    });
    return cleaned;
  }

  function loadSyncUi() {
    var s = settings.sync || {};
    syncState.token = s.token || '';
    syncState.gistId = s.gistId || '';
    syncState.user = s.user || '';
    els.syncAutoMerge.checked = !!s.autoMerge;
    renderSyncStatus();
  }

  function renderSyncStatus() {
    if (!syncState.token) {
      els.syncStatus.textContent = '未连接';
      els.syncStatus.className = 'sync-status';
      return;
    }
    if (!syncState.gistId) {
      els.syncStatus.textContent = '已保存令牌，云端存储尚未初始化（点“保存并连接”即可）';
      els.syncStatus.className = 'sync-status';
      return;
    }
    var last = settings.sync && settings.sync.lastSync;
    var text = '已连接：' + (syncState.user || 'GitHub') + '，云端存储已就绪';
    if (syncState.gistId) {
      text += '（编号 ' + syncState.gistId + '）';
    }
    if (last) {
      text += '，上次同步 ' + new Date(last).toLocaleString('zh-CN');
    }
    els.syncStatus.textContent = text;
    els.syncStatus.className = 'sync-status ok';
  }

  function syncErr(e) {
    els.syncStatus.textContent = '连接失败：' + e.message;
    els.syncStatus.className = 'sync-status err';
  }

  function ghApi(path, options) {
    var opts = options || {};
    opts.headers = Object.assign({
      'Authorization': 'Bearer ' + syncState.token,
      'Accept': 'application/vnd.github+json'
    }, opts.headers || {});
    return fetch('https://api.github.com' + path, opts).then(function (res) {
      if (!res.ok) {
        var msg = 'HTTP ' + res.status;
        return res.json().then(function (j) {
          if (j && j.message) { msg = j.message; }
          throw new Error(msg);
        }, function () {
          throw new Error(msg);
        });
      }
      return res.json();
    });
  }

  function buildPayload() {
    return {
      exportedAt: new Date().toISOString(),
      goal: settings.goal || null,
      records: records
    };
  }

  function parseGistFile(g) {
    var f = g && g.files && g.files['weight-tracker.json'];
    if (!f || !f.content) { return null; }
    try {
      return JSON.parse(f.content);
    } catch (e) {
      return null;
    }
  }

  function findWeightGist() {
    return ghApi('/gists?per_page=100').then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].files && list[i].files['weight-tracker.json']) {
          return list[i];
        }
      }
      return null;
    });
  }

  function syncSaveSettings(lastSyncKeep) {
    settings.sync = {
      token: syncState.token,
      gistId: syncState.gistId,
      user: syncState.user,
      autoMerge: els.syncAutoMerge.checked,
      lastSync: lastSyncKeep || null
    };
    save(SET_KEY, settings);
  }

  function syncConnect() {
    var raw = els.syncToken.value.trim();
    if (raw) { syncState.token = raw; }
    if (!syncState.token) {
      showToast('请先输入 GitHub 令牌');
      return;
    }
    els.syncStatus.textContent = '正在连接 GitHub…';
    els.syncStatus.className = 'sync-status';
    ghApi('/user').then(function (user) {
      syncState.user = user.login;
      return findWeightGist().then(function (found) {
        if (found) {
          syncState.gistId = found.id;
          syncSaveSettings(settings.sync ? settings.sync.lastSync : null);
          els.syncToken.value = '';
          renderSyncStatus();
          showToast('云端连接成功（已找到你的体重数据）');
        } else if (syncState.gistId) {
          syncSaveSettings(settings.sync ? settings.sync.lastSync : null);
          els.syncToken.value = '';
          renderSyncStatus();
          showToast('云端连接成功');
        } else {
          els.syncStatus.textContent = '正在创建云端存储…';
          return ghApi('/gists', {
            method: 'POST',
            body: JSON.stringify({
              description: '每日体重记录 - 云端数据',
              public: false,
              files: {
                'weight-tracker.json': {
                  content: JSON.stringify(buildPayload(), null, 2)
                }
              }
            })
          }).then(function (g) {
            syncState.gistId = g.id;
            syncSaveSettings(null);
            els.syncToken.value = '';
            renderSyncStatus();
            showToast('云端连接成功，已自动上传当前数据');
          });
        }
      });
    }).catch(function (e) {
      syncErr(e);
      showToast('连接失败，请检查令牌');
    });
  }

  function syncUpload() {
    if (!syncState.token || !syncState.gistId) {
      showToast('请先“保存并连接”');
      return;
    }
    if (!records.length) {
      showToast('还没有可上传的记录');
      return;
    }
    if (!confirm('将把本地 ' + records.length + ' 条记录上传到云端并覆盖云端数据，继续吗？')) { return; }
    ghApi('/gists/' + syncState.gistId, {
      method: 'PATCH',
      body: JSON.stringify({
        files: {
          'weight-tracker.json': {
            content: JSON.stringify(buildPayload(), null, 2)
          }
        }
      })
    }).then(function () {
      syncSaveSettings(new Date().toISOString());
      renderSyncStatus();
      showToast('已上传到云端');
    }).catch(function (e) {
      syncErr(e);
      showToast('上传失败');
    });
  }

  function syncDownload() {
    if (!syncState.token || !syncState.gistId) {
      showToast('请先“保存并连接”');
      return;
    }
    els.syncStatus.textContent = '正在从云端下载…';
    els.syncStatus.className = 'sync-status';
    var fetchData = function (gistId) {
      return ghApi('/gists/' + gistId).then(function (g) {
        var data = parseGistFile(g);
        if (data && Array.isArray(data.records) && data.records.length) { return data; }
        return findWeightGist().then(function (found) {
          if (found && found.id !== gistId) {
            syncState.gistId = found.id;
            return ghApi('/gists/' + found.id).then(function (g2) {
              var d2 = parseGistFile(g2);
              if (d2 && Array.isArray(d2.records) && d2.records.length) { return d2; }
              throw new Error('云端没有有效记录');
            });
          }
          throw new Error('云端没有有效记录');
        });
      });
    };
    fetchData(syncState.gistId).then(function (data) {
      var cloud = normalizeRecords(data.records);
      if (!cloud.length) { throw new Error('云端没有有效记录'); }
      if (!confirm('将用云端的 ' + cloud.length + ' 条记录覆盖本地 ' + records.length + ' 条，继续吗？')) { return; }
      records = cloud;
      if (data.goal != null && isFinite(Number(data.goal))) {
        settings.goal = Math.round(Number(data.goal) * 10) / 10;
        els.goalInput.value = settings.goal;
      }
      save(REC_KEY, records);
      syncSaveSettings(new Date().toISOString());
      renderAll();
      renderSyncStatus();
      showToast('已从云端同步');
    }).catch(function (e) {
      syncErr(e);
      showToast('下载失败');
    });
  }

  function syncDisconnect() {
    if (!syncState.token && !settings.sync) {
      showToast('本来就没有连接');
      return;
    }
    syncState = { token: '', gistId: '', user: '' };
    settings.sync = { autoMerge: false };
    save(SET_KEY, settings);
    els.syncToken.value = '';
    els.syncAutoMerge.checked = false;
    renderSyncStatus();
    showToast('已清除令牌并断开连接');
  }

  function syncAutoMergeOnce() {
    var s = settings.sync || {};
    if (!s.autoMerge || !syncState.token || !syncState.gistId) { return; }
    ghApi('/gists/' + syncState.gistId).then(function (g) {
      var data = parseGistFile(g);
      if (!data || !Array.isArray(data.records) || !data.records.length) {
        return findWeightGist().then(function (found) {
          if (found && found.id !== syncState.gistId) {
            syncState.gistId = found.id;
            return ghApi('/gists/' + found.id).then(function (g2) {
              return parseGistFile(g2);
            });
          }
          return null;
        });
      }
      return data;
    }).then(function (data) {
      if (!data) { return; }
      var cloud = normalizeRecords(Array.isArray(data.records) ? data.records : []);
      if (!cloud.length) { return; }
      var map = {};
      var changed = false;
      records.forEach(function (r) { map[r.date] = r; });
      cloud.forEach(function (r) {
        if (!map[r.date]) { map[r.date] = r; changed = true; }
      });
      records = Object.keys(map).map(function (k) { return map[k]; })
        .sort(function (a, b) { return a.date.localeCompare(b.date); });
      if (settings.goal == null && data.goal != null && isFinite(Number(data.goal))) {
        settings.goal = Math.round(Number(data.goal) * 10) / 10;
        els.goalInput.value = settings.goal;
        changed = true;
      }
      if (changed) {
        save(REC_KEY, records);
        save(SET_KEY, settings);
        renderAll();
        showToast('已自动合并云端数据');
      }
    }).catch(function () { /* 静默失败，不打扰用户 */ });
  }

  // 初始化
  els.dateInput.value = todayStr();
  els.goalInput.value = settings.goal != null ? settings.goal : '';

  els.form.addEventListener('submit', handleSubmit);
  els.cancelEditBtn.addEventListener('click', cancelEdit);
  els.themeToggle.addEventListener('click', toggleTheme);
  els.goalSaveBtn.addEventListener('click', saveGoal);
  els.recordTable.addEventListener('click', handleTableClick);
  els.exportBtn.addEventListener('click', exportData);
  els.importFile.addEventListener('change', handleImport);
  els.clearBtn.addEventListener('click', clearAll);
  els.syncConnectBtn.addEventListener('click', syncConnect);
  els.syncUploadBtn.addEventListener('click', syncUpload);
  els.syncDownloadBtn.addEventListener('click', syncDownload);
  els.syncDisconnectBtn.addEventListener('click', syncDisconnect);
  els.syncAutoMerge.addEventListener('change', function () {
    settings.sync = settings.sync || {};
    settings.sync.autoMerge = els.syncAutoMerge.checked;
    save(SET_KEY, settings);
  });

  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderChart, 150);
  });

  bindChartTooltip();
  loadSyncUi();
  applyTheme();
  renderAll();
  syncAutoMergeOnce();
})();
