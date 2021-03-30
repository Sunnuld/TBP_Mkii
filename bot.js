//Import dependancies
const Discord = require('discord.js');
const chalk = require('chalk');
require('dotenv').config();

//Create and link db
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const db = low(new FileSync('db.json'));

//db Defaults
db.defaults({ guilds: [] }).write();

//Create bot
const bot = new Discord.Client();

//Cone User
const coneUser = '136199587659513856';

//Log Ready Status
bot.on('ready', () => {
  console.log(chalk.blue.bold.underline('LanBot reporting for duty'));
  bot.user.setActivity('TheLanBot_v1.3', { type: 'PLAYING' });
});

//Added to server
bot.on('guildCreate', (guild) => {
  db.get('guilds')
    .push({
      id: guild.id,
      name: guild.name,
      guildVars: {
        ADMIN_CHANNEL: null,
        DEFAULT_ROLE: null,
        STREAMER_ROLE: null,
        STREAMER_CHANNEL: null,
        STREAMERS: [],
      },
    })
    .write();
});

//Message Triggers
bot.on('message', (message) => {
  if (message.author.bot) return;
  if (message.author.id === coneUser)
    message.react(message.guild.emojis.cache.get('814520123615739935'));

  if (message.content.startsWith(process.env.ADMIN_IDENTIFIER)) {
    if (!message.member.hasPermission('ADMINISTRATOR')) {
      return message.reply('U no an admin!');
    } else {
      adminFunctions(message);
      return;
    }
  }

  if (message.content.startsWith(process.env.IDENTIFIER)) {
    return message.reply(`color: ${message.member.displayHexColor}`);
  }

  if (
    message.channel.id ===
    db.get('guilds').find({ id: message.guild.id }).value().guildVars
      .GALLERY_CHANNEL
  ) {
    if (message.attachments.array().length === 0) return message.delete();
  }
});

//New Member
bot.on('guildMemberAdd', (member) => {
  const channel = member.guild.channels.cache.find(
    (channel) => channel.name === 'general'
  );
  const { DEFAULT_ROLE } = db
    .get('guilds')
    .find({ id: member.guild.id })
    .value().guildVars;

  if (DEFAULT_ROLE) member.roles.add(DEFAULT_ROLE);

  const newUserEmbed = new Discord.MessageEmbed()
    .setColor('#D00203')
    .setTitle('Hey')
    .setDescription(member.displayName)
    .setThumbnail(member.user.avatarURL())
    .addField(
      'Welcome to TheLanProject',
      'Your new home of all things gaming! 🎮🕹'
    )
    .addField(
      'Head over to our site to learn more',
      'https://TheLanProject.co.uk'
    )
    .setTimestamp();

  channel.send(newUserEmbed);
});

//Member Leave
bot.on('guildMemberRemove', (member) => {
  const { ADMIN_CHANNEL } = db
    .get('guilds')
    .find({ id: member.guild.id })
    .value().guildVars;

  const sendChannel = member.guild.channels.cache.get((id = ADMIN_CHANNEL));

  if (sendChannel) sendChannel.send(`ByeBye ${member.displayName}`);
});

