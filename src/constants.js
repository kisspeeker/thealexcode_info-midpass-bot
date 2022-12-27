import { resolve } from 'path';
import dotenv from 'dotenv-flow';
dotenv.config();

export const BOT_TOKEN = process.env.TG_BOT_TOKEN;
export const ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT_ID;
export const LOGS_PATH = resolve('./data/logs.json');
export const API_ROUTE_MIDPASS = 'https://info.midpass.ru/api/request';

export const API_KEY = process.env.API_KEY
export const API_ROUTE_LOGS = process.env.API_ROOT + '/api/funpics-bot-logs?sort[0]=id:DESC'


// Я умею отслеживать статус готовности загранпаспорта РФ и оповещать о его изменениях!
export const MESSAGES = {
  start: `Privet! Введи номер своего заявления`,
  startForUser: `Privet! Я нашел твои прошлые отслеживания`,
  status(code) {
    return `
<b>Процент:</b> <b>${code.internalStatus.percent}</b>
<b>Документы поданы:</b> ${code.receptionDate}
<b>Статус:</b> ${code.passportStatus.name}
<b>Внутренний статус:</b> ${code.internalStatus.name}
`
  }
}

export const USERS = []