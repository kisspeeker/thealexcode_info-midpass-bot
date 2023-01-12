import fs from 'fs';
import { resolve } from 'path';
import { Telegraf, Markup } from 'telegraf';
import { CronJob } from 'cron';

import {
  BOT_TOKEN,
  MESSAGES,
  ADMIN_CHAT_ID,
} from './src/constants.js';
import { getUsers, createUser, updateUser } from './src/api.js';
import User from './src/user.js';
import Code from './src/code.js';

const bot = new Telegraf(BOT_TOKEN);

let USERS = []
const requestUsers = async () => USERS = await getUsers() || [];
const getUserByChatId = (chatId) => {
  const foundUser = USERS.find((user) => user.chatId === String(chatId));
  if (foundUser) {
    return new User(foundUser)
  }
};
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
    await requestUsers();

    for (let i in USERS) {
      const currentUser = new User(USERS[i]);

      for (let ii in currentUser.codes) {
        const code = new Code(currentUser.codes[ii]);
        const newCode = await Code.requestCode(code.uid);

        if (code.hasChangesWith(newCode)) {
          const statusImage = getStatusImage(newCode);
          currentUser.updateUserCodes(newCode);
          await updateUser(currentUser);
          
          if (statusImage) {
            await bot.telegram.sendPhoto(currentUser.chatId, {
              source: statusImage
            }, {
              parse_mode: 'HTML',
              caption: MESSAGES.codeHasChanges(newCode.status),
            });
          } else {
            await bot.telegram.sendMessage(currentUser.chatId, MESSAGES.codeHasChanges(newCode.status), {
              parse_mode: 'HTML',
            });
          }
          await promiseTimeout(1000);
        }
      }
      console.warn('=====BEFORE promiseTimeout', currentUser.firstName);
      await promiseTimeout(10000);
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

bot.start(async (ctx) => {
  let currentUser = getUserByChatId(ctx.from.id);

  if (currentUser) {
    ctx.reply(MESSAGES.startForUser, {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser)
    });
  } else {
    if (!currentUser) {
      currentUser = new User(await createUser(new User({...ctx.from, isNew: true})));
      await requestUsers();
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
  let currentUser = getUserByChatId(ctx.from.id);

  if (!currentUser) {
    currentUser = new User(await createUser(new User({...ctx.from, isNew: true})));
    await requestUsers();
  }

  const isSubscribeEnableAlready = (currentUser.codes || []).some((code) => code.uid === codeUid);

  if (isSubscribeEnableAlready) {
    ctx.reply(MESSAGES.subscribeEnableAlready(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser)
    });
  } else {
    currentUser.updateUserCodes(await Code.requestCode(codeUid));
    await updateUser(currentUser);
    await requestUsers();
    ctx.reply(MESSAGES.subscribeEnable(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser)
    });
  }
});

bot.on('text', async (ctx) => {
  let currentUser = getUserByChatId(ctx.from.id);
  let isUpdatingCode = false;

  if (!currentUser) {
    currentUser = new User(await createUser(new User({...ctx.from, isNew: true})));
    await requestUsers();
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
        const currentUserCode = new Code(currentUser.codes.find((code) => code.shortUid === shortUidToUpdate));
        codeUid = currentUserCode?.uid;

        if (new Date() - new Date(currentUserCode.updateTime) < 30000) {
          const statusImage = getStatusImage(currentUserCode);
          if (statusImage) {
            ctx.replyWithPhoto({
              source: statusImage,
            }, {
              caption: currentUserCode.status,
              parse_mode: 'HTML',
              ...keyboardInlineSubscribe(currentUserCode, true)
            });
          } else {
            ctx.reply(currentUserCode.status, {
              parse_mode: 'HTML',
              ...keyboardInlineSubscribe(currentUserCode, true)
            })
          }
          return
        }
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

requestUsers().then(() => {
  bot.launch()
  console.warn('BOT STARTED');
})
