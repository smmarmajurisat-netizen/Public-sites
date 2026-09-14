/* Каталог типовых программ — клиентская часть.
   Всё содержание доступно без JavaScript: скрипт только фильтрует уже
   отрендеренный список, подсказывает в поиске и переводит форму в инлайн-состояние. */
(function () {
  'use strict';

  var norm = function (value) {
    return (value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  };

  /* --- фильтр на странице направления (ТЗ 8, состояния 4.3) --------------- */

  function initFilter(root) {
    var rows = Array.prototype.slice.call(root.querySelectorAll('[data-program]'));
    var chips = Array.prototype.slice.call(root.querySelectorAll('[data-kind]'));
    var search = root.querySelector('[data-filter-search]');
    var groups = Array.prototype.slice.call(root.querySelectorAll('[data-group]'));
    var empty = root.querySelector('[data-empty-state]');
    var emptyList = root.querySelector('[data-empty-list]');
    var emptyText = root.querySelector('[data-empty-text]');
    var reset = root.querySelector('[data-filter-reset]');
    var total = rows.length;
    var state = { kind: '', query: '' };

    function matchesQuery(row, query) {
      return !query || row.getAttribute('data-search').indexOf(query) !== -1;
    }

    function syncUrl() {
      var params = new URLSearchParams(window.location.search);
      state.kind ? params.set('vid', state.kind) : params.delete('vid');
      state.query ? params.set('q', state.query) : params.delete('q');
      var qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
    }

    function render() {
      var query = norm(state.query);
      var shown = 0;
      var otherKinds = [];

      rows.forEach(function (row) {
        var kindOk = !state.kind || row.getAttribute('data-kind-code') === state.kind;
        var queryOk = matchesQuery(row, query);
        var visible = kindOk && queryOk;
        row.hidden = !visible;
        if (visible) { shown += 1; }
        else if (queryOk && state.kind) { otherKinds.push(row); }
      });

      groups.forEach(function (group) {
        var visibleRows = group.querySelectorAll('[data-program]:not([hidden])');
        group.hidden = visibleRows.length === 0;
        var counter = group.querySelector('[data-group-count]');
        if (counter) { counter.textContent = visibleRows.length; }
      });

      /* Чип с нулём остаётся на месте и гаснет — не исчезает. */
      chips.forEach(function (chip) {
        var code = chip.getAttribute('data-kind');
        var count = rows.filter(function (row) {
          return (!code || row.getAttribute('data-kind-code') === code) && matchesQuery(row, query);
        }).length;
        var counter = chip.querySelector('[data-chip-count]');
        if (counter) { counter.textContent = count; }
        chip.setAttribute('data-empty', String(count === 0 && Boolean(code)));
        chip.setAttribute('aria-pressed', String(code === state.kind));
      });

      if (empty) {
        empty.hidden = shown !== 0;
        if (shown === 0) { renderEmpty(otherKinds); }
      }
    }

    /* Пустой результат — подсказка, в каком виде программа есть (ТЗ 4.3). */
    function renderEmpty(candidates) {
      var kindChip = chips.filter(function (chip) { return chip.getAttribute('data-kind') === state.kind; })[0];
      var kindName = kindChip ? kindChip.getAttribute('data-kind-label') : '';
      if (emptyText) {
        emptyText.textContent = candidates.length
          ? 'В виде «' + kindName + '» таких программ не утверждено. ' +
            (candidates.length === 1 ? 'Одно совпадение есть' : candidates.length + ' совпадения есть') +
            ' в других видах — снимите фильтр или откройте их сразу.'
          : 'По запросу «' + state.query + '» программ в направлении нет. Проверьте формулировку или сбросьте фильтр.';
      }
      if (!emptyList) { return; }
      emptyList.innerHTML = '';
      candidates.slice(0, 6).forEach(function (row) {
        var item = document.createElement(row.getAttribute('data-url') ? 'a' : 'div');
        item.className = 'empty-state__item';
        if (row.getAttribute('data-url')) { item.href = row.getAttribute('data-url'); }
        var main = document.createElement('span');
        var title = document.createElement('span');
        title.textContent = row.getAttribute('data-title');
        main.appendChild(title);
        var distinction = row.getAttribute('data-distinction');
        if (distinction) {
          var note = document.createElement('span');
          note.className = 'distinction';
          note.textContent = 'отличие: ' + distinction;
          main.appendChild(note);
        }
        var kind = document.createElement('span');
        kind.className = 'empty-state__kind';
        kind.textContent = row.getAttribute('data-kind-label');
        item.appendChild(main);
        item.appendChild(kind);
        emptyList.appendChild(item);
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var code = chip.getAttribute('data-kind');
        state.kind = state.kind === code ? '' : code;
        syncUrl();
        render();
      });
    });

    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value;
        syncUrl();
        render();
      });
    }

    if (reset) {
      reset.addEventListener('click', function () {
        state.kind = '';
        state.query = '';
        if (search) { search.value = ''; }
        syncUrl();
        render();
      });
    }

    var initial = new URLSearchParams(window.location.search);
    state.kind = initial.get('vid') || '';
    state.query = initial.get('q') || '';
    if (search && state.query) { search.value = state.query; }
    var totalCounter = root.querySelector('[data-total-count]');
    if (totalCounter) { totalCounter.textContent = total; }
    render();
  }

  /* --- поиск на главной каталога ----------------------------------------- */

  function initSearch(root) {
    var input = root.querySelector('[data-search-input]');
    var results = root.querySelector('[data-search-results]');
    var caption = root.querySelector('[data-search-caption]');
    var list = root.querySelector('[data-search-list]');
    var more = root.querySelector('[data-search-more]');
    var indexUrl = root.getAttribute('data-index-url');
    var basePath = root.getAttribute('data-base-path');
    var index = null;
    var loading = false;
    var expanded = false;
    var LIMIT = 6;

    function load() {
      if (index || loading) { return; }
      loading = true;
      fetch(indexUrl, { credentials: 'same-origin' })
        .then(function (response) { return response.json(); })
        .then(function (data) { index = data; loading = false; render(); })
        .catch(function () { loading = false; });
    }

    function plural(n) {
      var t100 = n % 100, t10 = n % 10;
      if (t100 >= 11 && t100 <= 14) { return 'программ'; }
      if (t10 === 1) { return 'программа'; }
      if (t10 >= 2 && t10 <= 4) { return 'программы'; }
      return 'программ';
    }

    function render() {
      var query = norm(input.value);
      if (query.length < 3 || !index) {
        results.hidden = true;
        return;
      }
      /* Совпадение в названии показываем раньше совпадения по синонимам
         направления: иначе запрос «монтаж» поднимает всё направление. */
      var hits = index
        .filter(function (item) { return item.n.indexOf(query) !== -1; })
        .map(function (item) {
          var inTitle = item.t.indexOf(query);
          return { item: item, rank: inTitle === -1 ? 2 : (inTitle === 0 ? 0 : 1), at: inTitle };
        })
        .sort(function (a, b) { return a.rank - b.rank || a.at - b.at; })
        .map(function (entry) { return entry.item; });
      results.hidden = false;
      caption.textContent = hits.length
        ? 'Найдено ' + hits.length + ' ' + plural(hits.length)
        : 'Ничего не найдено';
      list.innerHTML = '';
      hits.slice(0, expanded ? hits.length : LIMIT).forEach(function (item) {
        var node = document.createElement(item.linked ? 'a' : 'div');
        node.className = 'catalog-search__item';
        if (item.linked) { node.href = basePath + item.slug + '/'; }
        var left = document.createElement('span');
        var title = document.createElement('span');
        title.className = 'catalog-search__title';
        title.textContent = item.title;
        left.appendChild(title);
        if (item.distinction) {
          var note = document.createElement('span');
          note.className = 'distinction';
          note.textContent = 'отличие: ' + item.distinction;
          left.appendChild(note);
        }
        var badge = document.createElement('span');
        badge.className = 'badge-kind';
        badge.textContent = item.direction_name;
        node.appendChild(left);
        node.appendChild(badge);
        list.appendChild(node);
      });
      more.hidden = expanded || hits.length <= LIMIT;
      more.textContent = 'Показать все результаты по запросу «' + input.value.trim() + '»';
    }

    input.addEventListener('focus', load, { once: true });
    input.addEventListener('input', function () { expanded = false; load(); render(); });
    more.addEventListener('click', function (event) { event.preventDefault(); expanded = true; render(); });
    document.addEventListener('click', function (event) {
      if (!root.contains(event.target)) { results.hidden = true; }
    });
  }

  /* --- форма заявки ------------------------------------------------------- */

  function initForm(form) {
    var started = Date.now();
    var elapsed = form.querySelector('[name="form_elapsed"]');
    var status = form.querySelector('[data-form-status]');
    // Идентификатор отправки: если запрос через fetch дошёл до n8n, а ответ
    // заблокировал браузер, форма уйдёт повторно обычным POST — n8n по этому
    // полю не создаст второй лид.
    var submission = form.querySelector('[name="submission_id"]');
    if (submission && !submission.value) {
      submission.value = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function showError(field, message) {
      var holder = field.closest('.form__field') || field.parentNode;
      var node = holder.querySelector('.form__error');
      if (!node) {
        node = document.createElement('span');
        node.className = 'form__error';
        holder.appendChild(node);
      }
      node.textContent = message;
      field.setAttribute('aria-invalid', 'true');
    }

    function clearErrors() {
      Array.prototype.forEach.call(form.querySelectorAll('.form__error'), function (node) {
        node.textContent = '';
      });
      Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (node) {
        node.removeAttribute('aria-invalid');
      });
    }

    form.addEventListener('submit', function (event) {
      if (elapsed) { elapsed.value = String(Math.round((Date.now() - started) / 1000)); }
      clearErrors();
      var invalid = false;
      Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (field) {
        var empty = field.type === 'checkbox' ? !field.checked : !field.value.trim();
        if (empty) {
          showError(field, field.type === 'checkbox'
            ? 'Без согласия на обработку данных заявку отправить нельзя'
            : 'Заполните поле');
          invalid = true;
        }
      });
      if (invalid) {
        event.preventDefault();
        var first = form.querySelector('[aria-invalid]');
        if (first) { first.focus(); }
        return;
      }
      if (!window.fetch) { return; }
      event.preventDefault();
      var data = new FormData(form);
      // Приёмник — вебхук n8n на другом домене. По полю transport он отвечает
      // JSON; обычной отправке без JavaScript — переадресацией на return_to.
      data.append('transport', 'fetch');
      fetch(form.action, { method: 'POST', body: data, mode: 'cors', credentials: 'omit' })
        .then(function (response) {
          if (!response.ok) { throw new Error('bad status'); }
          return response.json().catch(function () { return {}; });
        })
        .then(function (result) {
          if (result && result.ok === false) {
            var note = form.querySelector('.form__error--form');
            if (!note) {
              note = document.createElement('p');
              note.className = 'form__error form__error--form';
              form.appendChild(note);
            }
            note.textContent = 'Не удалось отправить. Проверьте поля и отправьте ещё раз.';
            return;
          }
          form.hidden = true;
          if (status) {
            status.hidden = false;
            status.focus();
          }
        })
        .catch(function () { form.submit(); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var filter = document.querySelector('[data-filter-root]');
    if (filter) { initFilter(filter); }
    var search = document.querySelector('[data-search-root]');
    if (search) { initSearch(search); }
    Array.prototype.forEach.call(document.querySelectorAll('[data-lead-form]'), initForm);
  });
}());
