import fs from 'fs';
import { resolve } from 'path';
import { Telegraf, Markup } from 'telegraf';
import { CronJob } from 'cron';

import {
  BOT_TOKEN,
  ADMIN_CHAT_ID,
  START_CRONJOB_IMMEDIATELY,
  CRONJOB_SCHEDULES,
  Messages,
  LogsTypes,
  Timeouts,
  MetaKeys
} from './src/constants.js';
import {
  getCodeFromMidpass,
  getUserByChatId,
  getUsersWithCodes,
  createUser,
  updateUser,
  logMessage
} from './src/api.js';
import User from './src/user.js';
import Code from './src/code.js';

export const bot = new Telegraf(BOT_TOKEN);

const USERS_DEBOUNCE = {};

const isUserDebounced = (chatId = '', delay = Timeouts.TEXT) => USERS_DEBOUNCE[chatId] && (Date.now() - USERS_DEBOUNCE[chatId]) < delay;
const setUserDebounce = (chatId = '') => USERS_DEBOUNCE[chatId] = Date.now();
const promiseTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isAdmin = (ctx = {}) => String(ctx.from.id) === ADMIN_CHAT_ID;
const requestUserByChatId = async (chatId) => {
  const foundUser = await getUserByChatId(chatId);
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
      caption: hasChanges ? Messages.CODE_HAS_CHANGES(newCode.status) : newCode.status,
      ...keyboardInlineSubscribe(newCode, needHideKeyboard),
    });
  } else {
    await bot.telegram.sendMessage(currentUser.chatId, hasChanges ? Messages.CODE_HAS_CHANGES(newCode.status) : newCode.status, {
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
    await sendMessageToAdmin(Messages.ERROR_BLOCK_BY_USER(currentUser));
  }
}
const autoUpdateUsers = async () => {
  let counterUsersChecked = 0
  let counterCodes = 0
  let counterCodesUpdated = 0

  try {
    const usersWithCodes = await getUsersWithCodes();
    const filteredUsers = usersWithCodes.filter(user => {
      return Array.isArray(user.codes) &&
      user.codes.length &&
      !user.codes.every((code) => Code.isComplete(code))
    });

    await logMessage({
      type: LogsTypes.START_CRONJOB,
      message: Messages.START_CRONJOB(filteredUsers.length),
      messageToAdmin: Messages.START_CRONJOB(filteredUsers.length),
      meta: {
        [MetaKeys.COUNTER_USERS_WITH_CODES]: filteredUsers.length
      }
    })

    for (let i in filteredUsers) {
      const currentUser = new User(filteredUsers[i]);
      counterUsersChecked++;

      for (let ii in currentUser.codes) {
        try {
          const code = new Code(currentUser.codes[ii]);

          if (Code.isComplete(code)) {
            await promiseTimeout(Timeouts.CRONJOB_NEXT_USER_CODE);
            continue;
          }

          const newCode = await getCodeFromMidpass(code.uid);
          const hasChanges = code.hasChangesWith(newCode);

          counterCodes++;

          if (hasChanges) {
            currentUser.updateUserCodes(newCode);

            await updateUser(currentUser);
            await sendCodeStatusToUser(currentUser, newCode, true, true);
            await promiseTimeout(Timeouts.CRONJOB_NEXT_USER_CODE);
            await logMessage({
              type: LogsTypes.AUTOUPDATE_WITH_CHANGES,
              user: currentUser,
              message: Messages.AUTOUPDATE_WITH_CHANGES(currentUser, newCode),
              messageToAdmin: Messages.AUTOUPDATE_WITH_CHANGES(currentUser, newCode),
              meta: {
                [MetaKeys.CODE]: newCode
              }
            });

            counterCodesUpdated++;
          } else {
            await logMessage({
              type: LogsTypes.AUTOUPDATE_WITHOUT_CHANGES,
              user: currentUser,
              message: Messages.AUTOUPDATE_WITHOUT_CHANGES(currentUser, newCode),
              meta: {
                [MetaKeys.CODE]: newCode
              }
            });
          }
        } catch(ee) {
          await removeCodesOfBlockedUser(ee);
          await logMessage({
            type: LogsTypes.ERROR_CRONJOB_USER_CODE,
            user: currentUser,
            message: Messages.ERROR_CRONJOB(ee, 'USERCODE', currentUser.codes[ii]),
            messageToAdmin: Messages.ERROR_CRONJOB(ee, 'USERCODE', currentUser.codes[ii]),
            meta: {
              [MetaKeys.CODE_UID]: currentUser.codes[ii]
            }
          });
          continue;
        }
      }
      await promiseTimeout(Timeouts.CRONJOB_NEXT_USER);
    }
  } catch(e) {
    await logMessage({
      type: LogsTypes.ERROR_CRONJOB_ROOT,
      message: Messages.ERROR_CRONJOB(e, 'ROOT'),
      messageToAdmin: Messages.ERROR_CRONJOB(e, 'ROOT'),
    });
  } finally {
    await logMessage({
      type: LogsTypes.END_CRONJOB,
      message: Messages.END_CRONJOB(counterUsersChecked, counterCodes, counterCodesUpdated),
      messageToAdmin: Messages.END_CRONJOB(counterUsersChecked, counterCodes, counterCodesUpdated),
      meta: {
        [MetaKeys.COUNTER_USERS_CHECKED]: counterUsersChecked,
        [MetaKeys.COUNTER_CODES]: counterCodes,
        [MetaKeys.COUNTER_CODES_UPDATED]: counterCodesUpdated,
      }
    });
  }
}

CRONJOB_SCHEDULES.forEach((schedule) => {
  const job = new CronJob(schedule, autoUpdateUsers, null, true, 'Europe/Moscow');
  job.start();
})

bot.start(async (ctx) => {
  if (isUserDebounced(ctx.from.id, Timeouts.START)) {
    setUserDebounce(ctx.from.id);
    return;
  }
  setUserDebounce(ctx.from.id);

  let currentUser = await requestUserByChatId(ctx.from.id);

  if (currentUser) {
    ctx.reply(Messages.START_FOR_USER(), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });
  } else {
    currentUser = new User(await createUser(new User({...ctx.from, isNew: true})));
    ctx.reply(Messages.START(), {
      parse_mode: 'HTML',
    });
    if (!isAdmin(ctx)) {
      await logMessage({
        type: LogsTypes.SUCCESS_START,
        user: currentUser,
        message: Messages.NEW_USER(currentUser),
        messageToAdmin: Messages.NEW_USER(currentUser),
      });
    }
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
    type: LogsTypes.UNSUBSCRIBE_ENABLE,
    user: currentUser,
    message: `${codeUid}`,
    meta: {
      [MetaKeys.CODE_UID]: codeUid
    }
  });
  ctx.reply(Messages.UNSUBSCRIBE_ENABLE(codeUid), replyOptions);
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
    ctx.reply(Messages.SUBSCRIBE_ENABLE_ALREADY(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });
  } else {
    currentUser.updateUserCodes(await getCodeFromMidpass(codeUid));
    await updateUser(currentUser);
    ctx.reply(Messages.SUBSCRIBE_ENABLE(codeUid), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });

    await logMessage({
      type: LogsTypes.SUBSCRIBE_ENABLE,
      user: currentUser,
      message: `${codeUid}`,
      meta: {
        [MetaKeys.CODE_UID]: codeUid
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
      ctx.reply(Messages.UNSUBSCRIBE, {
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
        await sendMessageToAdmin(Messages.SUCCESS_SEND_TO_USER(userId, messageToUser));
      } catch(e) {
        console.error(Messages.ERROR_SEND_TO_USER(userId, e));
        await sendMessageToAdmin(Messages.ERROR_SEND_TO_USER(userId, e));
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
        ctx.reply(Messages.ERROR_VALIDATE_CODE, {
          parse_mode: 'HTML',
          ...keyboardDefault(currentUser),
        });
        return
      }
    }

    if (!Code.isValid(codeUid)) {
      await logMessage({
        type: LogsTypes.MESSAGE,
        user: currentUser,
        message: Messages.USER_MESSAGE_WITHOUT_UID(currentUser, text),
        messageToAdmin: Messages.USER_MESSAGE_WITHOUT_UID(currentUser, text),
      });

      ctx.reply(Messages.ERROR_VALIDATE_CODE, {
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
      type: LogsTypes.SUCCESS_CODE_STATUS,
      user: currentUser,
      message: `${newCode?.uid || '-'}`,
      meta: {
        [MetaKeys.CODE]: newCode
      }
    });

  } catch(e) {
    ctx.reply(e || Messages.ERROR_REQUEST_CODE, {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });
    await logMessage({
      type: LogsTypes.ERROR,
      user: currentUser,
      message: Messages.ERROR_REQUEST_CODE_WITH_USER(currentUser, ctx.message.text),
      messageToAdmin: Messages.ERROR_REQUEST_CODE_WITH_USER(currentUser, ctx.message.text),
    });
  }
});

bot.catch((err) => {
  console.error('=== BOT CATCH ===', err);
});

if (START_CRONJOB_IMMEDIATELY) {
  bot.launch()
  autoUpdateUsers();
  console.log('BOT STARTED WITH START_CRONJOB_IMMEDIATELY');
} else {
  getUsersWithCodes().then((data) => {
    bot.launch();
    console.log('BOT STARTED! UsersWithCodes:', data.length);
  })
}

