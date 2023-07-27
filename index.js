import fs from 'fs';
import { resolve } from 'path';
import { Telegraf, Markup } from 'telegraf';
import { CronJob } from 'cron';

import {
  BOT_TOKEN,
  MESSAGES,
  ADMIN_CHAT_ID,
  LOGS_TYPES,
  TIMEOUTS
} from './src/constants.js';
import {
  getCodeFromMidpass,
  getUsers,
  createUser,
  updateUser,
  logMessage
} from './src/api.js';
import User from './src/user.js';
import Code from './src/code.js';

const bot = new Telegraf(BOT_TOKEN);

const USERS_DEBOUNCE = {};

const isUserDebounced = (chatId = '', delay = TIMEOUTS.text) => USERS_DEBOUNCE[chatId] && (Date.now() - USERS_DEBOUNCE[chatId]) < delay;
const setUserDebounce = (chatId = '') => USERS_DEBOUNCE[chatId] = Date.now();
const promiseTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isAdmin = (ctx = {}) => String(ctx.from.id) === ADMIN_CHAT_ID;
const requestUserByChatId = async (chatId) => {
  const foundUser = (await getUsers()).find((user) => String(user.chatId) === String(chatId));
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
const removeCodesOfBlockedUser = async (e = {}) => {
  if (e && e.response && e.response.error_code && e.on && e.on.payload && e.on.payload.chat_id) {
    let currentUser = await requestUserByChatId(e.on.payload.chat_id);

    if (!currentUser) {
      return;
    }

    currentUser.removeAllUserCodes();
    await updateUser(currentUser);
    await sendMessageToAdmin(MESSAGES.errorBlockByUser(currentUser));
  }
}

const job = new CronJob('0 0 */4 * * *', async function() {
  try {
    const allUsers = await getUsers();
    const filteredUsers = allUsers.filter(user => Array.isArray(user.codes) && user.codes.length);

    for (let i in filteredUsers) {
      const currentUser = new User(filteredUsers[i]);

      for (let ii in currentUser.codes) {
        try {
          const code = new Code(currentUser.codes[ii]);
          const newCode = await getCodeFromMidpass(code.uid);
          const hasChanges = code.hasChangesWith(newCode);

          if (hasChanges) {
            currentUser.updateUserCodes(newCode);

            await updateUser(currentUser);
            await sendCodeStatusToUser(currentUser, newCode, true, true);
            await promiseTimeout(TIMEOUTS.cronNextUserCode);
            await logMessage({
              type: LOGS_TYPES.autoUpdateWithChanges,
              user: currentUser,
              message: `codeUid: ${newCode.uid}`,
              meta: {
                'CODE': newCode
              }
            });
            await sendMessageToAdmin(MESSAGES.userCodeHasChanges(currentUser, newCode));
          }
        } catch(ee) {
          console.error(MESSAGES.errorCronJob(ee, 'USERCODE', currentUser.codes[ii]));
          await sendMessageToAdmin(MESSAGES.errorCronJob(ee, 'USERCODE', currentUser.codes[ii]));
          await removeCodesOfBlockedUser(ee);
          await logMessage({
            type: LOGS_TYPES.errorCronJobUserCode,
            user: currentUser,
            message: MESSAGES.errorCronJob(ee, 'USERCODE'),
            meta: {
              'CODE_UID': currentUser.codes[ii]
            }
          });
          continue;
        }
      }
      await promiseTimeout(TIMEOUTS.cronNextUser);
    }
  } catch(e) {
    console.error(MESSAGES.errorCronJob(e, 'ROOT'));
    await sendMessageToAdmin(MESSAGES.errorCronJob(e, 'ROOT'));
    await logMessage({
      type: LOGS_TYPES.errorCronJobRoot,
      message: MESSAGES.errorCronJob(e, 'ROOT'),
    });
  }
});
job.start();

bot.start(async (ctx) => {
  if (isUserDebounced(ctx.from.id, TIMEOUTS.start)) {
    setUserDebounce(ctx.from.id);
    return;
  }
  setUserDebounce(ctx.from.id);

  let currentUser = await requestUserByChatId(ctx.from.id);

  if (currentUser) {
    ctx.reply(MESSAGES.startForUser, {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });
  } else {
    currentUser = new User(await createUser(new User({...ctx.from, isNew: true})));
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
  if (isUserDebounced(ctx.from.id)) {
    setUserDebounce(ctx.from.id);
    return;
  }
  setUserDebounce(ctx.from.id);

  const codeUid = ctx.match[1];
  let currentUser = await requestUserByChatId(ctx.from.id);

  if (!currentUser) {
    return;
  }

  currentUser.removeUserCode(codeUid);
  await updateUser(currentUser);

  let replyOptions = {
    parse_mode: 'HTML',
  }
  if (keyboardDefault(currentUser) && keyboardDefault(currentUser)?.reply_markup?.keyboard?.length) {
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
    message: `${codeUid}`,
    meta: {
      'CODE_UID': codeUid
    }
  });
  ctx.reply(MESSAGES.unsubscribeEnable(codeUid), replyOptions);
});

bot.action(/subscribe (.+)/, async (ctx) => {
  if (isUserDebounced(ctx.from.id)) {
    setUserDebounce(ctx.from.id);
    return;
  }
  setUserDebounce(ctx.from.id);

  const codeUid = ctx.match[1];
  let currentUser = await requestUserByChatId(ctx.from.id);

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
    currentUser.updateUserCodes(await getCodeFromMidpass(codeUid));
    await updateUser(currentUser);
    ctx.reply(MESSAGES.subscribeEnable(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });

    await logMessage({
      type: LOGS_TYPES.subscribeEnable,
      user: currentUser,
      message: `codeUid: ${codeUid}`,
      meta: {
        'CODE_UID': codeUid
      }
    });
  }
});