//Streamer Integration
bot.on('presenceUpdate', async (oldPresence, newPresence) => {
  const { member, guild } = newPresence;

  const fetchedGuild = db.get('guilds').find({ id: guild.id }).value();
  if (!fetchedGuild) return;

  const { STREAMER_CHANNEL, STREAMER_ROLE, STREAMERS } = fetchedGuild.guildVars;

  const sendChannel = guild.channels.cache.get((id = STREAMER_CHANNEL));

  var embedID;
  var wasStreaming = [];
  var isStreaming = [];
  var messageToRemove;

  if (oldPresence) {
    wasStreaming = oldPresence.activities.filter(
      (activity) => activity.type === 'STREAMING'
    );
  }
  isStreaming = newPresence.activities.filter(
    (activity) => activity.type === 'STREAMING'
  );

  //No stream update
  if (isStreaming.length === wasStreaming.length) return;

  //Stream started
  if (wasStreaming.length === 0 && isStreaming.length === 1) {
    if (STREAMER_ROLE) member.roles.add(STREAMER_ROLE);
    if (!sendChannel) return;

    const streamEmbed = new Discord.MessageEmbed()
      .setColor('PURPLE')
      .setTitle(isStreaming[0].details)
      .setURL(isStreaming[0].url)
      .setDescription(isStreaming[0].state)
      .setThumbnail(member.user.avatarURL())
      .addField(
        `${member.displayName} is Live on ${isStreaming[0].name} 🔴`,
        `Go and cheer them on! \r\n ${isStreaming[0].url}`
      )
      .setTimestamp()
      .setFooter(
        '\u200b',
        'https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png'
      );

    await sendChannel.send(streamEmbed).then((sentMessage) => {
      return (embedID = sentMessage.id);
    });
    STREAMERS.push({ userID: member.user.id, embedID });
  } else {
    if (STREAMER_ROLE) member.roles.remove(STREAMER_ROLE);
    if (!sendChannel) return;

    streamerIndex = STREAMERS.findIndex((str) => str.userID === member.user.id);

    if (streamerIndex > -1) {
      messageToRemove = await sendChannel.messages.cache.get(
        (id = STREAMERS[streamerIndex].embedID)
      );
      if (!messageToRemove)
        messageToRemove = await sendChannel.messages.fetch(
          STREAMERS[streamerIndex].embedID
        );

      if (messageToRemove) messageToRemove.delete();
    }
    STREAMERS.splice(streamerIndex, 1);
  }

  db.get('guilds').find({ id: guild.id }).assign(fetchedGuild).write();
});

//Admin Functions
const adminFunctions = (message) => {
  const args = message.content.split(' ');
  switch (args[0]) {
    case '$adminChannel':
      setAdminChannel(message, args);
      break;
    case '$setGallery':
      setGalleryChannel(message, args);
      break;
    case '$defaultRole':
      setDefaultRole(message, args);
      break;
    case '$streamChannel':
      setStreamChannel(message, args);
      break;
    case '$streamRole':
      setStreamRole(message, args);
      break;
    case '$announce':
      announce(message, args);
      break;
    case '$config':
      config(message);
      break;
    case '$seed':
      seed(message);
      break;
    default:
      message.reply('Me no understand pal');
  }
};

const setAdminChannel = (message, args) => {
  var channel;

  if (!args[1]) {
    channel = message.channel;
  } else {
    channel = message.guild.channels.cache.find(
      (channel) => channel.name === args[1]
    );
  }

  if (!channel) {
    const filter = (reaction, user) =>
      reaction.emoji.name === '👌' && user.id === message.author.id;

    message
      .reply(`Target channel, '${args[1]}', does not exist! Create?`)
      .then((sentMessage) => {
        sentMessage.react('👌');
        const collector = sentMessage.createReactionCollector(filter, {
          max: 1,
          time: 30000,
        });
        collector.on('collect', async (r) => {
          await message.guild.channels.create(args[1], { type: 'text' });
          setAdminChannel(message, (newArgs = ['create', args[1]]));
        });
      });
    return;
  }

  const fetchedGuild = db.get('guilds').find({ id: message.guild.id }).value();

  fetchedGuild.guildVars.ADMIN_CHANNEL = channel.id;

  db.get('guilds').find({ id: message.guild.id }).assign(fetchedGuild).write();

  message.reply(`Admin channel set to ${channel}`);
};

const setGalleryChannel = (message, args) => {
  var channel;

  if (!args[1]) {
    channel = message.channel;
  } else {
    channel = message.guild.channels.cache.find(
      (channel) => channel.name === args[1]
    );
  }

  if (!channel) {
    const filter = (reaction, user) =>
      reaction.emoji.name === '👌' && user.id === message.author.id;

    message
      .reply(`Target channel, '${args[1]}', does not exist! Create?`)
      .then((sentMessage) => {
        sentMessage.react('👌');
        const collector = sentMessage.createReactionCollector(filter, {
          max: 1,
          time: 30000,
        });
        collector.on('collect', async (r) => {
          await message.guild.channels.create(args[1], {
            type: 'text',
          });
          setGalleryChannel(message, (newArgs = ['create', args[1]]));
        });
      });
    return;
  }

  channel.setRateLimitPerUser(5);

  const fetchedGuild = db.get('guilds').find({ id: message.guild.id }).value();

  fetchedGuild.guildVars.GALLERY_CHANNEL = channel.id;

  db.get('guilds').find({ id: message.guild.id }).assign(fetchedGuild).write();

  message.reply(`Gallery channel set to ${channel}`);
};

