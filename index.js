import fs from 'fs';
import { resolve } from 'path';
import { Telegraf, Markup } from 'telegraf';

import {
  BOT_TOKEN,
  MESSAGES,
} from './src/constants.js';
import User from './src/user.js';
import Code from './src/code.js';

const bot = new Telegraf(BOT_TOKEN);

const USERS = []
const getUserById = (id) => USERS.find((user) => user.id === id);
const updateUsers = (user) => {
  const foundIndex = USERS.findIndex((cur) => cur.id === user.id);
  if (foundIndex >= 0) {
    USERS[USERS.findIndex((cur) => cur.id === user.id)] = user;
  } else {
    USERS.push(user);
  }
}

const keyboardDefault = (currentUser) => {
  const res = []

  if (currentUser && currentUser.hasCodes) {
    currentUser.codes.forEach((code) => res.push(Markup.button.text(`Обновить ${code.shortUid}`)))
  }

  return res.length ? Markup.keyboard(res).resize() : []
}

const keyboardInlineSubscribe = (code, needHide = false) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Подписаться на обновления', `subscribe ${code.uid}`, needHide || !code.uid),
    ],
  ]).resize()
}

bot.start((ctx) => {
  let currentUser = getUserById(ctx.from.id);

  if (currentUser) {
    ctx.reply(MESSAGES.startForUser, {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser)
    });
  } else {
    if (!currentUser) {
      updateUsers(new User(ctx.from));
    }
    ctx.reply(MESSAGES.start, {
      parse_mode: 'HTML',
    });
  }
});

bot.action(/subscribe (.+)/, async (ctx) => {
  const codeUid = ctx.match[1];
  let currentUser = getUserById(ctx.from.id);

  if (!currentUser) {
    updateUsers(new User(ctx.from));
    currentUser = getUserById(ctx.from.id);
  }

  const isSubscribeEnableAlready = currentUser.codes.some((code) => code.uid === codeUid);

  if (isSubscribeEnableAlready) {
    ctx.reply(MESSAGES.subscribeEnableAlready(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser)
    });
  } else {
    currentUser.updateCode(await currentUser.requestCode(codeUid));
    updateUsers(currentUser);
    ctx.reply(MESSAGES.subscribeEnable(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser)
    });
  }
});

bot.on('text', async (ctx) => {
  let currentUser = getUserById(ctx.from.id);
  let needSubscribe = false;

  if (!currentUser) {
    updateUsers(new User(ctx.from));
    currentUser = getUserById(ctx.from.id);
  }

  try {
    const text = String(ctx.message.text).toLowerCase();
    let codeUid = text;

    if (text.startsWith('обновить')) {
      let shortUidToUpdate = text.match(/обновить (.+)/) && text.match(/обновить (.+)/)[1];

      if (Code.isShortValid(shortUidToUpdate)) {
        codeUid = currentUser.codes.find((code) => code.shortUid === shortUidToUpdate)?.uid;
        needSubscribe = true;
      } else {
        ctx.reply(MESSAGES.errorValidateCode, {
          parse_mode: 'HTML',
          ...keyboardDefault(currentUser),
        });
        return
      }
    }

    if (!Code.isValid(codeUid)) {
      ctx.reply(MESSAGES.errorValidateCode, {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });
      return
    }

    const newCode = await currentUser.requestCode(codeUid);
    const statusImagePath = resolve(`./static/${newCode.internalStatus.percent}.png`);
    const statusImage = fs.existsSync(statusImagePath) && fs.createReadStream(statusImagePath);

    if (needSubscribe && currentUser) {
      currentUser.updateCode(newCode);
    }

    if (statusImage) {
      ctx.replyWithPhoto({
        source: statusImage,
      }, {
        caption: newCode.status,
        parse_mode: 'HTML',
        ...keyboardInlineSubscribe(newCode, needSubscribe)
      });
    } else {
      ctx.reply(newCode.status, {
        parse_mode: 'HTML',
        ...keyboardInlineSubscribe(newCode, needSubscribe)
      })
    }
  } catch(e) {
    ctx.reply(e || MESSAGES.errorRequestCode, {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });
  }
});

bot.catch((err) => {
  console.error(err);
});

bot.launch().then(() => {
  console.warn('BOT STARTED');
});
