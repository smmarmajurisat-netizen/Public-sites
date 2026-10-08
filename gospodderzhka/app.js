/* Навигатор господдержки АРМА. Без сборщика и внешних библиотек.
   Правила, тексты и вопросы берутся из data/measures.json, регионы из data/regions.json.
   В коде нет условий конкретных направлений: только движок, который читает правила. */
(function () {
  'use strict';

  var D = null, REGIONS = [], answers = {}, stepIdx = 0, lastRoute = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ARROW = 'M 19.708 10.534 L 1.004 0.094 C 0.458 -0.212 -0.212 0.288 0.064 0.794 L 5.631 11 L 0.064 21.206 C -0.212 21.712 0.458 22.212 1.004 21.906 L 19.708 11.466 C 20.097 11.246 20.097 10.754 19.708 10.534 Z';
  var VERIFIED = 'подтверждено источником';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Движок условий (тот же язык, что описан в measures.json) ---------- */
  function ok(c, a) {
    if (!c) return true;
    if (c.all) return c.all.every(function (x) { return ok(x, a); });
    if (c.any) return c.any.some(function (x) { return ok(x, a); });
    if (c.not) return !ok(c.not, a);
    var v = a[c.q];
    if ('eq' in c) return v === c.eq;
    if ('in' in c) return c.in.indexOf(v) >= 0;
    var s = Array.isArray(v) ? v : [];
    if ('has_any' in c) return c.has_any.some(function (x) { return s.indexOf(x) >= 0; });
    if ('has_none' in c) return !c.has_none.some(function (x) { return s.indexOf(x) >= 0; });
    return false;
  }

  /* Элемент списка выводится, если он не помечен для проверки юристом и его условие выполнено */
  function visible(item, a) {
    if (typeof item === 'string') return true;
    if (item.review) return false;
    return ok(item.when, a);
  }
  function textOf(item) { return typeof item === 'string' ? item : item.text; }

  var RANK = { match: 0, msp_all: 1, check: 2 };
  function route(a) {
    var out = { main: [], clients: [] };
    D.measures.forEach(function (m) {
      if (m.verification.status !== VERIFIED) return;
      if (!ok(m.show_if, a)) return;
      var st = null;
      for (var i = 0; i < m.status_rules.length; i++) {
        if (ok(m.status_rules[i].when, a)) { st = m.status_rules[i].status; break; }
      }
      if (!st) return;
      (out[m.block || 'main'] || out.main).push({ m: m, status: st });
    });
    ['main', 'clients'].forEach(function (b) {
      out[b].sort(function (x, y) {
        return (RANK[x.status] - RANK[y.status]) || (x.m.priority - y.m.priority);
      });
    });
    var max = (D.meta.blocks && D.meta.blocks.main && D.meta.blocks.main.max_cards) || D.meta.max_cards || 7;
    out.main = out.main.slice(0, max);
    return out;
  }
  window.GOSP_ROUTE = function (a) {
    var r = route(a);
    return { main: r.main.map(function (x) { return [x.m.id, x.status]; }), clients: r.clients.map(function (x) { return [x.m.id, x.status]; }) };
  };

  /* ---------- Метрика: счётчик 111822182 без Вебвизора, только на боевом домене ---------- */
  var YM = null;
  function initMetrika() {
    var cfg = D.meta.metrika;
    if (!cfg || location.hostname !== 'arma-lab.ru') return;
    YM = cfg.counter_id;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(YM, 'init', { webvisor: false, clickmap: true, trackLinks: true, accurateTrackBounce: true });
  }
  function goal(key) {
    if (YM && window.ym && D.meta.metrika.goals[key]) window.ym(YM, 'reachGoal', D.meta.metrika.goals[key]);
  }

  /* ---------- Высота iframe ---------- */
  var PARENTS = ['https://online.arma-jurist.ru'];
  function setupResize() {
    if (window.parent === window) return;
    var origin = null;
    try {
      origin = (location.ancestorOrigins && location.ancestorOrigins[0]) || (document.referrer ? new URL(document.referrer).origin : null);
    } catch (e) { origin = null; }
    var target = PARENTS.indexOf(origin) >= 0 ? origin : (/\.getcourse\.ru$/.test(origin || '') ? origin : null);
    /* Режим проверки: родитель на локальном сервере тоже получает высоту */
    if (!target && /[?&]test=1/.test(location.search) && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '')) target = origin;
    if (!target) return;
    var last = 0, raf = 0;
    function send() {
      raf = 0;
      var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (h === last) return;
      last = h;
      window.parent.postMessage({ type: 'armaGosp:height', height: h }, target);
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(send); }
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.documentElement);
    window.addEventListener('load', schedule);
    schedule();
  }
  function scrollTopInFrame() {
    if (window.parent !== window) {
      try { window.parent.postMessage({ type: 'armaGosp:scrollTop' }, '*'); } catch (e) {}
    }
    window.scrollTo(0, 0);
  }

  /* ---------- Экраны ---------- */
  function show(id) {
    ['start', 'quiz', 'result'].forEach(function (s) { $('#screen-' + s).hidden = s !== id; });
    scrollTopInFrame();
  }

  function renderProgress() {
    var ol = $('#progress-steps');
    ol.innerHTML = D.steps.map(function (s, i) {
      var attrs = i === stepIdx ? ' aria-current="step"' : (i < stepIdx ? ' class="done"' : '');
      return '<li' + attrs + '>' + (i + 1) + '<span>. ' + esc(s.title) + '</span></li>';
    }).join('');
    $('#progress-count').textContent = 'Шаг ' + (stepIdx + 1) + ' из ' + D.steps.length;
  }

  var qNumber = {};
  function numberQuestions() {
    var n = 0;
    D.steps.forEach(function (s) { s.questions.forEach(function (q) { qNumber[q] = ++n; }); });
  }

  function hintFor(q) {
    var h = q.hint;
    (q.hint_variants || []).forEach(function (v) { if (ok(v.when, answers)) h = v.text; });
    return h;
  }
  /* Подсказка в HTML: текст экранируется, ссылка из hint_link подставляется вместо своего текста */
  function hintHtml(q) {
    var h = esc(hintFor(q)), l = q.hint_link;
    if (l && h.indexOf(esc(l.text)) >= 0) {
      h = h.replace(esc(l.text), '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.text) + '</a>');
    }
    return h;
  }

  function renderQuestion(id) {
    var q = D.questions[id], num = qNumber[id];
    var hid = 'h-' + id;
    if (q.type === 'region') {
      var opts = REGIONS.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); })
        .map(function (r) { return '<option value="' + r.id + '"' + (answers.region === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('');
      return '<div class="q"><label class="q__label" for="f-region"><span class="q__num">' + num + '.</span>' + esc(q.label) + '</label>' +
        '<p class="q__hint" id="' + hid + '">' + hintHtml(q) + '</p>' +
        '<select class="select" id="f-region" name="region" aria-describedby="' + hid + '"><option value="">Выберите регион</option>' + opts + '</select></div>';
    }
    var multi = q.type === 'multi';
    var cur = answers[id];
    var items = q.options.filter(function (o) { return ok(o.when, answers); }).map(function (o) {
      var checked = multi ? (Array.isArray(cur) && cur.indexOf(o.value) >= 0) : cur === o.value;
      return '<label class="opt"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + id + '" value="' + esc(o.value) + '"' + (checked ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>';
    }).join('');
    return '<fieldset class="q" aria-describedby="' + hid + '"><legend><span class="q__num">' + num + '.</span>' + esc(q.label) +
      (multi ? ' <span class="q__multi">можно выбрать несколько</span>' : '') + '</legend>' +
      '<p class="q__hint" id="' + hid + '">' + hintHtml(q) + '</p><div class="opts">' + items + '</div></fieldset>';
  }

  function renderStep() {
    var s = D.steps[stepIdx];
    renderProgress();
    $('#step-title').textContent = s.title;
    $('#step-questions').innerHTML = s.questions.map(renderQuestion).join('');
    $('#btn-back').textContent = stepIdx === 0 ? 'К началу' : 'Назад';
    $('#btn-next').textContent = stepIdx === D.steps.length - 1 ? 'Показать результат' : 'Далее';
    $('#step-error').textContent = '';
  }

  function readStep() {
    var s = D.steps[stepIdx];
    s.questions.forEach(function (id) {
      var q = D.questions[id];
      if (q.type === 'region') { answers.region = $('#f-region').value || null; return; }
      var els = document.querySelectorAll('input[name="' + id + '"]:checked');
      var vals = Array.prototype.map.call(els, function (e) { return e.value; });
      answers[id] = q.type === 'multi' ? vals : (vals[0] || null);
    });
  }

  function missing() {
    return D.steps[stepIdx].questions.filter(function (id) {
      var q = D.questions[id];
      return q.type !== 'multi' && !answers[id];
    });
  }

  /* ---------- Результат ---------- */
  function regionName() {
    var r = REGIONS.filter(function (x) { return x.id === answers.region; })[0];
    return r ? r.name : '';
  }
  function regionLinks() {
    var r = REGIONS.filter(function (x) { return x.id === answers.region; })[0];
    return (r && r.links) || [];
  }

  function bullets(list, cls) {
    var v = (list || []).filter(function (x) { return visible(x, answers); });
    if (!v.length) return '';
    return '<ul>' + v.map(function (x) {
      return '<li class="bul' + (cls ? ' ' + cls : '') + '"><svg viewBox="0 0 20 22" aria-hidden="true"><path d="' + ARROW + '"/></svg><span>' + esc(textOf(x)) + '</span></li>';
    }).join('') + '</ul>';
  }
  function whereList(list) {
    var v = (list || []).filter(function (x) { return visible(x, answers); });
    var extra = [];
    v.forEach(function (x) { if (x.region_links) extra = extra.concat(regionLinks()); });
    return '<ul>' + v.concat(extra).map(function (x) {
      var body = x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.text || x.title) + '</a>' : esc(x.text || x.title);
      return '<li class="bul bul--dot"><span>' + body + '</span></li>';
    }).join('') + '</ul>';
  }

  function card(entry, i) {
    var m = entry.m, id = 'more-' + m.id, label = D.meta.statuses[entry.status];
    var steps = (m.steps || []).filter(function (x) { return visible(x, answers); });
    return '<article class="card" aria-labelledby="t-' + m.id + '">' +
      '<div class="card__head">' +
        '<span class="card__idx">' + (i + 1) + '.</span>' +
        '<button class="icon-btn card__toggle no-print" type="button" aria-expanded="false" aria-controls="' + id + '"><span class="sr-only">Подробнее: ' + esc(m.title) + '</span><svg viewBox="0 0 20 22" aria-hidden="true"><path d="' + ARROW + '"/></svg></button>' +
        '<h3 class="card__title" id="t-' + m.id + '">' + esc(m.title) + '</h3>' +
        '<p class="card__mech">' + esc(m.mechanic) + '</p>' +
      '</div>' +
      (m.block === 'clients' ? '' : '<p style="margin-top:var(--space-4)"><span class="status status--' + entry.status + '">' + esc(label) + '</span></p>') +
      '<div class="sec card__why"><h4>Почему подходит</h4>' + bullets(m.why) + '</div>' +
      '<div class="card__more" id="' + id + '" hidden>' +
        '<div class="sec"><h4>Что дополнительно проверить</h4>' + bullets(m.check) + '</div>' +
        '<div class="sec"><h4>Куда обращаться</h4>' + whereList(m.where) + '</div>' +
        '<div class="sec"><h4>Какие документы обычно нужны</h4>' + bullets(m.documents, 'bul--doc') + '</div>' +
        '<div class="sec"><h4>Что делать по шагам</h4><ol>' + steps.map(function (s) { return '<li>' + esc(textOf(s)) + '</li>'; }).join('') + '</ol></div>' +
      '</div>' +
      '<div class="card__foot"><a href="' + esc(m.source.url) + '" target="_blank" rel="noopener">' + esc(m.source.title) + '</a>' +
        '<span class="basis">Основание: ' + esc(m.basis) + '</span></div>' +
    '</article>';
  }

  function renderResult() {
    var r = lastRoute = route(answers);
    var blocks = D.meta.blocks || {};
    $('#res-region').textContent = regionName() ? 'Регион: ' + regionName() + '.' : '';
    $('#res-main-title').textContent = (blocks.main && blocks.main.title) || 'Направления';
    $('#res-main').innerHTML = r.main.length ? r.main.map(card).join('') :
      '<p class="card" style="padding-bottom:var(--calc-pad)">По вашим ответам основных направлений не нашлось. Посмотрите блоки ниже или напишите нам, разберём вашу ситуацию.</p>';
    var cw = $('#res-clients-wrap');
    cw.hidden = !r.clients.length;
    if (r.clients.length) {
      $('#res-clients-title').textContent = blocks.clients.title;
      $('#res-clients-hint').textContent = blocks.clients.hint || '';
      $('#res-clients').innerHTML = r.clients.map(card).join('');
    }
    var ex = D.extra, ew = $('#res-extra-wrap');
    ew.hidden = !ok(ex.show_if, answers);
    if (!ew.hidden) {
      $('#res-extra-title').textContent = ex.title;
      $('#res-extra').innerHTML = ex.items.map(function (it) {
        var links = it.region_links ? regionLinks() : [];
        var href = links.length ? links[0].url : it.url;
        return '<a href="' + esc(href) + '" target="_blank" rel="noopener"><b>' + esc(it.title) + '</b><span>' + esc(it.text) + '</span></a>';
      }).join('');
    }
    $('#res-date').textContent = 'Данные актуальны на ' + D.meta.updated_on + '.';
    $('#res-disclaimer').textContent = D.meta.disclaimer;
    show('result');
    goal('result');
  }

  /* ---------- Форма «Нужна помощь» ---------- */
  var lastSent = 0;
  function payload(form) {
    var fd = new FormData(form), o = {};
    ['name', 'phone', 'email', 'messenger', 'comment'].forEach(function (k) { o[k] = (fd.get(k) || '').toString().trim(); });
    o.region = regionName();
    o.answers = answers;
    /* Профиль словами: вопрос и выбранные ответы, чтобы менеджер читал текст, а не коды */
    o.profile = [];
    D.steps.forEach(function (st) {
      st.questions.forEach(function (id) {
        var q = D.questions[id], v = answers[id], txt;
        if (q.type === 'region') txt = regionName();
        else {
          var vals = Array.isArray(v) ? v : (v ? [v] : []);
          txt = vals.map(function (x) {
            var opt = q.options.filter(function (op) { return op.value === x; })[0];
            return opt ? opt.label : x;
          }).join(', ');
        }
        o.profile.push({ question: q.label, answer: txt || 'не указано' });
      });
    });
    o.consent = !!form.consent.checked;
    o.website = (fd.get('website') || '').toString();
    o.directions = (lastRoute ? lastRoute.main.concat(lastRoute.clients) : []).map(function (x) {
      return { id: x.m.id, title: x.m.title, status: D.meta.statuses[x.status] };
    });
    o.source = 'Калькулятор господдержки';
    o.data_version = D.meta.updated_on;
    return o;
  }
  /* Проверка полей: ошибка подсвечивается красным только у поля с ошибкой */
  function setErr(el, text) {
    var box = el.closest('.field'), id = el.id + '-err', old = document.getElementById(id);
    if (old) old.remove();
    if (!text) { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); return; }
    el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', id);
    var p = document.createElement('p'); p.className = 'field__err'; p.id = id; p.textContent = text; box.appendChild(p);
  }
  function validate(f) {
    var first = null;
    var checks = [
      [f.name, !f.name.value.trim() ? 'Укажите имя.' : ''],
      [f.phone, f.phone.value.replace(/\D/g, '').length < 10 ? 'Укажите телефон, не меньше 10 цифр.' : ''],
      [f.email, f.email.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim()) ? 'Проверьте адрес почты.' : '']
    ];
    checks.forEach(function (c) { setErr(c[0], c[1]); if (c[1] && !first) first = { el: c[0], text: 'Проверьте поля формы.' }; });
    var opt = f.consent.closest('.opt');
    if (!f.consent.checked) {
      opt.setAttribute('data-invalid', 'true');
      if (!first) first = { el: f.consent, text: 'Отметьте согласие на обработку персональных данных.' };
    } else opt.removeAttribute('data-invalid');
    return first;
  }
  /* Сообщение с контактами АРМА: телефон звонит, почта открывает письмо */
  function showFallback(msg, prefix) {
    var c = D.meta.contacts || {};
    var html = (prefix ? esc(prefix) + ' ' : '') + esc(c.text || '');
    if (c.phone) html += ' Телефон: <a href="' + esc(c.phone_href || ('tel:' + c.phone.replace(/[^+\d]/g, ''))) + '">' + esc(c.phone) + '</a>.';
    if (c.email) html += ' Почта: <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>.';
    msg.innerHTML = html;
  }
  function onSubmit(e) {
    e.preventDefault();
    var f = e.target, msg = $('#form-msg');
    if (f.website.value) return;                       /* поле-ловушка */
    msg.removeAttribute('data-error');
    var bad = validate(f);
    if (bad) { msg.textContent = bad.text; msg.setAttribute('data-error', 'true'); bad.el.focus(); return; }
    if (Date.now() - lastSent < 60000) { msg.textContent = 'Заявка уже отправлена. Повторно отправить можно через минуту.'; return; }
    var url = D.meta.webhook_url;
    var btn = f.querySelector('button[type=submit]');
    if (!url) { showFallback(msg, ''); return; }
    btn.disabled = true; msg.textContent = 'Отправляем…';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(f)) })
      .then(function (r) {
        if (r.status === 429) { var e = new Error('429'); e.rate = true; throw e; }
        if (!r.ok) throw new Error(r.status);
        return r;
      })
      .then(function () {
        lastSent = Date.now();
        msg.textContent = 'Спасибо, заявка отправлена. Мы свяжемся с вами в рабочее время.';
        f.reset(); goal('lead');
      })
      .catch(function (e) {
        msg.setAttribute('data-error', 'true');
        showFallback(msg, e && e.rate ? 'Заявка с этого устройства уже отправлена. Повторить можно через минуту.' : 'Не удалось отправить заявку.');
      })
      .then(function () { btn.disabled = false; });
  }

  /* ---------- Запуск ---------- */
  function bind() {
    $('#btn-start').addEventListener('click', function () { stepIdx = 0; renderStep(); show('quiz'); goal('start'); });
    $('#btn-back').addEventListener('click', function () {
      readStep();
      if (stepIdx === 0) { show('start'); return; }
      stepIdx--; renderStep(); scrollTopInFrame();
    });
    $('#btn-next').addEventListener('click', function () {
      readStep();
      var miss = missing();
      if (miss.length) {
        $('#step-error').textContent = 'Ответьте на вопрос ' + miss.map(function (id) { return qNumber[id]; }).join(', ') + '. Если не уверены, выберите «Не знаю».';
        var el = document.querySelector('[name="' + miss[0] + '"]'); if (el) el.focus();
        return;
      }
      if (stepIdx < D.steps.length - 1) { stepIdx++; renderStep(); scrollTopInFrame(); }
      else renderResult();
    });
    $('#step-questions').addEventListener('change', function (e) {
      if (e.target.name === 'org_form') {             /* подсказки и варианты зависят от формы */
        var v = e.target.value;
        readStep(); var y = window.scrollY; renderStep(); window.scrollTo(0, y);
        var back = document.querySelector('input[name="org_form"][value="' + v + '"]');
        if (back) back.focus();                         /* фокус клавиатуры остаётся на выбранном варианте */
      }
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.card__toggle');
      if (!t) return;
      var open = t.getAttribute('aria-expanded') !== 'true';
      t.setAttribute('aria-expanded', String(open));
      document.getElementById(t.getAttribute('aria-controls')).hidden = !open;
    });
    $('#btn-help').addEventListener('click', function () {
      var f = $('#help'); f.hidden = false; f.querySelector('input[name=name]').focus();
    });
    $('#btn-print').addEventListener('click', function () { window.print(); });
    $('#btn-restart').addEventListener('click', function () { answers = {}; stepIdx = 0; show('start'); });
    $('#help-form').addEventListener('submit', onSubmit);
    $('#help-form').addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') setErr(e.target, '');
    });
    $('#help-form').addEventListener('change', function (e) {
      if (e.target.name === 'consent' && e.target.checked) e.target.closest('.opt').removeAttribute('data-invalid');
    });
  }

  function boot() {
    Promise.all([
      fetch('data/measures.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
      fetch('data/regions.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      D = res[0]; REGIONS = res[1].regions;
      numberQuestions(); bind(); initMetrika(); setupResize();
      $('#app').removeAttribute('aria-busy');
      /* Режим проверки: ?test=1 открывает доступ к ответам для автотестов и скриншотов */
      if (/[?&]test=1/.test(location.search)) {
        window.GOSP_TEST = {
          set: function (a) { answers = a; },
          step: function (i) { stepIdx = i; renderStep(); show('quiz'); },
          result: function () { renderResult(); },
          expandAll: function () { document.querySelectorAll('.card__toggle').forEach(function (b) { if (b.getAttribute('aria-expanded') !== 'true') b.click(); }); }
        };
      }
    }).catch(function () {
      $('#app').innerHTML = '<div class="wrap" style="padding:var(--space-6) var(--calc-gutter)"><p>Не удалось загрузить калькулятор. Обновите страницу.</p></div>';
    });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
