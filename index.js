import fs from 'fs';
import { resolve } from 'path';
import { Telegraf, Markup } from 'telegraf';

import {
  BOT_TOKEN,
  MESSAGES,
  USERS
} from './src/constants.js';

import User from './src/user.js';

const bot = new Telegraf(BOT_TOKEN);

const Statuses = {
  AWAIT_CODE_INPUT: 'AWAIT_CODE_INPUT'
}

let status = null;

let user = null;

bot.start((ctx) => {
  const currentUser = USERS.find((user) => user.chatId === ctx.from.id);

  if (currentUser) {
    user = new User(currentUser);
    ctx.reply(MESSAGES.startForUser, Markup.keyboard(
      [
        [
          Markup.button.callback('Обновить статусы', 'update'),
        ],
        [
          Markup.button.callback('Перестать отслеживать', 'stop'),
        ]
      ]
    ));
  } else {
    ctx.reply(MESSAGES.start);
    status = Statuses.AWAIT_CODE_INPUT;
  }
});

bot.command('test', (ctx) => {
  ctx.reply('test command handler', Markup.keyboard(
    [
      Markup.button.callback('add code', 'add code'),
      Markup.button.callback('add code 2', 'add code', true),
    ]
  ))
})

bot.action('add code', (ctx) => {
  status = Statuses.AWAIT_CODE_INPUT
});

bot.on('text', async (ctx) => {
  if (status === Statuses.AWAIT_CODE_INPUT) {
    status = null;

    const text = ctx.message.text;

    if (!user) {
      user = new User(ctx.from);
    }

    const newCode = await User.requestCode(text)
    user.updateCode(newCode)
    ctx.replyWithPhoto({
      source: fs.createReadStream(resolve(`./static/${newCode.internalStatus.percent}.png`))
    }, {
      caption: `
<b>Процент:</b> <b>${newCode.internalStatus.percent}</b>
<b>Документы поданы:</b> ${newCode.receptionDate}
<b>Статус:</b> ${newCode.passportStatus.name}
<b>Внутренний статус:</b> ${newCode.internalStatus.name}
      `,
      parse_mode: 'HTML'
    })
  } else {
    console.warn('on text default');
    ctx.reply('on text default')
  }
});

bot.catch(async (err, ctx) => {
  console.error(err);
});

bot.launch().then(() => {
  console.warn('BOT STARTED');
});
