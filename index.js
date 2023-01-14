import fs from 'fs';
import { resolve } from 'path';
import { Telegraf, Markup } from 'telegraf';
import { CronJob } from 'cron';

import {
  BOT_TOKEN,
  MESSAGES,
  ADMIN_CHAT_ID,
  LOGS_TYPES,
} from './src/constants.js';
import { getUsers, createUser, updateUser, logMessage } from './src/api.js';
import User from './src/user.js';
import Code from './src/code.js';

const bot = new Telegraf(BOT_TOKEN);

let USERS = []
const promiseTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isAdmin = (ctx = {}) => String(ctx.from.id) === ADMIN_CHAT_ID;
const requestUsers = async () => USERS = await getUsers() || [];
const getUserByChatId = (chatId) => {
  const foundUser = USERS.find((user) => user.chatId === String(chatId));
  if (foundUser) {
    return new User(foundUser)
  }
};
const sendMessageToAdmin = async (message = '') => {
  await bot.telegram.sendMessage(ADMIN_CHAT_ID, message, {
    parse_mode: 'HTML',
  });
};
const getStatusImage = (code = {}) => {
  const statusImagePath = resolve(`./static/${code?.internalStatus?.percent}.png`);
  if (fs.existsSync(statusImagePath)) {
    return fs.createReadStream(statusImagePath);
  }
};
const keyboardDefault = (currentUser) => {
  const res = []
  if (currentUser && currentUser.hasCodes) {
    currentUser.codes.forEach((code) => res.push(Markup.button.text(`Обновить ${code.shortUid} 🔄`)))
  }
  if (res.length) {
    res.push(Markup.button.text(`Отписаться ❌`))
  }
  return res.length ? Markup.keyboard(res).resize() : []
};
const keyboardInlineSubscribe = (code, needHide = false) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Подписаться на обновления', `subscribe ${code.uid}`, needHide || !code.uid),
    ],
  ]).resize()
};
const keyboardInlineUnsubscribe = (currentUser) => {
  const res = []
  if (currentUser && currentUser.hasCodes) {
    currentUser.codes.forEach((code) => res.push([Markup.button.callback(`Отписаться от ${code.shortUid} ❌`, `unsubscribe ${code.uid}`)]))
  }
  return res.length ? Markup.inlineKeyboard(res).resize() : [];
};
const sendCodeStatusToUser = async (
  currentUser = {}, 
  newCode = {}, 
  needHideKeyboard = false, 
  hasChanges = false
) => {
  const statusImage = getStatusImage(newCode);

  if (statusImage) {
    await bot.telegram.sendPhoto(currentUser.chatId, {
      source: statusImage
    }, {
      parse_mode: 'HTML',
      caption: hasChanges ? MESSAGES.codeHasChanges(newCode.status) : newCode.status,
      ...keyboardInlineSubscribe(newCode, needHideKeyboard),
    });
  } else {
    await bot.telegram.sendMessage(currentUser.chatId, hasChanges ? MESSAGES.codeHasChanges(newCode.status) : newCode.status, {
      parse_mode: 'HTML',
      ...keyboardInlineSubscribe(newCode, needHideKeyboard),
    });
  }
};

const job = new CronJob('0 0 */1 * * *', async function() {
  try {
    await requestUsers();

    for (let i in USERS) {
      const currentUser = new User(USERS[i]);

      for (let ii in currentUser.codes) {
        const code = new Code(currentUser.codes[ii]);
        const newCode = await Code.requestCode(code.uid);
        const hasChanges = code.hasChangesWith(newCode);

        if (hasChanges) {
          currentUser.updateUserCodes(newCode);
          
          await updateUser(currentUser);
          await sendCodeStatusToUser(currentUser, code, true, true);
          await promiseTimeout(1000);
          await logMessage({
            type: LOGS_TYPES.autoUpdateWithChanges,
            user: currentUser,
            message: `Code with changes: ${newCode.uid}`,
          });
          await sendMessageToAdmin(`<b>🔥🔥 У пользователя изменился статус заявления!</b> \n\n<b>User:</b> ${currentUser.chatId || currentUser.id || currentUser.userName} \n<b>Code:</b> ${newCode.uid}`);
        }
      }
      await promiseTimeout(10000);
    }
  } catch(e) {
    console.error(e);
    await sendMessageToAdmin(`<b>Ошибка CronJob:</b> \n${e}`);
    await logMessage({
      type: LOGS_TYPES.error,
      message: `Ошибка CronJob: ${e}`,
    });
  }
});
job.start();

