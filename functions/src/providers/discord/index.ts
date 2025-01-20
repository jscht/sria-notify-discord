import { Client, Events, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.once(Events.ClientReady, (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if(message.content === 'ping'){
    message.reply('pong');
  }
});

export function connectDiscord() {
  client.login(process.env.SARIAN_BOT_TOKEN);
  console.info("info: login success!")
}
