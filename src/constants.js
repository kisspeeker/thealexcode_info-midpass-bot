import { resolve } from 'path';
import dotenv from 'dotenv-flow';
dotenv.config();

export const DEBUG = false;
export const START_CRONJOB_IMMEDIATELY = false;

export const BOT_TOKEN = process.env.TG_BOT_TOKEN;
export const ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT_ID;
export const LOGS_PATH = resolve('./data/logs.json');
export const API_ROUTE_MIDPASS = 'https://info.midpass.ru/api/request';

export const API_KEY = process.env.API_KEY
export const API_ROUTE_LOGS = process.env.API_ROOT + '/api/bot-logs'
export const API_ROUTE_USERS = process.env.API_ROOT + '/api/bot-users'

export const TIMEZONE_OFFSET_MSK = 3;

export const CRONJOB_SCHEDULES = [
  '23 9,12,15,17,19,21 * * 1-5', // Weekdays 9:23,12:23...21:23
  '23 16,20 * * 0,6' // Weekends 16:23,20:23
]

export const LogsTypes = {
  ERROR: 'ERROR',
  ERROR_CRONJOB_ROOT: 'ERROR_CRONJOB_ROOT',
  ERROR_CRONJOB_USER_CODE: 'ERROR_CRONJOB_USER_CODE',
  SUCCESS_START: 'SUCCESS_START',
  START_CRONJOB: 'START_CRONJOB',
  END_CRONJOB: 'END_CRONJOB',
  AUTOUPDATE_WITHOUT_CHANGES: 'AUTOUPDATE_WITHOUT_CHANGES',
  AUTOUPDATE_WITH_CHANGES: 'AUTOUPDATE_WITH_CHANGES',
  SUBSCRIBE_ENABLE: 'SUBSCRIBE_ENABLE',
  UNSUBSCRIBE_ENABLE: 'UNSUBSCRIBE_ENABLE',
  SUCCESS_CODE_STATUS: 'SUCCESS_CODE_STATUS',
  MESSAGE: 'MESSAGE',
}

export const Timeouts = {
  START: 1000 * 2,
  TEXT: 1000 * 4,
  CRONJOB_NEXT_USER_CODE: 1000 * 30,
  CRONJOB_NEXT_USER: 1000 * 45,
  GET_USERS: 100,
}

export const MetaKeys = {
  CODE: 'CODE',
  CODE_UID: 'CODE_UID',
  COUNTER_USERS_WITH_CODES: 'COUNTER_USERS_WITH_CODES',
  COUNTER_USERS_CHECKED: 'COUNTER_USERS_CHECKED',
  COUNTER_CODES: 'COUNTER_CODES',
  COUNTER_CODES_UPDATED: 'COUNTER_CODES_UPDATED'
}

export const API_USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
]

export const FALSY_PASSPORT_STATUSES = [
  'паспорт выдан',
  'отмена изготовления паспорта'
]