bot.on('text', async (ctx) => {
  if (isUserDebounced(ctx.from.id)) {
    setUserDebounce(ctx.from.id);
    return;
  }
  setUserDebounce(ctx.from.id);

  let currentUser = await requestUserByChatId(ctx.from.id);
  let isUpdatingCode = false;

  if (!currentUser) {
    currentUser = new User(await createUser(new User({...ctx.from, isNew: true})));
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

      try {
        await bot.telegram.sendMessage(userId, messageToUser, {
          parse_mode: 'HTML',
          disable_notification: true
        });
        await sendMessageToAdmin(MESSAGES.successSendToUser(userId, messageToUser));
      } catch(e) {
        console.error(MESSAGES.errorSendToUser(userId, e));
        await sendMessageToAdmin(MESSAGES.errorSendToUser(userId, e));
      }

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

    const newCode = await getCodeFromMidpass(codeUid);

    if (isUpdatingCode && currentUser) {
      currentUser.updateUserCodes(newCode);
    }

    if (newCode) {
      await sendCodeStatusToUser(currentUser, newCode, isUpdatingCode);
    }
    await logMessage({
      type: LOGS_TYPES.successCodeStatus,
      user: currentUser,
      message: `codeUid: ${newCode?.uid || '-'}`,
      meta: {
        'CODE': newCode
      }
    });

  } catch(e) {
    console.error(MESSAGES.errorRequestCodeWithUser(currentUser, ctx.message.text));
    ctx.reply(e || MESSAGES.errorRequestCode, {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });
    await logMessage({
      type: LOGS_TYPES.error,
      user: currentUser,
      message: MESSAGES.errorRequestCodeWithUser(currentUser, ctx.message.text),
    });
    await sendMessageToAdmin(MESSAGES.errorRequestCodeWithUser(currentUser, ctx.message.text));
  }
});

bot.catch((err) => {
  console.error('=== BOT CATCH ===', err);
});

getUsers().then(() => {
  bot.launch();
  console.warn('BOT STARTED');
})