const setDefaultRole = (message, args) => {
  if (!args[1]) return message.reply('No target role! "$defaultRole <role>"');

  const role = message.guild.roles.cache.find((role) => role.name === args[1]);

  if (!role) {
    const filter = (reaction, user) =>
      reaction.emoji.name === '👌' && user.id === message.author.id;
    message
      .reply(`Target role, '${args[1]}', does not exist! Create?`)
      .then((sentMessage) => {
        sentMessage.react('👌');
        const collector = sentMessage.createReactionCollector(filter, {
          max: 1,
          time: 30000,
        });
        collector.on('collect', async (r) => {
          await message.guild.roles.create({
            data: { name: args[1], color: 'BLUE', hoist: true },
          });
          setDefaultRole(message, (newArgs = ['create', args[1]]));
        });
      });
    return;
  }

  const fetchedGuild = db.get('guilds').find({ id: message.guild.id }).value();

  fetchedGuild.guildVars.DEFAULT_ROLE = role.id;

  db.get('guilds').find({ id: message.guild.id }).assign(fetchedGuild).write();

  message.reply(`Default role set to ${role}`);
};

const setStreamChannel = (message, args) => {
  if (!args[1]) {
    channel = message.channel;
  } else {
    channel = message.guild.channels.cache.find(
      (channel) => channel.name === args[1]
    );
  }

  if (!channel) {
    const filter = (reaction, user) =>
      reaction.emoji.name === '👌' && user.id === message.author.id;

    message
      .reply(`Target channel, '${args[1]}', does not exist! Create?`)
      .then((sentMessage) => {
        sentMessage.react('👌');
        const collector = sentMessage.createReactionCollector(filter, {
          max: 1,
          time: 30000,
        });
        collector.on('collect', async (r) => {
          await message.guild.channels.create(args[1], { type: 'text' });
          setStreamChannel(message, (newArgs = ['create', args[1]]));
        });
      });
    return;
  }

  const fetchedGuild = db.get('guilds').find({ id: message.guild.id }).value();

  fetchedGuild.guildVars.STREAMER_CHANNEL = channel.id;

  db.get('guilds').find({ id: message.guild.id }).assign(fetchedGuild).write();

  message.reply(`Streaming channel set to ${channel}`);
};

const setStreamRole = (message, args) => {
  if (!args[1]) return message.reply('No target role! "$streamRole <role>"');

  const role = message.guild.roles.cache.find((role) => role.name === args[1]);

  if (!role) {
    const filter = (reaction, user) =>
      reaction.emoji.name === '👌' && user.id === message.author.id;

    message
      .reply(`Target role, '${args[1]}', does not exist! Create?`)
      .then((sentMessage) => {
        sentMessage.react('👌');

        const collector = sentMessage.createReactionCollector(filter, {
          max: 1,
          time: 30000,
        });

        collector.on('collect', async (r) => {
          await message.guild.roles.create({
            data: { name: args[1], color: 'PURPLE', hoist: true },
          });
          setStreamRole(message, (newArgs = ['create', args[1]]));
        });
      });
    return;
  }

  const fetchedGuild = db.get('guilds').find({ id: message.guild.id }).value();

  fetchedGuild.guildVars.STREAMER_ROLE = role.id;

  db.get('guilds').find({ id: message.guild.id }).assign(fetchedGuild).write();

  message.reply(`Streaming role set to ${role}`);
};

