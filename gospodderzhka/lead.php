<?php
/**
 * Навигатор господдержки АРМА: приём заявки «Нужна помощь» и создание лида в Битрикс24.
 *
 * Работает на хостинге reg.ru (Россия). Персональные данные не сохраняются на хостинге:
 * заявка проверяется и сразу передаётся в Битрикс24 методом crm.lead.add.
 *
 * Вне веб-корня (deploy-regru.sh эту папку не трогает):
 *   ~/private/gospodderzhka/config.php   адрес вебхука Битрикс24 и настройки, вписывает владелец
 *   ~/private/gospodderzhka/ratelimit/   отметки времени по хешу IP, без имени и телефона
 *   ~/private/gospodderzhka/lead-errors.log  журнал ошибок без персональных данных
 *
 * Ответы: 200 {"ok":true}; 400 ошибка в данных; 403 чужой источник; 405 не POST;
 *         413 слишком большой запрос; 429 слишком часто; 502 Битрикс24 недоступен или не настроен.
 */

declare(strict_types=1);

const ALLOWED_ORIGIN = 'https://arma-lab.ru';
const SOURCE_MARK    = 'Калькулятор господдержки';
const MAX_BODY       = 65536;
const RATE_MIN_GAP   = 60;      // секунд между заявками с одного IP
const RATE_WINDOW    = 3600;    // окно для подсчёта
const RATE_MAX       = 5;       // заявок с одного IP за окно
const CONSENT_EDITION = '08.10.2026';   // редакция текста согласия: менять вместе с soglasie.html
const CONSENT_URL     = 'https://arma-lab.ru/gospodderzhka/soglasie.html';

$PRIVATE = dirname(__DIR__, 3) . '/private/gospodderzhka';   // /var/www/u3083275/data/private/gospodderzhka

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Журнал без персональных данных: время, код, причина. */
function log_error(string $dir, string $event, string $detail = ''): void
{
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $line = sprintf("%s\t%s\t%s\n", gmdate('Y-m-d\TH:i:s\Z'), $event, preg_replace('/\s+/', ' ', mb_substr($detail, 0, 300)));
    @file_put_contents($dir . '/lead-errors.log', $line, FILE_APPEND | LOCK_EX);
}

function clip($v, int $n): string
{
    return is_string($v) ? mb_substr(trim($v), 0, $n) : '';
}

/* ---------- 1. Метод, источник, размер ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'method']);
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== ALLOWED_ORIGIN) {
    log_error($PRIVATE, 'forbidden_origin', $origin === '' ? 'empty' : parse_url($origin, PHP_URL_HOST) ?? 'bad');
    respond(403, ['ok' => false, 'error' => 'origin']);
}
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || strlen($raw) > MAX_BODY) {
    respond(413, ['ok' => false, 'error' => 'too_large']);
}
$b = json_decode($raw, true);
if (!is_array($b)) {
    respond(400, ['ok' => false, 'error' => 'invalid', 'fields' => ['json']]);
}

/* ---------- 2. Поле-ловушка: отвечаем «принято», лид не создаём ---------- */
if (clip($b['website'] ?? '', 200) !== '') {
    respond(200, ['ok' => true]);
}

/* ---------- 3. Частота по IP: хранится только хеш IP и отметки времени.
   Здесь только проверка; отметка записывается после успешного создания лида,
   поэтому ответы 400 и 502 попытку не занимают. ---------- */
$cfgFile = $PRIVATE . '/config.php';
$cfg = is_file($cfgFile) ? (require $cfgFile) : null;
$salt = is_array($cfg) && !empty($cfg['ip_salt']) ? (string)$cfg['ip_salt'] : 'gosp';
// На хостинге reg.ru REMOTE_ADDR содержит реальный адрес клиента (проверено 08.10.2026).
// X-Real-IP и X-Forwarded-For nginx не выставляет: их присылает сам клиент, верить им нельзя.
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
if (is_array($cfg) && !empty($cfg['test_mode']) && !empty($_SERVER['HTTP_X_TEST_IP'])) {
    $ip = (string)$_SERVER['HTTP_X_TEST_IP'];          // только для локальных тестов
}
$rateDir = $PRIVATE . '/ratelimit';
if (!is_dir($rateDir)) {
    @mkdir($rateDir, 0700, true);
}
$rateFile = $rateDir . '/' . hash('sha256', $salt . '|' . $ip);
$now = time();
function read_stamps(string $file, int $now): array
{
    $raw = is_file($file) ? (string)@file_get_contents($file) : '';
    return array_values(array_filter(array_map('intval', explode(',', $raw)), fn($t) => $t > $now - RATE_WINDOW));
}
$stamps = read_stamps($rateFile, $now);
if (($stamps && max($stamps) > $now - RATE_MIN_GAP) || count($stamps) >= RATE_MAX) {
    respond(429, ['ok' => false, 'error' => 'rate_limited']);
}

/* ---------- 4. Проверка полей ---------- */
$name      = clip($b['name'] ?? '', 100);
$phone     = clip($b['phone'] ?? '', 40);
$email     = clip($b['email'] ?? '', 120);
$messenger = clip($b['messenger'] ?? '', 40);
$comment   = clip($b['comment'] ?? '', 2000);
$region    = clip($b['region'] ?? '', 120);

