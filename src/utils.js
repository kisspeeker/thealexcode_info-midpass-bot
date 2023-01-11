async function logMessage(data = {}) {
  await axiosInstance.post(API_ROUTE_LOGS, {
    data: {
      type: String(data.type || '-'),
      chatId: String(data.chatId || '-'),
      userName: String(data.userName || '-'),
      message: String(data.message || '-'),
      imagePath: String(data.imagePath || '-'),
      imageGenerator: String(data.imageGenerator || '-'),
    }
  });
}

async function getLogsFile() {
  const res = (await axiosInstance.get(API_ROUTE_LOGS)).data;
  
  await fs.writeFile(LOGS_PATH, JSON.stringify(res), 'utf8', (e) => console.error(e));
  
  return await fs.createReadStream(LOGS_PATH, 'utf8');
}

async function sendStartMessageToAdmin(ctx) {
  const { id, username } = ctx?.message?.from;

  if (ADMIN_CHAT_ID) {
    await ctx.telegram.sendMessage(ADMIN_CHAT_ID, `🔥 New user! \n\nid: ${id} \nusername: ${username}`);
  }
}