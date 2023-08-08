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
import { calculateTimeDifference } from './src/utils.js'

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
  const res = [
    [
      Markup.button.text('FAQ ℹ️'),
      Markup.button.text('Расписание 🕔')
    ],
  ]
  if (currentUser && currentUser.hasCodes) {
    currentUser.codes.forEach((code) => res.push([Markup.button.text(`Статус ${code.shortUid} 🔄`)]))
    res.push([Markup.button.text(`Отписаться ❌`)])
  }
  return res.length ? Markup.keyboard(res).resize() : []
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
    });
  } else {
    await bot.telegram.sendMessage(currentUser.chatId, hasChanges ? Messages.CODE_HAS_CHANGES(newCode.status) : newCode.status, {
      parse_mode: 'HTML',
    });
  }
};
const removeBlockedUserCodes = async (e = {}) => {
  let currentUser = await requestUserByChatId(e?.on?.payload?.chat_id);

  if (!currentUser) {
    return;
  }

  currentUser.removeAllUserCodes();
  await updateUser(currentUser);
  await logMessage({
    type: LogsTypes.ERROR_BLOCK_BY_USER,
    user: currentUser,
    message: Messages.ERROR_BLOCK_BY_USER(currentUser),
    messageToAdmin: Messages.ERROR_BLOCK_BY_USER(currentUser),
  })
}
const autoUpdateUsers = async () => {
  const startDate = new Date()
  let counterUsersChecked = 0
  let counterCodes = 0
  let counterCodesUpdated = 0
  let counterCodesError = 0

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
            continue;
          }

          // если у пользователя несколько заявлений, то ждем таймаут перед запросом
          if (ii) {
            await promiseTimeout(Timeouts.CRONJOB_NEXT_USER_CODE);
          }

          const newCode = await getCodeFromMidpass(code.uid);
          const hasChanges = code.hasChangesWith(newCode);

          currentUser.updateUserCodes(newCode);
          await updateUser(currentUser);

          counterCodes++;

          if (hasChanges) {
            await sendCodeStatusToUser(currentUser, newCode, true, true);
            await logMessage({
              type: LogsTypes.AUTOUPDATE_WITH_CHANGES,
              user: currentUser,
              message: Messages.AUTOUPDATE_WITH_CHANGES(currentUser, newCode, i),
              meta: {
                [MetaKeys.CODE]: newCode
              }
            });

            counterCodesUpdated++;
          } else {
            await logMessage({
              type: LogsTypes.AUTOUPDATE_WITHOUT_CHANGES,
              user: currentUser,
              message: Messages.AUTOUPDATE_WITHOUT_CHANGES(currentUser, newCode, i),
              meta: {
                [MetaKeys.CODE]: newCode
              }
            });
          }
        } catch(ee) {
          counterCodesError++
          const isBlockedUser = ee && ee.response && ee.response.error_code && ee.on && ee.on.payload && ee.on.payload.chat_id;

          if (isBlockedUser) {
            await removeBlockedUserCodes(ee);
          } else {
            currentUser.updateUserCodes(new Code(currentUser.codes[ii]));
            await updateUser(currentUser);
          }

          await logMessage({
            type: LogsTypes.ERROR_CRONJOB_USER_CODE,
            user: currentUser,
            message: Messages.ERROR_CRONJOB(ee, 'USERCODE', currentUser.codes[ii]),
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
    const cronjobDuration = calculateTimeDifference(startDate)
    await logMessage({
      type: LogsTypes.END_CRONJOB,
      message: Messages.END_CRONJOB(counterUsersChecked, counterCodes, counterCodesUpdated, counterCodesError, cronjobDuration),
      messageToAdmin: Messages.END_CRONJOB(counterUsersChecked, counterCodes, counterCodesUpdated, counterCodesError, cronjobDuration),
      meta: {
        [MetaKeys.COUNTER_USERS_CHECKED]: counterUsersChecked,
        [MetaKeys.COUNTER_CODES]: counterCodes,
        [MetaKeys.COUNTER_CODES_UPDATED]: counterCodesUpdated,
        [MetaKeys.COUNTER_CODES_ERROR]: counterCodesError,
        [MetaKeys.CRONJOB_DURATION]: cronjobDuration,
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
    return;
  }
  setUserDebounce(ctx.from.id);

  let currentUser = await requestUserByChatId(ctx.from.id);

  if (currentUser) {
    ctx.reply(Messages.START_FOR_USER_EXIST(), {
      parse_mode: 'HTML',
      ...keyboardDefault(currentUser),
    });
  } else {
    currentUser = new User(await createUser(new User({...ctx.from, isNew: true})));
    ctx.reply(Messages.START_FOR_USER(), {
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
  ctx.reply(Messages.UNSUBSCRIBE_ENABLE(codeUid), replyOptions);
  await logMessage({
    type: LogsTypes.UNSUBSCRIBE_ENABLE,
    user: currentUser,
    message: Messages.SUCCESS_UNSUBSCRIBE_ENABLE(currentUser, codeUid),
    messageToAdmin: Messages.SUCCESS_UNSUBSCRIBE_ENABLE(currentUser, codeUid),
    meta: {
      [MetaKeys.CODE_UID]: codeUid
    }
  });
});

bot.on('text', async (ctx) => {
  if (isUserDebounced(ctx.from.id)) {
    return;
  }
  setUserDebounce(ctx.from.id);

  let currentUser = await requestUserByChatId(ctx.from.id);

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

    if (isAdmin(ctx)) {
      if (text.startsWith('написать')) {
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

      if (text.startsWith('test')) {
        // TODO: для чего нибудь

        return
      }
    }

    if (text.startsWith('faq')) {
      await ctx.reply(Messages.FAQ_BASE, {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });
      await ctx.reply(Messages.FAQ_STATUSES, {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });
      await logMessage({
        type: LogsTypes.SHOW_FAQ,
        user: currentUser,
        message: Messages.USER_SHOW_FAQ(currentUser),
        messageToAdmin: Messages.USER_SHOW_FAQ(currentUser),
      });

      return
    }

    if (text.startsWith('расписание')) {
      ctx.reply(Messages.AUTOUPDATE_SCHEDULES, {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });
      await logMessage({
        type: LogsTypes.SHOW_SCHEDULE,
        user: currentUser,
        message: Messages.USER_SHOW_SCHEDULE(currentUser),
        messageToAdmin: Messages.USER_SHOW_SCHEDULE(currentUser),
      });

      return
    }

    if (text.startsWith('статус') || text.startsWith('обновить')) {
      try {
        const shortUidToUpdate = text.startsWith('статус')
          ? text.match(/статус (.+) (.+)/) && text.match(/статус (.+) (.+)/)[1]
          : text.match(/обновить (.+) (.+)/) && text.match(/обновить (.+) (.+)/)[1];
        const currentUserCode = Code.isShortValid(shortUidToUpdate) ? currentUser.getUserCode(shortUidToUpdate) : undefined

        if (currentUserCode) {
          codeUid = currentUserCode?.uid
          await sendCodeStatusToUser(currentUser, currentUserCode, true);
          await logMessage({
            type: LogsTypes.SUCCESS_CODE_STATUS,
            user: currentUser,
            message: Messages.SUCCESS_CODE_STATUS(currentUser, codeUid),
            messageToAdmin: Messages.SUCCESS_CODE_STATUS(currentUser, codeUid),
            meta: {
              [MetaKeys.CODE]: currentUserCode
            }
          });
        } else {
          ctx.reply(Messages.ERROR_VALIDATE_CODE, {
            parse_mode: 'HTML',
            ...keyboardDefault(currentUser),
          });
        }
      } catch(e) {
        throw e
      }

      return
    }

    if (!Code.isValid(codeUid)) {
      ctx.reply(Messages.ERROR_VALIDATE_CODE, {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });

      await logMessage({
        type: LogsTypes.MESSAGE,
        user: currentUser,
        message: Messages.USER_MESSAGE_WITHOUT_UID(currentUser, text),
        messageToAdmin: Messages.USER_MESSAGE_WITHOUT_UID(currentUser, text),
      });

      return
    }

    const currentUserCode = currentUser.getUserCode(codeUid)

    if (currentUserCode) {
      ctx.reply(Messages.SUBSCRIBE_ENABLE_ALREADY(currentUserCode), {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });
      await logMessage({
        type: LogsTypes.SUBSCRIBE_ENABLE_ALREADY,
        user: currentUser,
        message: Messages.USER_SUBSCRIBE_ENABLE_ALREADY(currentUser, codeUid),
        messageToAdmin: Messages.USER_SUBSCRIBE_ENABLE_ALREADY(currentUser, codeUid),
        meta: {
          [MetaKeys.CODE_UID]: codeUid
        }
      });
    } else {
      if (currentUser.hasMaxCountCodes) {
        ctx.reply(Messages.MAX_COUNT_CODES(currentUser.codes.length), {
          parse_mode: 'HTML',
          ...keyboardDefault(currentUser),
        });
        await logMessage({
          type: LogsTypes.USER_HAS_MAX_COUNT_CODES,
          user: currentUser,
          message: Messages.USER_HAS_MAX_COUNT_CODES(currentUser, codeUid),
          messageToAdmin: Messages.USER_HAS_MAX_COUNT_CODES(currentUser, codeUid),
          meta: {
            [MetaKeys.CODE_UID]: codeUid
          }
        });

        return
      }

      currentUser.updateUserCodes(new Code({ uid: codeUid }));
      await updateUser(currentUser);
      ctx.reply(Messages.SUBSCRIBE_ENABLE(codeUid), {
        parse_mode: 'HTML',
        ...keyboardDefault(currentUser),
      });

      await logMessage({
        type: LogsTypes.SUBSCRIBE_ENABLE,
        user: currentUser,
        message: Messages.SUCCESS_SUBSCRIBE_ENABLE(currentUser, codeUid),
        messageToAdmin: Messages.SUCCESS_SUBSCRIBE_ENABLE(currentUser, codeUid),
        meta: {
          [MetaKeys.CODE_UID]: codeUid
        }
      });
    }
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

