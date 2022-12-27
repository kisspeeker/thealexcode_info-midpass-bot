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
const keyboard = Markup.keyboard([
  [
    Markup.button.callback('Главное меню', 'clear status', !!status),
  ]
])

bot.start((ctx) => {
  const currentUser = USERS.find((user) => user.chatId === ctx.from.id);

  if (currentUser) {
    user = new User(currentUser);
    ctx.reply(MESSAGES.startForUser, keyboard);
  } else {
    ctx.reply(MESSAGES.start);
    status = Statuses.AWAIT_CODE_INPUT;
  }
});

bot.action('add code', () => {
  status = Statuses.AWAIT_CODE_INPUT;
});

bot.action('clear status', () => {
  status = null;
});

bot.on('text', async (ctx) => {
  try {
    if (status === Statuses.AWAIT_CODE_INPUT) {
      const text = ctx.message.text;
      const newCode = await User.requestCode(text);
      const statusImagePath = resolve(`./static/${newCode.internalStatus.percent}.png`)
      const statusImage = fs.existsSync(statusImagePath) && fs.createReadStream(statusImagePath)

      if (!user) {
        user = new User(ctx.from);
      }
      
      user.updateCode(newCode);
      
      if (statusImage) {
        ctx.replyWithPhoto({
          source: statusImage,
        }, {
          caption: MESSAGES.status(newCode),
          parse_mode: 'HTML'
        });
      } else {
        ctx.reply(MESSAGES.status(newCode), {
          parse_mode: 'HTML'
        })
      }

      status = null;
    } else {
      console.warn('on text default');
      ctx.reply('on text default');
    }
  } catch(e) {
    ctx.reply(e);
  }
});

bot.catch((err) => {
  console.error(err);
});

bot.launch().then(() => {
  console.warn('BOT STARTED');
});
