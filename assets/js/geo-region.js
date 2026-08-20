(function () {
  'use strict';

  // Слоты лендинга. Класс .js-geo-region поддержан на будущее — сейчас
  // разметка помечена атрибутами data-region-slot, менять её незачем.
  var SLOT_PHRASE = '[data-region-slot="1"], .js-geo-region';
  var SLOT_LABEL  = '[data-region-slot="2"], [data-region-slot="3"]';

  var CACHE_KEY  = 'arma_geo_v2';
  var CACHE_TTL  = 7 * 24 * 60 * 60 * 1000;
  // Первый провайдер отвечает быстро; длинное ожидание только задерживает
  // подмену текста и расширяет гонку с монтированием компонента.
  var TIMEOUT_FIRST = 1500;
  var TIMEOUT_NEXT  = 3000;

  // Бандл заменяет корневой элемент через documentElement.replaceWith,
  // поэтому подставляем не один раз, а опрашиваем document ~20 секунд.
  var POLL_MS  = 150;
  var POLL_MAX = 133;

  var FOREIGN = { phrase: 'по всей России', readable: 'Вся Россия', push: false };

  var FORMS = {
    'москва': 'в Москве', 'moscow': 'в Москве',
    'санкт-петербург': 'в Санкт-Петербурге', 'saint petersburg': 'в Санкт-Петербурге',
    'st petersburg': 'в Санкт-Петербурге', 'st. petersburg': 'в Санкт-Петербурге',
    'новосибирск': 'в Новосибирске', 'novosibirsk': 'в Новосибирске',
    'екатеринбург': 'в Екатеринбурге', 'yekaterinburg': 'в Екатеринбурге',
    'ekaterinburg': 'в Екатеринбурге',
    'казань': 'в Казани', 'kazan': 'в Казани',
    'нижний новгород': 'в Нижнем Новгороде', 'nizhny novgorod': 'в Нижнем Новгороде',
    'челябинск': 'в Челябинске', 'chelyabinsk': 'в Челябинске',
    'самара': 'в Самаре', 'samara': 'в Самаре',
    'омск': 'в Омске', 'omsk': 'в Омске',
    'ростов-на-дону': 'в Ростове-на-Дону', 'rostov-on-don': 'в Ростове-на-Дону',
    'уфа': 'в Уфе', 'ufa': 'в Уфе',
    'красноярск': 'в Красноярске', 'krasnoyarsk': 'в Красноярске',
    'воронеж': 'в Воронеже', 'voronezh': 'в Воронеже',
    'пермь': 'в Перми', 'perm': 'в Перми',
    'волгоград': 'в Волгограде', 'volgograd': 'в Волгограде',
    'саратов': 'в Саратове', 'saratov': 'в Саратове',
    'тюмень': 'в Тюмени', 'tyumen': 'в Тюмени',
    'тольятти': 'в Тольятти', 'tolyatti': 'в Тольятти',
    'ижевск': 'в Ижевске', 'izhevsk': 'в Ижевске',
    'барнаул': 'в Барнауле', 'barnaul': 'в Барнауле',
    'ульяновск': 'в Ульяновске', 'ulyanovsk': 'в Ульяновске',
    'иркутск': 'в Иркутске', 'irkutsk': 'в Иркутске',
    'хабаровск': 'в Хабаровске', 'khabarovsk': 'в Хабаровске',
    'ярославль': 'в Ярославле', 'yaroslavl': 'в Ярославле',
    'владивосток': 'во Владивостоке', 'vladivostok': 'во Владивостоке',
    'махачкала': 'в Махачкале', 'makhachkala': 'в Махачкале',
    'томск': 'в Томске', 'tomsk': 'в Томске',
    'оренбург': 'в Оренбурге', 'orenburg': 'в Оренбурге',
    'кемерово': 'в Кемерово', 'kemerovo': 'в Кемерово',
    'новокузнецк': 'в Новокузнецке', 'novokuznetsk': 'в Новокузнецке',
    'рязань': 'в Рязани', 'ryazan': 'в Рязани',
    'набережные челны': 'в Набережных Челнах', 'naberezhnye chelny': 'в Набережных Челнах',
    'астрахань': 'в Астрахани', 'astrakhan': 'в Астрахани',
    'пенза': 'в Пензе', 'penza': 'в Пензе',
    'липецк': 'в Липецке', 'lipetsk': 'в Липецке',
    'тула': 'в Туле', 'tula': 'в Туле',
    'киров': 'в Кирове', 'kirov': 'в Кирове',
    'чебоксары': 'в Чебоксарах', 'cheboksary': 'в Чебоксарах',
    'калининград': 'в Калининграде', 'kaliningrad': 'в Калининграде',
    'курск': 'в Курске', 'kursk': 'в Курске',
    'улан-удэ': 'в Улан-Удэ', 'ulan-ude': 'в Улан-Удэ',
    'ставрополь': 'в Ставрополе', 'stavropol': 'в Ставрополе',
    'тверь': 'в Твери', 'tver': 'в Твери',
    'магнитогорск': 'в Магнитогорске', 'magnitogorsk': 'в Магнитогорске',
    'иваново': 'в Иваново', 'ivanovo': 'в Иваново',
    'брянск': 'в Брянске', 'bryansk': 'в Брянске',
    'белгород': 'в Белгороде', 'belgorod': 'в Белгороде',
    'сургут': 'в Сургуте', 'surgut': 'в Сургуте',
    'владимир': 'во Владимире', 'vladimir': 'во Владимире',
    'архангельск': 'в Архангельске', 'arkhangelsk': 'в Архангельске',
    'чита': 'в Чите', 'chita': 'в Чите',
    'калуга': 'в Калуге', 'kaluga': 'в Калуге',
    'смоленск': 'в Смоленске', 'smolensk': 'в Смоленске',
    'курган': 'в Кургане', 'kurgan': 'в Кургане',
    'орел': 'в Орле', 'oryol': 'в Орле', 'orel': 'в Орле',
    'череповец': 'в Череповце', 'cherepovets': 'в Череповце',
    'вологда': 'в Вологде', 'vologda': 'в Вологде',
    'якутск': 'в Якутске', 'yakutsk': 'в Якутске',
    'саранск': 'в Саранске', 'saransk': 'в Саранске',
    'владикавказ': 'во Владикавказе', 'vladikavkaz': 'во Владикавказе',
    'мурманск': 'в Мурманске', 'murmansk': 'в Мурманске',
    'тамбов': 'в Тамбове', 'tambov': 'в Тамбове',
    'грозный': 'в Грозном', 'grozny': 'в Грозном',
    'петрозаводск': 'в Петрозаводске', 'petrozavodsk': 'в Петрозаводске',
    'кострома': 'в Костроме', 'kostroma': 'в Костроме',
    'йошкар-ола': 'в Йошкар-Оле', 'yoshkar-ola': 'в Йошкар-Оле',
    'нальчик': 'в Нальчике', 'nalchik': 'в Нальчике',
    'сыктывкар': 'в Сыктывкаре', 'syktyvkar': 'в Сыктывкаре',
    'нижневартовск': 'в Нижневартовске', 'nizhnevartovsk': 'в Нижневартовске',
    'нижний тагил': 'в Нижнем Тагиле', 'nizhny tagil': 'в Нижнем Тагиле',
    'великий новгород': 'в Великом Новгороде', 'veliky novgorod': 'в Великом Новгороде',
    'псков': 'во Пскове', 'pskov': 'во Пскове',
    'абакан': 'в Абакане', 'abakan': 'в Абакане',
    'благовещенск': 'в Благовещенске', 'blagoveshchensk': 'в Благовещенске',
    'южно-сахалинск': 'в Южно-Сахалинске', 'yuzhno-sakhalinsk': 'в Южно-Сахалинске',
    'петропавловск-камчатский': 'в Петропавловске-Камчатском',
    'petropavlovsk-kamchatsky': 'в Петропавловске-Камчатском',
    'майкоп': 'в Майкопе', 'maykop': 'в Майкопе', 'maikop': 'в Майкопе',
    'элиста': 'в Элисте', 'elista': 'в Элисте',
    'черкесск': 'в Черкесске', 'cherkessk': 'в Черкесске',
    'магас': 'в Магасе', 'magas': 'в Магасе',
    'назрань': 'в Назрани', 'nazran': 'в Назрани',
    'горно-алтайск': 'в Горно-Алтайске', 'gorno-altaysk': 'в Горно-Алтайске',
    'кызыл': 'в Кызыле', 'kyzyl': 'в Кызыле',
    'салехард': 'в Салехарде', 'salekhard': 'в Салехарде',
    'ханты-мансийск': 'в Ханты-Мансийске', 'khanty-mansiysk': 'в Ханты-Мансийске',
    'севастополь': 'в Севастополе', 'sevastopol': 'в Севастополе',
    'симферополь': 'в Симферополе', 'simferopol': 'в Симферополе',

    'краснодар': 'в Краснодаре', 'krasnodar': 'в Краснодаре',
    'сочи': 'в Сочи', 'sochi': 'в Сочи',
    'новороссийск': 'в Новороссийске', 'novorossiysk': 'в Новороссийске',
    'армавир': 'в Армавире', 'armavir': 'в Армавире',
    'анапа': 'в Анапе', 'anapa': 'в Анапе',
    'ейск': 'в Ейске', 'yeysk': 'в Ейске', 'eysk': 'в Ейске',
    'геленджик': 'в Геленджике', 'gelendzhik': 'в Геленджике',
    'туапсе': 'в Туапсе', 'tuapse': 'в Туапсе',
    'кропоткин': 'в Кропоткине', 'kropotkin': 'в Кропоткине',
    'славянск-на-кубани': 'в Славянске-на-Кубани',
    'slavyansk-na-kubani': 'в Славянске-на-Кубани',
    'тихорецк': 'в Тихорецке', 'tikhoretsk': 'в Тихорецке',
    'тимашевск': 'в Тимашевске', 'timashevsk': 'в Тимашевске',
    'крымск': 'в Крымске', 'krymsk': 'в Крымске',
    'белореченск': 'в Белореченске', 'belorechensk': 'в Белореченске',
    'курганинск': 'в Курганинске', 'kurganinsk': 'в Курганинске',
    'лабинск': 'в Лабинске', 'labinsk': 'в Лабинске',
    'апшеронск': 'в Апшеронске', 'apsheronsk': 'в Апшеронске',
    'усть-лабинск': 'в Усть-Лабинске', 'ust-labinsk': 'в Усть-Лабинске',
    'абинск': 'в Абинске', 'abinsk': 'в Абинске',
    'горячий ключ': 'в Горячем Ключе', 'goryachy klyuch': 'в Горячем Ключе',
    'приморско-ахтарск': 'в Приморско-Ахтарске',
    'primorsko-akhtarsk': 'в Приморско-Ахтарске',
    'темрюк': 'в Темрюке', 'temryuk': 'в Темрюке',
    'кореновск': 'в Кореновске', 'korenovsk': 'в Кореновске',
    'гулькевичи': 'в Гулькевичах', 'gulkevichi': 'в Гулькевичах',
    'хадыженск': 'в Хадыженске', 'khadyzhensk': 'в Хадыженске',
    'новокубанск': 'в Новокубанске', 'novokubansk': 'в Новокубанске',
    'адлер': 'в Адлере', 'adler': 'в Адлере',
    'краснодарский': 'в Краснодарском крае'
  };

  var ENG_REGIONS = {
    'krasnodar krai': 'в Краснодарском крае',
    'krasnodarskiy kray': 'в Краснодарском крае',
    'stavropol krai': 'в Ставропольском крае',
    'primorsky krai': 'в Приморском крае',
    'khabarovsk krai': 'в Хабаровском крае',
    'altai krai': 'в Алтайском крае',
    'perm krai': 'в Пермском крае',
    'krasnoyarsk krai': 'в Красноярском крае',
    'moscow oblast': 'в Московской области',
    'leningrad oblast': 'в Ленинградской области',
    'rostov oblast': 'в Ростовской области',
    'sverdlovsk oblast': 'в Свердловской области'
  };

  // Именительный падеж для тех же регионов — нужен подписи «Ваш регион».
  var ENG_REGIONS_NOM = {
    'krasnodar krai': 'Краснодарский край',
    'krasnodarskiy kray': 'Краснодарский край',
    'stavropol krai': 'Ставропольский край',
    'primorsky krai': 'Приморский край',
    'khabarovsk krai': 'Хабаровский край',
    'altai krai': 'Алтайский край',
    'perm krai': 'Пермский край',
    'krasnoyarsk krai': 'Красноярский край',
    'moscow oblast': 'Московская область',
    'leningrad oblast': 'Ленинградская область',
    'rostov oblast': 'Ростовская область',
    'sverdlovsk oblast': 'Свердловская область'
  };

  var CYRILLIC = /[а-яё]/i;

  function normalize(name) {
    return String(name).toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function capitalize(word) {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // «ростов-на-дону» -> «Ростов-на-Дону», «нижний новгород» -> «Нижний Новгород»
  var INNER_LOWER = { 'на': 1, 'в': 1, 'при': 1 };
  function titleCase(name) {
    return name.split(' ').map(function (word) {
      return word.split('-').map(function (part, idx) {
        return (idx > 0 && INNER_LOWER[part]) ? part : capitalize(part);
      }).join('-');
    }).join(' ');
  }

  // Обратный индекс «предложная фраза -> именительный падеж».
  // Строится из русских ключей FORMS, отдельный словарь не нужен.
  var NOMINATIVE = (function () {
    var map = {}, key;
    for (key in FORMS) {
      if (!Object.prototype.hasOwnProperty.call(FORMS, key)) continue;
      if (!CYRILLIC.test(key)) continue;
      if (!map[FORMS[key]]) map[FORMS[key]] = titleCase(key);
    }
    for (key in ENG_REGIONS) {
      if (!Object.prototype.hasOwnProperty.call(ENG_REGIONS, key)) continue;
      if (ENG_REGIONS_NOM[key]) map[ENG_REGIONS[key]] = ENG_REGIONS_NOM[key];
    }
    return map;
  })();

  function regionToPrepositional(rawName) {
    var s = normalize(rawName);

    if (ENG_REGIONS[s]) return ENG_REGIONS[s];

    var rep = s.match(/^республика\s+(.+)$/);
    if (rep) return 'в Республике ' + capitalize(rep[1]);
    rep = s.match(/^(.+)\s+республика$/);
    if (rep) return 'в Республике ' + capitalize(rep[1]);

    var m = s.match(/^(.+?)\s+(край|область|автономный округ|автономная область)$/);
    if (!m) return null;

    var adj = m[1];
    var type = m[2];

    function declineAdj(word) {
      return word.split('-').map(function (part) {
        if (/ский$|ный$|ний$|цкий$|ой$/.test(part)) {
          return part.replace(/(ский|цкий|ный|ний|ой)$/, function (x) {
            return { 'ский': 'ском', 'цкий': 'цком', 'ный': 'ном',
                     'ний': 'нем', 'ой': 'ом' }[x];
          });
        }
        if (/ская$|ная$|няя$|цкая$/.test(part)) {
          return part.replace(/(ская|цкая|ная|няя)$/, function (x) {
            return { 'ская': 'ской', 'цкая': 'цкой',
                     'ная': 'ной', 'няя': 'ней' }[x];
          });
        }
        return part;
      }).join('-');
    }

    if (type === 'край') {
      return 'в ' + titleCase(declineAdj(adj)) + ' крае';
    }
    if (type === 'область') {
      return 'в ' + titleCase(declineAdj(adj)) + ' области';
    }
    if (type === 'автономный округ') {
      return 'в ' + titleCase(declineAdj(adj)) + ' автономном округе';
    }
    if (type === 'автономная область') {
      return 'в ' + titleCase(declineAdj(adj)) + ' автономной области';
    }
    return null;
  }

  function toPrepositional(rawName) {
    if (!rawName) return null;

    var key = normalize(rawName);
    if (FORMS[key]) return FORMS[key];

    var stripped = key.replace(/^(город|г|city of|gorod)\s+/, '');
    if (FORMS[stripped]) return FORMS[stripped];

    var region = regionToPrepositional(key);
    if (region) return region;

    var eng = key.replace(/\s+(oblast|krai|kray|region|okrug|republic)$/, '');
    if (eng !== key && FORMS[eng]) return FORMS[eng];

    return null;
  }

  // Возвращает пару форм: предложную для заголовка и именительную для подписи.
  function resolve(rawName) {
    var phrase = toPrepositional(rawName);
    if (!phrase) return null;

    var raw = String(rawName).trim();
    var readable;
    if (CYRILLIC.test(raw)) {
      // Провайдер уже отдал русское название. Если оно пришло целиком
      // в нижнем или верхнем регистре, берём форму из словаря, а для
      // регионов вне словаря поднимаем первую букву: под подписью
      // «Ваш регион» строчное «москва» выглядит ошибкой.
      var oddCase = (raw === raw.toLowerCase() || raw === raw.toUpperCase());
      readable = oddCase ? (NOMINATIVE[phrase] || capitalize(raw.toLowerCase())) : raw;
    } else {
      readable = NOMINATIVE[phrase] || phrase.replace(/^в[ео]?\s+/i, '');
    }

    return { phrase: phrase, readable: readable, push: true };
  }

  var PROVIDERS = [
    {
      url: 'https://ipwho.is/',
      timeout: TIMEOUT_FIRST,
      parse: function (d) {
        if (!d || d.success === false) return null;
        return { country: d.country_code, names: [d.city, d.region] };
      }
    },
    {
      url: 'https://ipapi.co/json/',
      timeout: TIMEOUT_NEXT,
      parse: function (d) {
        if (!d || d.error) return null;
        return { country: d.country_code, names: [d.city, d.region] };
      }
    },
    {
      url: 'https://api.sypexgeo.net/json/',
      timeout: TIMEOUT_NEXT,
      parse: function (d) {
        if (!d) return null;
        var city = d.city && (d.city.name_ru || d.city.name_en);
        var reg  = d.region && (d.region.name_ru || d.region.name_en);
        return { country: d.country && d.country.iso, names: [city, reg] };
      }
    }
  ];

  function pickForm(names) {
    for (var i = 0; i < names.length; i++) {
      var res = resolve(names[i]);
      if (res) return res;
    }
    return null;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.t || Date.now() - obj.t > CACHE_TTL) return null;
      return obj.v || null;
    } catch (e) { return null; }
  }

  function writeCache(value) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ v: value, t: Date.now() }));
    } catch (e) {}
  }

  function fromUrl(params) {
    var raw = params.get('city') || params.get('region') || params.get('geo');
    if (!raw) return null;
    raw = raw.trim();
    if (!raw) return null;

    if (/^в[ео]?\s/i.test(raw)) {
      return { phrase: raw, readable: NOMINATIVE[raw] || raw.replace(/^в[ео]?\s+/i, ''), push: true };
    }
    return resolve(raw);
  }

  function fetchJson(url, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve(null); }
      }, timeoutMs);
      fetch(url, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!done) { done = true; clearTimeout(timer); resolve(d); }
        })
        .catch(function () {
          if (!done) { done = true; clearTimeout(timer); resolve(null); }
        });
    });
  }

  function detectByIp() {
    var i = 0;
    function next() {
      if (i >= PROVIDERS.length) return Promise.resolve(null);
      var p = PROVIDERS[i++];
      return fetchJson(p.url, p.timeout || TIMEOUT_NEXT).then(function (data) {
        var info = null;
        try { info = p.parse(data); } catch (e) { info = null; }
        if (window.ARMA_GEO_DEBUG) {
          console.log('[geo]', p.url, info);
        }
        if (!info) return next();

        // Не Россия — универсальная формулировка, в URL не пишем:
        // компонент принимает только фразы на в/во/на.
        if (info.country && info.country !== 'RU') return FOREIGN;

        var form = pickForm(info.names || []);
        if (form) return form;
        return next();
      });
    }
    return next();
  }

  function paint(res) {
    var i;
    var main = document.querySelectorAll(SLOT_PHRASE);
    for (i = 0; i < main.length; i++) {
      if (main[i].textContent !== res.phrase) main[i].textContent = res.phrase;
      // Длинные названия вроде «в Петропавловске-Камчатском» на 360px.
      main[i].style.overflowWrap = 'break-word';
      main[i].style.hyphens = 'auto';
    }

    var label = document.querySelectorAll(SLOT_LABEL);
    for (i = 0; i < label.length; i++) {
      if (label[i].textContent !== res.readable) label[i].textContent = res.readable;
    }

    // Поле в заявку не уходит (компонент шлёт своё состояние), но если
    // оно когда-нибудь появится в разметке — заполним.
    var hidden = document.querySelectorAll('input[name="geo_region"]');
    for (i = 0; i < hidden.length; i++) {
      hidden[i].value = res.readable;
    }

    var title = 'Образовательная лицензия ' + res.phrase + ' под ключ | АРМА';
    if (document.title !== title) document.title = title;

    return main.length > 0 || label.length > 0;
  }

  // Регион уходит в CRM через параметры адреса: компонент читает их
  // в componentDidMount и кладёт в заявку рядом с utm-метками.
  function pushToUrl(res) {
    if (!res.push) return;
    if (!/^(в|во|на)\s/i.test(res.phrase)) return;
    try {
      var url = new URL(location.href);
      if (url.searchParams.get('geo_phrase')) return;
      url.searchParams.set('geo_phrase', res.phrase);
      url.searchParams.set('geo_region', res.readable);
      history.replaceState(null, '', url.toString());
    } catch (e) {}
  }

  function start(res) {
    pushToUrl(res);
    window.ARMA_GEO = res.phrase;          // предложная фраза, как в документации скрипта
    window.ARMA_GEO_REGION = res.readable; // именительный падеж — его ждёт CRM
    try {
      document.dispatchEvent(new CustomEvent('arma:geo', { detail: res }));
    } catch (e) {}

    var attempts = 0;
    paint(res);
    var poll = setInterval(function () {
      attempts += 1;
      paint(res);
      if (attempts > POLL_MAX) clearInterval(poll);
    }, POLL_MS);
  }

  function run() {
    var params = new URLSearchParams(location.search);

    // Фразу задала рекламная кампания — компонент подставит её сам.
    if ((params.get('geo_phrase') || '').trim()) return;

    var fromParam = fromUrl(params);
    if (fromParam) { writeCache(fromParam); start(fromParam); return; }

    var cached = readCache();
    if (cached && cached.phrase) { start(cached); return; }

    detectByIp().then(function (res) {
      if (!res) return;                 // остаётся штатное «в вашем регионе»
      writeCache(res);
      start(res);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