const announce = async (message, args) => {
  if (!args[1]) return message.reply('I need something to announce captain!');

  const channel = message.guild.channels.cache.find(
    (channel) => channel.name === args[1]
  );

  if (!channel) {
    message.delete();
    return message.channel.send(args.slice(1).join(' '));
  }

  var collectorMessage;
  await message.channel
    .send('Does this look right?\r\n>>> ' + args.slice(2).join(' '))
    .then(async () => {
      await message.channel
        .send('Do you want me to announce this to <#' + channel + '>?')
        .then((sentMessage) => {
          sentMessage.react('👍').then(() => {
            sentMessage.react('👎');
          });
          return (collectorMessage = sentMessage);
        });
    });

  const filter = (reaction, user) =>
    (reaction.emoji.name === '👍' || '👎') && user.id === message.author.id;

  const collector = collectorMessage.createReactionCollector(filter, {
    max: 1,
    time: 30000,
  });

  collector.on('collect', (r) => {
    if (r._emoji.name === '👎') return;
    channel.send(args.slice(2).join(' '));
  });
};

const config = (message) => {
  const {
    ADMIN_CHANNEL,
    DEFAULT_ROLE,
    STREAMER_CHANNEL,
    STREAMER_ROLE,
    GALLERY_CHANNEL,
  } = db.get('guilds').find({ id: message.guild.id }).value().guildVars;

  const configEmbed = new Discord.MessageEmbed()
    .setColor('RED')
    .setTitle('CONFIG')
    .setDescription(`Config settings for **${message.guild.name}**`)
    .setThumbnail(message.guild.iconURL())
    .addField(
      'Admin Channel',
      `${
        ADMIN_CHANNEL
          ? `<#${ADMIN_CHANNEL}>`
          : 'Not Set\r\n(Default: #moderator-only)'
      }`,
      true
    )
    .addField(
      'Default Role',
      `${
        DEFAULT_ROLE ? `<@&${DEFAULT_ROLE}>` : 'Not Set\r\n(Default: @TLP Fam)'
      }`,
      true
    )
    .addField(
      'Stream Channel',
      `${
        STREAMER_CHANNEL
          ? `<#${STREAMER_CHANNEL}>`
          : 'Not Set\r\n(Default: #now-live)'
      }`,
      true
    )
    .addField(
      'Streaming Role',
      `${
        STREAMER_ROLE
          ? `<@&${STREAMER_ROLE}>`
          : 'Not Set\r\n(Default: @Streaming)'
      }`,
      true
    )
    .addField(
      'Gallery Channels',
      `${
        GALLERY_CHANNEL
          ? `<#${GALLERY_CHANNEL}>`
          : 'Not Set\r\nNo Default\r\n"$setGallery"'
      }`,
      true
    )
    .setTimestamp()
    .setFooter('To apply defaults click 👌 reaction');

  const filter = (reaction, user) =>
    reaction.emoji.name === '👌' && user.id === message.author.id;

  message.channel.send(configEmbed).then((sentMessage) => {
    sentMessage.react('👌');
    const collector = sentMessage.createReactionCollector(filter, {
      max: 1,
      time: 30000,
    });
    collector.on('collect', (r) => {
      setAdminChannel(message, (args = ['default', 'moderator-only']));
      setDefaultRole(message, (args = ['default', 'TLP Fam']));
      setStreamChannel(message, (args = ['default', 'now-live']));
      setStreamRole(message, (args = ['default', 'Streaming']));
    });
  });
};

const seed = async (message) => {
  const test = db.get('guilds').find({ id: message.guild.id }).value();

  if (test)
    return message.reply('This Guild is already seeded in the database!');

  await db
    .get('guilds')
    .push({
      id: message.guild.id,
      name: message.guild.name,
      guildVars: {
        ADMIN_CHANNEL: null,
        DEFAULT_ROLE: null,
        STREAMER_ROLE: null,
        STREAMER_CHANNEL: null,
        GALLERY_CHANNEL: null,
        STREAMERS: [],
      },
    })
    .write();

  message.reply('Guild added to database, run $config to set guildVars');
};

//General Error Catch
bot.on('error', (error) => console.log(error));

//Login
bot.login(process.env.TOKEN);