export const Messages = {
  START: `
<b>👨 Privet!</b>

Я умею:
- отслеживать статус готовности загранпаспорта РФ
- оповещать об изменениях статуса заявления

Для проверки готовности паспорта необходимо ввести \`25-значный\` номер своего заявления, указанного в справке о приеме.

Введи номер своего заявления и узнай его статус:
`,
  START_FOR_USER: `
<b>👨 Privet!</b>

Я умею:
- отслеживать статус готовности загранпаспорта РФ
- оповещать об изменениях статуса заявления

Для проверки готовности паспорта необходимо ввести \`25-значный\` номер своего заявления, указанного в справке о приеме.

Раньше ты уже пользовался моими оповещениями, я отображу их ниже (если они были).
Ты можешь ввести номер другого заявления и узнать его статус:
`,
  SUBSCRIBE_ENABLE: (uid = '') => `✅ Теперь я буду уведомлять тебя об изменениях статуса заявления <b>${uid}</b>.`,
  SUBSCRIBE_ENABLE_ALREADY: (uid = '') => `✅ Заявление уже отслеживается <b>${uid}</b>`,
  UNSUBSCRIBE: 'Выберите заявление, которое нужно перестать отслеживать:',
  UNSUBSCRIBE_ENABLE: (uid = '') => `✅ Успешно отписался от отслеживания статуса заявления <b>${uid}</b>.`,
  CODE_HAS_CHANGES: (status = {}) => `<b>🔥 Статус заявления изменился!</b> \n\n${status}`,
  AUTOUPDATE_WITHOUT_CHANGES(user = {}, code = {}) {
    return `
<b>ℹ️ У пользователя не изменился статус заявления.</b>

<b>User:</b> ${user.chatId || user.id || user.userName}
${Messages.CODE_STATUS(code)}
`
  },
  USER_CODE_HAS_CHANGES(user = {}, code = {}) {
    return `
<b>ℹ️ У пользователя изменился статус заявления!</b>

<b>User:</b> ${user.chatId || user.id || user.userName}
${Messages.CODE_STATUS(code)}
`
  },
  CODE_STATUS: (code = {}) =>
`<b>#️⃣ Номер заявления:</b> ${code?.uid || '-'}

<b>🟡 Процент:</b> <b>${code?.internalStatus?.percent || '-'}</b>

<b>🟡 Статус:</b> ${code?.passportStatus?.name || '-'}

<b>🟡 Внутренний статус:</b> ${code?.internalStatus?.name || '-'}

<b>📅 Дата подачи:</b> ${code?.receptionDate || '-'}
`,
  NEW_USER: (user = {}) =>
`🆕 Новый пользователь!

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> ${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}
`,
  USER_MESSAGE_WITHOUT_UID: (user = {}, message = '') =>
`⚠️ Сообщение от пользователя!

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> ${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}

<b>Message:</b>
${message}
`,
  ERROR_VALIDATE_CODE: `
❌ Некорректный формат номера заявления.

Для проверки готовности паспорта необходимо ввести <b>25-значный</b> номер своего заявления, указанного в справке о приеме.
Проверь правильность ввода и попробуй ещё раз.

Если ошибка повторяется, используй официальный сайт МИД РФ https://info.midpass.ru/
`,
  ERROR_REQUEST_CODE: `
❌ Ошибка получения информации о заявлении с сервера МИД РФ.

Для проверки готовности паспорта необходимо ввести <b>25-значный</b> номер своего заявления, указанного в справке о приеме.
Проверь правильность ввода и попробуй ещё раз.

Если ошибка повторяется, используй официальный сайт МИД РФ https://info.midpass.ru/
`,
  ERROR_REQUEST_CODE_WITH_USER: (user = {}, message = '') => `
❌ Ошибка получения информации о заявлении с сервера МИД РФ.

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> ${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}
<b>Сообщение</b> ${message}
`,
  SUCCESS_SEND_TO_USER: (userId, messageToUser) => `✅ Успешно написал пользователю ${userId}. Сообщение: \n\n${messageToUser}`,
  ERROR_SEND_TO_USER: (userId, e) => `❌ Ошибка при отправке сообщения пользователю ${userId}. Сообщение: \n\n${e?.code || '-'}: ${e?.description || '-'}`,
  ERROR_BLOCK_BY_USER: (user = {}, message = '') => `
❌ Bot was blocked by the user. Он больше не выпадает в выдаче, его коды удалены

<b>userName:</b> ${user?.userName ? '@' + user.userName : '-'}
<b>chatId:</b> ${user?.chatId || '-'}
<b>id:</b> ${user?.id || '-'}
<b>firstName:</b> ${user?.firstName || '-'}
<b>lastName:</b> ${user?.lastName || '-'}
`,
ERROR_CRONJOB: (e, type = '-', obj = {}) => `
❌ Ошибка CronJob (${type}):

${e}

Additional data:
${JSON.stringify(obj)}
`,
START_CRONJOB: (counterUserWithCodes = 0) => `
<b>${new Date().getUTCHours() + TIMEZONE_OFFSET_MSK}:${new Date().getMinutes()}</b> / ${LogsTypes.START_CRONJOB}
Количество пользователей: ${counterUserWithCodes}
`,
END_CRONJOB: (counterUsersChecked = 0, counterCodes = 0, counterCodesUpdated = 0) => `
<b>${new Date().getUTCHours() + TIMEZONE_OFFSET_MSK}:${new Date().getMinutes()}</b> / ${LogsTypes.END_CRONJOB}
Проверено пользователей: ${counterUsersChecked}
Проверено заявлений: ${counterCodes}
Обновлено заявлений: ${counterCodesUpdated}
`,
}