bot.start(async (ctx) => {
  let currentUser = getUserByChatId(ctx.from.id);

  if (currentUser) {
    ctx.reply(MESSAGES.startForUser, {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
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
    await sendMessageToAdmin(MESSAGES.newUser(currentUser));
    await logMessage({
      type: LOGS_TYPES.successStart,
      user: currentUser,
    });
  }
});

bot.action(/unsubscribe (.+)/, async (ctx) => {
  const codeUid = ctx.match[1];
  let currentUser = getUserByChatId(ctx.from.id);
  
  if (!currentUser) {
    return;
  }

  currentUser.removeUserCode(codeUid);
  await updateUser(currentUser);
  await requestUsers();
  let replyOptions = {
    parse_mode: 'HTML',
  }
  if (keyboardDefault(currentUser) && keyboardDefault(currentUser).length) {
    replyOptions = {
      ...replyOptions,
      ...keyboardDefault(currentUser),
    }
  } else {
    replyOptions.reply_markup = { remove_keyboard: true }
  }
  await logMessage({
    type: LOGS_TYPES.unsubscribeEnable,
    user: currentUser,
    message: `unsubscribe code: ${codeUid}`,
  });
  ctx.reply(MESSAGES.unsubscribeEnable(codeUid), replyOptions);
});

bot.action(/subscribe (.+)/, async (ctx) => {
  const codeUid = ctx.match[1];
  let currentUser = getUserByChatId(ctx.from.id);
  
  if (!currentUser) {
    return;
  }

  const isSubscribeEnableAlready = (currentUser.codes || []).some((code) => code.uid === codeUid);

  if (isSubscribeEnableAlready) {
    ctx.reply(MESSAGES.subscribeEnableAlready(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });
  } else {
    currentUser.updateUserCodes(await Code.requestCode(codeUid));
    await updateUser(currentUser);
    await requestUsers();
    ctx.reply(MESSAGES.subscribeEnable(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });

    await logMessage({
      type: LOGS_TYPES.subscribeEnable,
      user: currentUser,
      message: `subscribe code: ${codeUid}`,
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

    if (text.startsWith('отписаться')) {
      ctx.reply(MESSAGES.unsubscribe, {
        parse_mode: 'HTML',
        ...keyboardInlineUnsubscribe(currentUser),
      });
      return;
    }

    if (isAdmin(ctx) && text.startsWith('написать')) {
      const userId = text.split(' ')[1];
      const messageToUser = text.split(' ').slice(2).join(' ');
      
      await bot.telegram.sendMessage(userId, messageToUser, {
        parse_mode: 'HTML',
      });
      await sendMessageToAdmin(`Успешно написал пользователю ${userId}. Сообщение: \n\n${messageToUser}`);
      return;
    }

    if (text.startsWith('обновить')) {
      let shortUidToUpdate = text.match(/обновить (.+) (.+)/) && text.match(/обновить (.+) (.+)/)[1];

      if (Code.isShortValid(shortUidToUpdate)) {
        const currentUserCode = new Code(currentUser.codes.find((code) => code.shortUid === shortUidToUpdate));
        codeUid = currentUserCode?.uid;

        if (new Date() - new Date(currentUserCode.updateTime) < 30000) {
          await sendCodeStatusToUser(currentUser, currentUserCode, true);
          return;
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
        await sendMessageToAdmin(MESSAGES.userMessageWithoutUid(currentUser, text));
      }
      await logMessage({
        type: LOGS_TYPES.message,
        user: currentUser,
        message: text,
      });

      ctx.reply(MESSAGES.errorValidateCode, {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });
      return
    }

    const newCode = await Code.requestCode(codeUid);

    if (isUpdatingCode && currentUser) {
      currentUser.updateUserCodes(newCode);
    }

    if (newCode) {
      await sendCodeStatusToUser(currentUser, newCode, isUpdatingCode);
    }
    await logMessage({
      type: LOGS_TYPES.successCodeStatus,
      user: currentUser,
      message: `Code: ${newCode?.uid || '-'}`,
    });
    
  } catch(e) {
    console.error(e);
    // ctx.reply(e || MESSAGES.errorRequestCode, {
    //   parse_mode: 'HTML',
    //   ...keyboardDefault(currentUser),
    // });
    // await logMessage({
    //   type: LOGS_TYPES.error,
    //   user: currentUser,
    //   message: e || MESSAGES.errorRequestCode,
    // });
  }
});

bot.catch((err) => {
  console.error('=== BOT CATCH ===', err);
});

requestUsers().then(() => {
  bot.launch();
  console.warn('BOT STARTED');
})
