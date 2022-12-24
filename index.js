import fs from 'fs';
import { Telegraf } from 'telegraf';

import {
  BOT_TOKEN,
  MESSAGES,
  LOGS_PATH,
  ADMIN_CHAT_ID,
  LOGS_TYPES,
  ERRORS,
  API_ROUTE_LOGS,
  API_KEY
} from './src/constants.js';
import axios from 'axios';

const bot = new Telegraf(BOT_TOKEN);

const axiosInstance = axios.create({
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${API_KEY}`
  },
});

bot.start(async (ctx) => {
  try {
    const { id, username } = ctx?.message?.from;

    await ctx.reply(MESSAGES.start);
    // await sendStartMessageToAdmin(ctx);
    // await logMessage({
    //   type: LOGS_TYPES.successStart,
    //   chatId: id,
    //   userName: username,
    // });
  } catch(e) {
    console.error(e);
    throw new Error(`${ERRORS.start}: ${e}`);
  }
});

// bot.command('logs', async (ctx) => {
//   try {
//     const { id, username } = ctx?.message?.from;

//     if (ADMIN_CHAT_ID && String(id) === ADMIN_CHAT_ID) {
//       const logsDocument = await requestLogsAndGenerateFile();

//       await ctx.replyWithDocument({
//         source: logsDocument,
//         filename: LOGS_PATH.split('/').pop(),
//       })

//       fs.access(LOGS_PATH, async (err) => {
//         if (err) {
//           console.error(err);
//           return;
//         }
//         logsDocument.destroy();
//         await fs.unlink(LOGS_PATH, (e) => console.error(e));
//       });

//       await logMessage({
//         type: LOGS_TYPES.logsDownload,
//         chatId: id,
//         userName: username,
//       });
//     }
//   } catch(e) {
//     console.error(e);
//     throw new Error(`${ERRORS.logsSend}: ${e}`);
//   }
// })


// bot.on('text', async (ctx) => {
//   try {
//     const { id, username } = ctx?.message?.from;
//     const message = ctx?.message?.text?.replace('/', '');
//     const imagePath = await requestImageFromGenerator(message);

//     await ctx.replyWithPhoto(imagePath);

//     await logMessage({
//       type: LOGS_TYPES.successRequestImage,
//       chatId: id,
//       userName: username,
//       message: message,
//     });
//   } catch(e) {
//     throw new Error(`${ERRORS.messageHandler}: ${e}`);
//   }
// });

bot.catch(async (err, ctx) => {
  console.error(err);
});

bot.launch().then(() => {
  console.warn('BOT STARTED');
});
