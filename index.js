import fs from 'fs';
import { resolve } from 'path';
import { Telegraf, Markup } from 'telegraf';
import { CronJob } from 'cron';

import {
  BOT_TOKEN,
  MESSAGES,
  ADMIN_CHAT_ID,
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
const sendMessageToAdmin = (message = '') => {
  bot.telegram.sendMessage(ADMIN_CHAT_ID, message, {
    parse_mode: 'HTML',
  });
}
const getStatusImage = (code = {}) => {
  const statusImagePath = resolve(`./static/${code?.internalStatus?.percent}.png`);
  if (fs.existsSync(statusImagePath)) {
    return fs.createReadStream(statusImagePath);
  }
}
const promiseTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isAdmin = (ctx = {}) => String(ctx.from.id) === ADMIN_CHAT_ID;

const job = new CronJob('0 0 */1 * * *', async function() {
  try {
    for (let i in USERS) {
      const currentUser = USERS[i];

      for (let ii in currentUser.codes) {
        const code = currentUser.codes[ii];
        const newCode = await Code.requestCode(code.uid);

        if (code.hasChangesWith(newCode)) {
          const statusImage = getStatusImage(newCode);
          currentUser.updateUserCodes(newCode);
          
          if (statusImage) {
            await bot.telegram.sendPhoto(currentUser.id, {
              source: statusImage
            }, {
              parse_mode: 'HTML',
              caption: MESSAGES.codeHasChanges(newCode.status),
            });
          } else {
            await bot.telegram.sendMessage(currentUser.id, MESSAGES.codeHasChanges(newCode.status), {
              parse_mode: 'HTML',
            });
          }
        }
      }
      console.warn('=====BEFORE promiseTimeout', currentUser.firstName);
      await promiseTimeout(5000);
      console.warn('=====AFTER promiseTimeout', currentUser.firstName);
    }
  } catch(e) {
    console.error(e);
    sendMessageToAdmin(`<b>Ошибка CronJob:</b> \n${e}`)
  }
});
job.start();

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
      currentUser = getUserById(ctx.from.id);
    }
    ctx.reply(MESSAGES.start, {
      parse_mode: 'HTML',
    });
  }
  if (!isAdmin(ctx)) {
    sendMessageToAdmin(MESSAGES.newUser(currentUser))
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
    currentUser.updateUserCodes(await Code.requestCode(codeUid));
    updateUsers(currentUser);
    ctx.reply(MESSAGES.subscribeEnable(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser)
    });
  }
});

bot.on('text', async (ctx) => {
  let currentUser = getUserById(ctx.from.id);
  let isUpdatingCode = false;

  if (!currentUser) {
    updateUsers(new User(ctx.from));
    currentUser = getUserById(ctx.from.id);
  }

  try {
    const text = String(ctx.message.text).toLowerCase();
    let codeUid = text;

    if (isAdmin(ctx) && text.startsWith('написать')) {
      const userId = text.split(' ')[1];
      const messageToUser = text.split(' ').slice(2).join(' ');

      bot.telegram.sendMessage(userId, messageToUser, {
        parse_mode: 'HTML',
      });
      bot.telegram.sendMessage(ADMIN_CHAT_ID, `Успешно написал пользователю ${userId}. Сообщение: \n\n${messageToUser}`, {
        parse_mode: 'HTML',
      });
      return
    }

    if (text.startsWith('обновить')) {
      let shortUidToUpdate = text.match(/обновить (.+)/) && text.match(/обновить (.+)/)[1];

      if (Code.isShortValid(shortUidToUpdate)) {
        codeUid = currentUser.codes.find((code) => code.shortUid === shortUidToUpdate)?.uid;
        isUpdatingCode = true;
      } else {
        ctx.reply(MESSAGES.errorValidateCode, {
          parse_mode: 'HTML',
          ...keyboardDefault(currentUser),
        });
        return
      }
    }

    if (!Code.isValid(codeUid)) {
      if (!isAdmin(ctx)) {
        sendMessageToAdmin(MESSAGES.userMessageWithoutUid(currentUser, text))
      }

      ctx.reply(MESSAGES.errorValidateCode, {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });
      return
    }

    const newCode = await Code.requestCode(codeUid);
    const statusImage = getStatusImage(newCode);

    if (isUpdatingCode && currentUser) {
      currentUser.updateUserCodes(newCode);
    }

    if (statusImage) {
      ctx.replyWithPhoto({
        source: statusImage,
      }, {
        caption: newCode.status,
        parse_mode: 'HTML',
        ...keyboardInlineSubscribe(newCode, isUpdatingCode)
      });
    } else {
      ctx.reply(newCode.status, {
        parse_mode: 'HTML',
        ...keyboardInlineSubscribe(newCode, isUpdatingCode)
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