$errors = [];
if (($b['source'] ?? '') !== SOURCE_MARK)                         $errors[] = 'source';
if (($b['consent'] ?? null) !== true)                             $errors[] = 'consent';
if ($name === '')                                                 $errors[] = 'name';
if (strlen(preg_replace('/\D/', '', $phone)) < 10)                $errors[] = 'phone';
if ($email !== '' && !preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/u', $email)) $errors[] = 'email';
if ($errors) {
    respond(400, ['ok' => false, 'error' => 'invalid', 'fields' => $errors]);
}

/* ---------- 5. Лид ---------- */
$profile = [];
foreach (array_slice(is_array($b['profile'] ?? null) ? $b['profile'] : [], 0, 20) as $p) {
    if (is_array($p)) {
        $profile[] = '- ' . clip($p['question'] ?? '', 200) . ': ' . clip($p['answer'] ?? '', 400);
    }
}
$dirs = [];
foreach (array_slice(is_array($b['directions'] ?? null) ? $b['directions'] : [], 0, 15) as $d) {
    if (is_array($d)) {
        $dirs[] = '- ' . clip($d['title'] ?? '', 200) . ': ' . clip($d['status'] ?? '', 80);
    }
}
$isTest = (bool)preg_match('/(^|[^а-яё])тест([^а-яё]|$)/iu', $name . ' ' . $comment);
$consentAt = (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('d.m.Y H:i');

$comments = implode("\n", array_merge(
    [
        'Заявка из калькулятора «Навигатор господдержки для образовательного бизнеса».',
        'Удобный мессенджер: ' . ($messenger !== '' ? $messenger : 'не важно'),
        'Комментарий клиента: ' . ($comment !== '' ? $comment : 'нет'),
        'Согласие на обработку персональных данных: дано ' . $consentAt . ' МСК',
        'Текст согласия: редакция от ' . CONSENT_EDITION . ', ' . CONSENT_URL,
        'Версия данных калькулятора: ' . clip($b['data_version'] ?? '', 20),
        '',
        'Ответы:',
    ],
    $profile,
    ['', 'Найденные направления:'],
    $dirs ?: ['- нет']
));

$lead = [
    'TITLE'              => ($isTest ? 'ТЕСТ. ' : '') . 'Калькулятор господдержки: ' . $name . ($region !== '' ? ', ' . $region : ''),
    'NAME'               => $name,
    'PHONE'              => [['VALUE' => $phone, 'VALUE_TYPE' => 'WORK']],
    'EMAIL'              => $email !== '' ? [['VALUE' => $email, 'VALUE_TYPE' => 'WORK']] : [],
    'SOURCE_ID'          => (is_array($cfg) && !empty($cfg['source_id'])) ? (string)$cfg['source_id'] : 'WEB',
    'SOURCE_DESCRIPTION' => SOURCE_MARK,
    'ADDRESS_REGION'     => $region,
    'COMMENTS'           => $comments,
    'UTM_SOURCE'         => 'arma-lab.ru',
    'UTM_MEDIUM'         => 'calculator',
    'UTM_CAMPAIGN'       => 'gospodderzhka',
];
if (is_array($cfg) && !empty($cfg['assigned_by_id'])) {
    $lead['ASSIGNED_BY_ID'] = (int)$cfg['assigned_by_id'];
}

/* ---------- 6. Битрикс24: crm.lead.add, две попытки, таймаут 15 с ---------- */
$base = is_array($cfg) ? (string)($cfg['bitrix_webhook_base'] ?? '') : '';
$baseOk = preg_match('~^https://[^/]+/rest/\d+/[^/]+/$~', $base)
    || (!empty($cfg['test_mode']) && preg_match('~^http://127\.0\.0\.1:\d+/rest/\d+/[^/]+/$~', $base));   // только для локальных тестов
if (!$baseOk) {
    log_error($PRIVATE, 'config_missing');
    respond(502, ['ok' => false, 'error' => 'crm_unavailable']);
}
$payload = json_encode(['fields' => $lead, 'params' => ['REGISTER_SONET_EVENT' => 'Y']], JSON_UNESCAPED_UNICODE);

$leadId = null;
for ($try = 1; $try <= 2 && $leadId === null; $try++) {
    $ch = curl_init($base . 'crm.lead.add.json');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_FOLLOWLOCATION => false,
    ]);
    $resp = curl_exec($ch);
    $http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $cerr = curl_errno($ch);
    curl_close($ch);
    $data = is_string($resp) ? json_decode($resp, true) : null;
    if ($http === 200 && is_array($data) && isset($data['result']) && (int)$data['result'] > 0) {
        $leadId = (int)$data['result'];
        break;
    }
    // В журнал только код ответа и код ошибки Битрикс24, без содержимого заявки и адреса вебхука
    log_error($PRIVATE, 'bitrix_fail', sprintf('try=%d http=%d curl=%d error=%s', $try, $http, $cerr,
        is_array($data) ? clip((string)($data['error'] ?? ''), 60) : 'no_json'));
    if ($try < 2) {
        sleep(2);
    }
}

if ($leadId === null) {
    respond(502, ['ok' => false, 'error' => 'crm_unavailable']);
}

/* ---------- 7. Отметка для ограничителя частоты: только после успешного лида ---------- */
$fh = @fopen($rateFile, 'c+');
if ($fh) {
    flock($fh, LOCK_EX);
    $stamps = read_stamps($rateFile, $now);
    $stamps[] = $now;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, implode(',', $stamps));
    flock($fh, LOCK_UN);
    fclose($fh);
    if (random_int(1, 50) === 1) {                     // изредка чистим старые отметки
        foreach (glob($rateDir . '/*') ?: [] as $f) {
            if (@filemtime($f) < $now - RATE_WINDOW) {
                @unlink($f);
            }
        }
    }
} else {
    log_error($PRIVATE, 'ratelimit_unavailable');
}
respond(200, ['ok' => true]);
