import fs from 'fs';
import { resolve } from 'path';
import { Telegraf, Markup } from 'telegraf';

import {
  BOT_TOKEN,
  MESSAGES,
} from './src/constants.js';

import User from './src/user.js';

const bot = new Telegraf(BOT_TOKEN);
const Statuses = {
  AWAIT_CODE_INPUT: 'AWAIT_CODE_INPUT',
}

const USERS = []
const USER_STATUSES = {}

const getUserById = (id) => {
  return USERS.find((user) => user.id === id)
}
const updateUsers = (user) => {
  const foundIndex = USERS.findIndex((cur) => cur.id === user.id);

  if (foundIndex >= 0) {
    USERS[USERS.findIndex((cur) => cur.id === user.id)] = user;
  } else {
    USERS.push(user);
  }
}

const keyboardMenu = (currentUser) => {
  const res = [
    [
      Markup.button.callback('Добавить заявление', Statuses.AWAIT_CODE_INPUT, !currentUser),
    ],
  ]

  if (currentUser && currentUser.hasCodes) {
    res.push(currentUser.codes.map((code) => Markup.button.callback(`Обновить ${code.uid}`, `update ${code.uid}`)))
  }

  return Markup.inlineKeyboard(res, {
    resize: true
  })
}

bot.start((ctx) => {
  let currentUser = getUserById(ctx.from.id);

  if (currentUser) {
    ctx.reply(MESSAGES.startForUser, keyboardMenu(currentUser));
  } else {
    updateUsers(new User(ctx.from));
    currentUser = getUserById(ctx.from.id);
    USER_STATUSES[currentUser.id] = Statuses.AWAIT_CODE_INPUT;
    ctx.reply(MESSAGES.start, keyboardMenu());
  }
});

bot.action(Statuses.AWAIT_CODE_INPUT, (ctx) => {
  const currentUser = getUserById(ctx.from.id);

  if (currentUser) {
    USER_STATUSES[currentUser.id] = Statuses.AWAIT_CODE_INPUT;

    ctx.reply('Введи номер заявления', {
      parse_mode: 'HTML',
    });
  }
});

bot.action(/update (.+)/, async (ctx) => {
  const currentUser = getUserById(ctx.from.id);
  const codeUid = ctx.match[1];

  if (currentUser) {
    USER_STATUSES[currentUser.id] = null;

    ctx.reply(`${currentUser.codes.find((code) => code.uid === codeUid).status}`, {
      parse_mode: 'HTML',
      ...keyboardMenu(currentUser)
    });
  }
});

bot.on('text', async (ctx) => {
  const currentUser = getUserById(ctx.from.id);

  if (currentUser && USER_STATUSES[currentUser.id] === Statuses.AWAIT_CODE_INPUT) {
    try {
      const text = ctx.message.text;
      // const newCode = new Code({ uid: ctx.message.text })
      const newCode = await currentUser.requestCode(text);
      const statusImagePath = resolve(`./static/${newCode.internalStatus.percent}.png`)
      const statusImage = fs.existsSync(statusImagePath) && fs.createReadStream(statusImagePath)

      currentUser.updateCode(newCode);

      USER_STATUSES[currentUser.id] = null;

      if (statusImage) {
        ctx.replyWithPhoto({
          source: statusImage,
        }, {
          caption: newCode.status,
          parse_mode: 'HTML',
          ...keyboardMenu(currentUser)
        });
      } else {
        ctx.reply(newCode.status, {
          parse_mode: 'HTML',
          ...keyboardMenu(currentUser)
        })
      }
    } catch(e) {
      USER_STATUSES[currentUser.id] = null;

      ctx.reply(e || MESSAGES.errorRequestCode, {
        parse_mode: 'HTML',
        ...keyboardMenu(currentUser)
      });
    }
  } else {
    USER_STATUSES[currentUser.id] = null;

    ctx.reply('on text default', {
      parse_mode: 'HTML',
      ...keyboardMenu(currentUser)
    });
  }
});

bot.catch((err) => {
  console.error(err);
});

bot.launch().then(() => {
  console.warn('BOT STARTED');
});
