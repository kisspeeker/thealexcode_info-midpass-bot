import { resolve } from 'path';
import dotenv from 'dotenv-flow';
dotenv.config();

export const DEBUG = false;
export const START_CRON_JOB_IMMEDIATELY = false;

export const BOT_TOKEN = process.env.TG_BOT_TOKEN;
export const ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT_ID;
export const LOGS_PATH = resolve('./data/logs.json');
export const API_ROUTE_MIDPASS = 'https://info.midpass.ru/api/request';

export const API_KEY = process.env.API_KEY
export const API_ROUTE_LOGS = process.env.API_ROOT + '/api/bot-logs'
export const API_ROUTE_USERS = process.env.API_ROOT + '/api/bot-users'

export const LOGS_TYPES = {
  error: 'error',
  errorCronJobRoot: 'errorCronJobRoot',
  errorCronJobUserCode: 'errorCronJobUserCode',
  successStart: 'successStart',
  successCronJob: 'successCronJob',
  autoUpdateWithoutChanges: 'autoUpdateWithoutChanges',
  autoUpdateWithChanges: 'autoUpdateWithChanges',
  subscribeEnable: 'subscribeEnable',
  unsubscribeEnable: 'unsubscribeEnable',
  successCodeStatus: 'successCodeStatus',
  message: 'message',
}

export const TIMEOUTS = {
  start: 1000 * 2,
  text: 1000 * 4,
  cronNextUserCode: 1000 * 30,
  cronNextUser: 1000 * 45,
  getUsers: 100,
}

export const API_USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
]

export const FALSY_PASSPORT_STATUSES = [
  'паспорт выдан',
  'отмена изготовления паспорта'
]

export const MESSAGES = {
  start: `
<b>👨 Privet!</b>

Я умею:
- отслеживать статус готовности загранпаспорта РФ
- оповещать об изменениях статуса заявления

Для проверки готовности паспорта необходимо ввести \`25-значный\` номер своего заявления, указанного в справке о приеме.

Введи номер своего заявления и узнай его статус:
`,
  startForUser: `
<b>👨 Privet!</b>

Я умею:
- отслеживать статус готовности загранпаспорта РФ
- оповещать об изменениях статуса заявления

Для проверки готовности паспорта необходимо ввести \`25-значный\` номер своего заявления, указанного в справке о приеме.

Раньше ты уже пользовался моими оповещениями, я отображу их ниже (если они были).
Ты можешь ввести номер другого заявления и узнать его статус:
`,
  subscribeEnable: (uid = '') => `✅ Теперь я буду уведомлять тебя об изменениях статуса заявления <b>${uid}</b>.`,
  subscribeEnableAlready: (uid = '') => `✅ Заявление уже отслеживается <b>${uid}</b>`,
  unsubscribe: 'Выберите заявление, которое нужно перестать отслеживать:',
  unsubscribeEnable: (uid = '') => `✅ Успешно отписался от отслеживания статуса заявления <b>${uid}</b>.`,
  codeHasChanges: (status = {}) => `<b>🔥 Статус заявления изменился!</b> \n\n${status}`,
  autoUpdateWithoutChanges(user = {}, code = {}) {
    return `
<b>ℹ️ У пользователя не изменился статус заявления.</b>

<b>User:</b> ${user.chatId || user.id || user.userName}
${MESSAGES.codeStatus(code)}
`
  },
  userCodeHasChanges(user = {}, code = {}) {
    return `
<b>ℹ️ У пользователя изменился статус заявления!</b>

<b>User:</b> ${user.chatId || user.id || user.userName}
${MESSAGES.codeStatus(code)}
`
  },
  codeStatus: (code = {}) =>
`<b>#️⃣ Номер заявления:</b> ${code?.uid || '-'}

<b>🟡 Процент:</b> <b>${code?.internalStatus?.percent || '-'}</b>

<b>🟡 Статус:</b> ${code?.passportStatus?.name || '-'}

<b>🟡 Внутренний статус:</b> ${code?.internalStatus?.name || '-'}

<b>📅 Дата подачи:</b> ${code?.receptionDate || '-'}
`,
  newUser: (user = {}) =>
`🆕 Новый пользователь!

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> ${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}
`,
  userMessageWithoutUid: (user = {}, message = '') =>
`⚠️ Сообщение от пользователя!

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> ${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}

<b>Message:</b>
${message}
`,
  errorValidateCode: `
❌ Некорректный формат номера заявления.

Для проверки готовности паспорта необходимо ввести <b>25-значный</b> номер своего заявления, указанного в справке о приеме.
Проверь правильность ввода и попробуй ещё раз.

Если ошибка повторяется, используй официальный сайт МИД РФ https://info.midpass.ru/
`,
  errorRequestCode: `
❌ Ошибка получения информации о заявлении с сервера МИД РФ.

Для проверки готовности паспорта необходимо ввести <b>25-значный</b> номер своего заявления, указанного в справке о приеме.
Проверь правильность ввода и попробуй ещё раз.

Если ошибка повторяется, используй официальный сайт МИД РФ https://info.midpass.ru/
`,
  errorRequestCodeWithUser: (user = {}, message = '') => `
❌ Ошибка получения информации о заявлении с сервера МИД РФ.

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> ${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}
<b>Сообщение</b> ${message}
`,
  successSendToUser: (userId, messageToUser) => `✅ Успешно написал пользователю ${userId}. Сообщение: \n\n${messageToUser}`,
  errorSendToUser: (userId, e) => `❌ Ошибка при отправке сообщения пользователю ${userId}. Сообщение: \n\n${e?.code || '-'}: ${e?.description || '-'}`,
  successCronJob: `✅✅✅ Успешно пройден цикл CronJob`,
  errorCronJob: (e, type = '-', obj = {}) => `
❌ Ошибка CronJob (${type}):

${e}

Additional data:
${JSON.stringify(obj)}
`,
  errorBlockByUser: (user = {}, message = '') => `
❌ Bot was blocked by the user. Он больше не выпадает в выдаче, его коды удалены

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> ${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}
`,
}
