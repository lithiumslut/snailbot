//guide followed: https://anidiots.guide/other-guides/hosting-on-glitch
//ping glitch every 5 minutes to keep bot alive, DO NOT TOUCH
const http = require("http");
const express = require("express");
const app = express();
app.get("/", (request, response) => {
  console.log(Date.now() + " Ping Received");
  response.sendStatus(200);
});
app.listen(process.env.PORT);
setInterval(() => {
  http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
}, 280000);

//meat of the bot
const Discord = require("discord.js");
const SQLite = require("better-sqlite3");
const sql = new SQLite("./main.sqlite");
const config = require("./config.json");

const client = new Discord.Client();
var prefix = config.prefix;

function getMention(mention) {
  if (!mention) return;

  if (mention.startsWith("<@") && mention.endsWith(">")) {
    mention = mention.slice(2, -1);

    if (mention.startsWith("!")) {
      mention = mention.slice(1);
    }

    return client.users.get(mention);
  } //users
  else if (mention.startsWith("<#") && mention.endsWith(">")) {
    mention = mention.slice(2, -1);

    if (mention.startsWith("!")) {
      mention = mention.slice(1);
    }

    return client.users.get(mention);
  } //channels
}

function leaderboard(guild) {
  let leaderboardEmbed = new Discord.RichEmbed().setColor(0x000000)
    .setAuthor("Top 20 Scoring Players!", client.user.avatarURL);
  //creates variable equal to an array that lists the top 10 scorers.
  const top10 = sql.prepare("SELECT * FROM scores WHERE guild = ? ORDER BY points DESC LIMIT 20;").all(guild.id);

  let number = 1;
  for (let data of top10) {
    if (!client.users.get(data.user)) continue;
    leaderboardEmbed.addField(`${number}. ${guild.members.get(client.users.get(data.user).id).displayName}`, `**${data.points} points** | **Level ${data.level}** | **${data.activityLevel} activity points**`);
    number++;
  }
  client.channels.get(config.leaderboardChannel).fetchMessages({
      around: config.leaderboardMessage,
      limit: 1
    })
    .then(messages => {
      const fetchedMsg = messages.first();
      fetchedMsg.edit(leaderboardEmbed);
    });
}

client.on("ready", () => {
  var date = new Date();
  console.log(`I'm online at ${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`);

  //Setup leaderboard timer
  setInterval(() => {
    console.log("Updating leaderboards");
    leaderboard(client.guilds.get(config.serverID))
  }, 1800000);

  //sql shit
  //check if table already exists
  const scoreTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'scores';").get();
  const commandTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'command';").get();
  if (!scoreTable["count(*)"]) {
    //If the table ain't there, create it and set it up properly
    sql.prepare("CREATE TABLE scores (id TEXT PRIMARY KEY, user TEXT, guild TEXT, points INTEGER, level INTEGER, activityLevel INTEGER);").run();
    //make sure the row ID is always unique and unindexed
    sql.prepare("CREATE UNIQUE INDEX idx_scores_id ON scores (id);").run();

    sql.pragma("synchronous = 1");
    sql.pragma("journal_mode = wal");
  }
  if (!commandTable["count(*)"]) {
    sql.prepare("CREATE TABLE command (name TEXT PRIMARY KEY, perms TEXT, desc TEXT, params TEXT);").run();

    sql.prepare("CREATE UNIQUE INDEX idx_command_name ON command (name);").run();
    sql.pragma("synchronous = 1");
    sql.pragma("journal_mode = wal");
  }

  //prepared to get and store point data
  client.getScore = sql.prepare("SELECT * FROM scores WHERE user = ? AND guild = ?");
  client.setScore = sql.prepare("INSERT OR REPLACE INTO scores (id, user, guild, points, level, activityLevel) VALUES (@id, @user, @guild, @points, @level, @activityLevel);");

  client.getCommands = sql.prepare("SELECT * FROM command")
  client.getCommand = sql.prepare("SELECT * FROM command WHERE name = ?")
  client.setCommand = sql.prepare("INSERT OR REPLACE INTO command (name, perms, desc, params) VALUES (@name, @perms, @desc, @params);");
  client.delCommand = sql.prepare("DELETE FROM command WHERE name = @name");
});

client.on("guildMemberAdd", (member) => {
  member.addRole(member.guild.roles.get(config.newMemberRole));

  client.channels.get(config.welcomeChannel).send(new Discord.RichEmbed()
    .setAuthor(client.user.username, client.user.avatarURL)
    .setColor(0x000000)
    .addField(
      `Welcome, ${member.displayName}!`,
      `-Hey there, and welcome to Bounty! We're a server dedicated to creating a competitive environment for solving ARG-style puzzles!\n
      -Please check out our ${client.channels.get(config.rulesChannel)} channel and make sure you can abide by them (they're pretty basic rules, nothing too terribly fancy).\n
      -After that, type z.joinTeam and a mod will add you to a team ASAP!\n
      -Once you're part of a team, you'll be able to see the active puzzle as well as past puzzles, and your team should help you through the rest!\n
      -Most importantly, have fun!`
    )).catch(console.error);
});

client.on("message", message => {
  //user filter
  if (message.author === client.user || message.author.bot || !message.guild) return;

  if (message.channel.id === config.bruhChannel && !message.content.toLowerCase().replace(/\s+/g, '').includes("bruh")) {
    message.delete();
    return;
  }

  //argument variables
  //slice removes prefix, trim any whitespace surrounding the command, split the string beteen spaces of any amount.
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  //shift removes the first entry of the array, changing the value of the array as well
  const command = args.shift().toLowerCase();

  const isMod = message.member.roles.has(config.modRole);

  //SQL
  let score = client.getScore.get(message.author.id, message.guild.id);
  if (!score) {
    score = {
      id: `${message.guild.id}-${message.author.id}`,
      user: message.author.id,
      guild: message.guild.id,
      points: 0,
      level: 1
    };
  }
  score.activityLevel++;
  const curLevel = Math.floor(0.1 * Math.sqrt(score.points));
  if (score.level < curLevel) {
    score.level = curLevel;
  }
  client.setScore.run(score);

  //embed template
  let embed = new Discord.RichEmbed().setColor(0x000000);

  //commands
  if (!message.content.startsWith(prefix)) return;
  if (command === "help") {
    const dmSent = new Discord.RichEmbed().setAuthor("Help", client.user.avatarURL).setColor(0x000000).addField("DM Sent!", "You've been sent a DM that lists the commands!");
    embed.setAuthor("Command Help", client.user.avatarURL);
    if (args.length === 0) {
      const cmdList = client.getCommands.all();

      let desc = "";
      for (let info = 0; info < cmdList.length; info++) {
        if (cmdList[info].perms === "mod" && !message.member.roles.has(config.modRole)) continue;
        desc += `\n**${prefix}${cmdList[info].name}**\n${cmdList[info].desc.replace("\\n", "\n")}\n`;
      }
      embed.setDescription(desc);
    } else {
      const cmd = client.getCommand.get(args[0])
      if (!cmd || (cmd.perms === "mod" && !message.member.roles.has(config.modRole))) {
        embed.setAuthor("Error", client.user.avatarURL)
          .addField("Whoa there!", `That's not a command! Use ${prefix}help for a list of commands!`);
        message.channel.send(embed).then(msg => {
          msg.delete(5000);
        }).catch(console.error);
        return;
      } else {
        embed.addField(`**${prefix}${cmd.name}**`, cmd.desc.replace("\\n", "\n"))
        if (cmd.params !== "none") {
          embed.addField("Usage", `${prefix}${cmd.name}`);
        } else {
          embed.addField("Usage", `${prefix}${cmd.name} ${cmd.params.replace("\\n", "\n")}`);
        }
      }
    }
    message.member.send(embed);
    message.channel.send(dmSent).then(msg => {
      msg.delete(5000);
    }).catch(console.error);
    return;
  } else if (command === "info") {
    let channel = args[0];
    const onlineEmoji = client.emojis.find(emoji => emoji.name === "online");
    const offlineEmoji = client.emojis.find(emoji => emoji.name === "offline");
    const alectoEmoji = client.emojis.find(emoji => emoji.name === "coinAlecto");
    const megaEmoji = client.emojis.find(emoji => emoji.name === "coinMegaera");
    const tisiEmoji = client.emojis.find(emoji => emoji.name === "coinTisiphone");
    let userCount;
    let botCount;
    let online;

    if (!channel) {
      userCount = message.guild.members.filter(member => !member.user.bot === true);
      botCount = message.guild.members.filter(member => member.user.bot === true);
      online = userCount.filter(member => member.user.presence.status !== "offline").size;
    } else if (message.guild.channels.has(args[0].slice(2, 20))) {
      userCount = message.guild.channels.get(channel).members.filter(member => !member.user.bot === true);
      botCount = message.guild.channels.get(channel).members.filter(member => member.user.bot === true);
      online = userCount.filter(member => member.user.presence.status !== "offline").size;
      channel = args[0].slice(2, 20);
    } else {
      embed.setAuthor("Error!", client.user.avatarURL)
        .setDescription("Please enter a channel!");
      message.channel.send(embed).then(msg => {
        msg.delete(5000);
      }).catch(console.error);
      return;
    }

    let alectoSize = userCount.filter(member => member.roles.has(config.alectoRole)).size;
    let tisiSize = userCount.filter(member => member.roles.has(config.tisiphoneRole)).size;
    let megaSize = userCount.filter(member => member.roles.has(config.megaeraRole)).size;

    let alectoOnline = userCount.filter(member => member.roles.has(config.alectoRole) && member.user.presence.status !== "offline").size;
    let tisiOnline = userCount.filter(member => member.roles.has(config.tisiphoneRole) && member.user.presence.status !== "offline").size;
    let megaOnline = userCount.filter(member => member.roles.has(config.megaeraRole) && member.user.presence.status !== "offline").size;

    embed.setAuthor("Bounty", client.user.avatarURL)
      .setDescription("A server dedicated to creating a friendly but competitive puzzle-solving environment!")
      .setFooter(`Bounty created on ${message.guild.createdAt.toString().slice(0, 15)} because other bots suck`, "https://cdn.glitch.com/39aa19a3-f12a-47f0-a2a7-f8a89d8d451d%2Fz.avatar.png")
      .setThumbnail(message.guild.iconURL)
      .setTitle(`${message.guild.memberCount} Members - [Users ${userCount.size} | ${botCount.size} Bots]`)
      .addField("Members",
        `${onlineEmoji} ${online} Online
        ${offlineEmoji} ${userCount.size - online} Offline
        ${alectoEmoji} ${alectoOnline}/${alectoSize} Alecto players online
        ${tisiEmoji} ${tisiOnline}/${tisiSize} Tisiphone players online
        ${megaEmoji} ${megaOnline}/${megaSize} Megaera players online`)
      .addField("Region", message.guild.region, true)
      .addField("Channels", message.guild.channels.size, true)
      .addField("Roles", message.guild.roles.size, true);
    if (channel) {
      embed.addField("Category", `${message.guild.channels.get(channel).parent}`, true)
        .addField("Channel created on", `${message.guild.channels.get(channel).createdAt.toString().slice(0, 15)}`, true);
    }
  } else if (command === "nsfw") {
    embed.setAuthor("Join NSFW", message.author.avatarURL);

    if (message.member.roles.has(config.pornRole)) {
      message.member.removeRole(message.guild.roles.get(config.pornRole)).catch(console.error);
      embed.addField("Success!", "You've left the NSFW channel!");
    } else if (!message.member.roles.has(config.pornRole)) {
      message.member.addRole(message.guild.roles.get(config.pornRole)).catch(console.error);
      embed.addField("Success!", "Welcome to the NSFW channel!");
    } else {
      embed.addField("z.nsfw is broken!", "<@!308224063950553088> plz fix");
    }
  } else if (command === "pokecord") {
    embed.setAuthor("Join Pokecord", message.author.avatarURL);

    if (message.member.roles.has(config.pokeRole)) {
      message.member.removeRole(message.guild.roles.get(config.pokeRole)).catch(console.error);
      embed.addField("Success!", "You've left the Pokenerd channel!");
    } else if (!message.member.roles.has(config.pokeRole)) {
      message.member.addRole(message.guild.roles.get(config.pokeRole)).catch(console.error);
      embed.addField("Success!", "Welcome to the Pokenerd channel!");
    } else {
      embed.addField("z.pokecord is broken!", "<@!308224063950553088> plz fix");
    }
  } else if (command === "bruh") {
    embed.setAuthor("Join bruh", message.author.avatarURL);

    if (message.member.roles.has(config.bruhRole)) {
      message.member.removeRole(message.guild.roles.get(config.bruhRole)).catch(console.error);
      embed.addField("Success!", "You've left the bruh channel!");
    } else if (!message.member.roles.has(config.bruhRole)) {
      message.member.addRole(message.guild.roles.get(config.bruhRole)).catch(console.error);
      embed.addField("Success!", "Welcome to the bruh channel!");
    } else {
      embed.addField("z.bruh is broken!", "<@!308224063950553088> plz fix");
    }
  } else if (command === "jointeam") {
    embed.setAuthor("Join a team!", client.user.avatarURL);

    if (message.member.roles.has(config.alectoRole) || message.member.roles.has(config.megaeraRole) || message.member.roles.has(config.tisiphoneRole)) {
      embed.addField("Error!", "You're already in a team!");
      message.channel.send(embed).then(msg => {
        msg.delete(5000);
      }).catch(console.error);
      return;
    } else {
      const alectoEmoji = client.emojis.find(emoji => emoji.name === "coinAlecto");
      const megaEmoji = client.emojis.find(emoji => emoji.name === "coinMegaera");
      const tisiEmoji = client.emojis.find(emoji => emoji.name === "coinTisiphone");
      const userCount = message.guild.members.filter(member => !member.user.bot === true);
      let alectoSize = userCount.filter(member => member.roles.has(config.alectoRole)).size;
      let tisiSize = userCount.filter(member => member.roles.has(config.tisiphoneRole)).size;
      let megaSize = userCount.filter(member => member.roles.has(config.megaeraRole)).size;
      embed.addField("Success!", "The mods have been notified that you need a team!");
      var modEmbed = new Discord.RichEmbed().setAuthor(client.user.username, client.user.avatarURL).setColor(0x000000)
        .addField("A new player needs a team!", `\nPlease assign a team to <@${message.author.id}>`)
        .addField("Current team sizes", `${alectoEmoji} ${alectoSize} Alecto players\n${tisiEmoji} ${tisiSize} Tisiphone players\n${megaEmoji} ${megaSize} Megaera players`);
      message.guild.channels.get(config.modChannel).send(`<@&${config.modRole}>`, modEmbed);
    }
  } else if (command === "ping") {
    embed.setAuthor("Ping", client.user.avatarURL)
      .addField("Pong!", `${Date.now() - message.createdTimestamp}ms`);
  } else if (command === "points") {
    embed.setAuthor("Points", client.user.avatarURL);

    const user = getMention(args[0]);
    if (!user) {
      embed.addField("Your current standing is", `Points: ${score.points}\nLevel: ${score.level}\nActivity Level: ${score.activityLevel}`);
    } else if (client.users.has(args[0].slice(3, 21)) || client.users.has(args[0].slice(2, 20))) {

      let userscore = client.getScore.get(user.id, message.guild.id);
      if (!userscore) {
        userscore = {
          id: `${message.guild.id}-${user.id}`,
          user: user.id,
          guild: message.guild.id,
          points: 0,
          level: 1,
          activityLevel: 0
        };
      }

      client.setScore.run(userscore);

      embed.addField(`${message.guild.members.get(user.id).displayName} currently stands at:`, `Points: ${userscore.points}\nLevel: ${userscore.level}\nActivity Level: ${userscore.activityLevel}`);
    } else {
      embed.addField("z.points is broken!", "<@!308224063950553088> plz fix");
    }
  } else if (command === "gamelist") {
    embed
      .setAuthor(client.user.username, client.user.avatarURL)
      .addField("Puzzle Games", "[Golf Peaks](https://mega.nz/#!m2BWCKDS!CWWTzuQGmHf42je3Ogwbcvp2atgTajEX_LGc35EWjdA)\n[The Witness](https://mega.nz/#!HW5DwIZI!42_FgSZH6x6tMZuW6lupE5r7JWCER2GOuq-p9GCZLDM)\n[Human Resource Machine](https://drive.google.com/uc?id=1EFyL9Ui4bvlRK_D14VcySKPRWODubndg&export=download)\n[7 Billion Humans](https://drive.google.com/uc?id=1zvN2-F6InXNqV6VlmA1SdNlw5VW1lFPY&export=download)\n[SpaceChem](https://drive.google.com/file/d/1BV0iuUQ5AiWYFoXArmJtOZXSpkps_R5h/view)\n[Portal Stories: Mel](https://store.steampowered.com/app/317400/Portal_Stories_Mel/)\n The Talos Principle\n^ [Part 1](https://mega.nz/#!Dz4VRJCb!dobjqlHafA2w7NZafGpR35-2dBKkC7jqiBiDIRy-8GU) ^ [Part 2](https://mega.nz/#!zyIFBRLY!mysV_Ak3NvKpPbY_kWdHT2Wx-TQDhv1pZxzH7oNCQIs) ^ [Part 3](https://mega.nz/#!S75WHDoD!473oQcUUDTnIRGBk6-eeuZL6MZ8xltgdlSna6lOMiPo) ^")
      .addField("Dating Sims", "[I Love You, Colonel Sanders](https://store.steampowered.com/app/1121910/I_Love_You_Colonel_Sanders_A_Finger_Lickin_Good_Dating_Simulator/)")
      .addField("Platformers", "[Celeste](https://mega.nz/#!R6IEwSpL!n34RtXEHNTK4mt3L-lco6RKOfPuRmkFrHp4Bv0XjTP8)\n[The End is Nigh](https://mega.nz/#!tVMEyA6J!cPhCag7AANld5KyFvRUxSnlZA41JCCnEXwAcT9EFYnE)")
      .addField("Precision/Skill Games", "[Super Hexagon](https://docs.google.com/uc?id=0Bx62zZHabYj6TE5pNk9hSm5yZms)\n[Just Shapes and Beats](https://mega.nz/#!Th8xRKzB!VzDZD0U6UnEZM0hILshNiAr3O5guugvV4aR_PNB_Mls)\nCrypt of the Necrodancer\n^ [Part 1](https://mega.nz/#!jn53GT7I!LRidYUkUzE_KVuuq4kZknCkryS0ybNFOsPpfU44NZ0w) ^ [Part 2](https://mega.nz/#!Ovxz3JqK!ehAfnuPpO0PJpKXCCUKnv3h33V_PxXtL38E-MIYkV0c) ^")
      .addField("Exploration Games", "[Falcon Age](https://mega.nz/#!jxMTwAoA!PuYtw4AwJPujVhJu0PY3zlAnCs0UlILxe7Z47uUfan8)\n[Sunless Skies](https://mega.nz/#!3192jQTa!xkMk4Ve40hjyog6BwugqPQ_1axiMngYRTHQ6GA7qk8Q)\n[Untitled Goose Game](https://mega.nz/#!lgAADA7b!dp6lOIw3gLqs7WMFSZythiEa6YtqDNQLu8kEy2RE4Ys)\n[Little Inferno](https://drive.google.com/uc?id=136Qk3drnQJ57-JKvo5QS2oFKV5aqnqu9&export=download)");
  }

  //MOD COMMANDS START HERE
  else if (command === "clearpoints" && isMod) {
    embed.setAuthor(client.user.username, client.user.avatarURL);

    const user = getMention(args[0]);
    if (!user && !message.guild.roles.has(args[0].slice(3, 21))) {
      embed.addField("Error", "Please provide a user.");
      message.channel.send(embed).then(msg => {
        msg.delete(5000);
      }).catch(console.error);
      return;
    } else {
      //roles
      if (message.guild.roles.has(args[0].slice(3, 21))) {

        const addTeamPoints = sql.transaction((teamMembers) => {
          for (const member of teamMembers) {
            let userscore = client.getScore.get(member.id, message.guild.id);
            if (!userscore) {
              userscore = {
                id: `${message.guild.id}-${member.id}`,
                user: member.id,
                guild: message.guild.id,
                points: 0,
                level: 1,
                activityLevel: 0
              };
            }
            userscore.points = 0;
            userscore.level = 1;
            client.setScore.run(userscore);
          }
        });

        let teamMembers = message.guild.roles.get(args[0].slice(3, 21)).members.map(m => m.user);
        addTeamPoints(teamMembers);
        embed.addField(`${message.guild.roles.get(args[0].slice(3, 21)).name} has had their points cleared!`, `${prefix}leaderboard to see the top scorers!`);
        message.channel.send(embed).catch(console.error);
        leaderboard(message);
        return;
      }
      //player
      else if (client.users.has(args[0].slice(3, 21)) || client.users.has(args[0].slice(2, 20))) {
        let userscore = client.getScore.get(user.id, message.guild.id);
        if (!userscore) {
          userscore = {
            id: `${message.guild.id}-${user.id}`,
            user: user.id,
            guild: message.guild.id,
            points: 0,
            level: 1,
            activityLevel: 0
          };
        }

        userscore.points = 0;
        userscore.level = 1;

        client.setScore.run(userscore);

        embed.addField(`${message.guild.members.get(user.id).displayName} has had their points cleared and currently stands at:`, `Points: ${userscore.points}\nLevel: ${userscore.level}`);
        message.channel.send(embed).catch(console.error);
        leaderboard(message);
        return;
      } else {
        embed.addField("z.clearpoints is broken", "<@!308224063950553088> plz fix");
      }
    }
  } else if (command === "sethelp" && isMod) {
    //name, perms, desc, params
    const name = args[0];
    let perms = "";
    let desc = "";
    let params = "";
    if (args.length < 4) {
      client.delCommand.run({
        name: name
      });
      message.channel.send(`Deleted command: ${name}`);
      return;
    } else if (args.length === 4) {
      perms = args[1];
      desc = args[2];
      params = args[3];
    } else {
      var args2 = [];
      args.join(" ").match(new RegExp('"[^"]+"|[\\S]+', 'g')).forEach(element => {
        if (!element) return;
        return args2.push(element.replace(/"/g, ''));
      });
      perms = args2[1];
      desc = args2[2];
      params = args2[3];
    }
    client.setCommand.run({
      name: name,
      perms: perms,
      desc: desc,
      params: params
    });
    message.channel.send(`Name: ${name}\nPerms: ${perms}\nDesc: ${desc}\nParams: ${params}`);
    return;
  } else if (command === "givepoints" && isMod) {
    embed.setAuthor(client.user.username, client.user.avatarURL);

    const user = getMention(args[0]);
    if (!user && !message.guild.roles.has(args[0].slice(3, 21))) {
      embed.addField("Error", "Please provide a user.");
      message.channel.send(embed).then(msg => {
        msg.delete(5000);
      }).catch(console.error);
      return;
    } else {
      //roles
      if (message.guild.roles.has(args[0].slice(3, 21))) {

        const pointsToAdd = parseInt(args[1], [10]);
        if (!pointsToAdd) {
          embed.addField("Error", "Please provide how many points to add.");
          message.channel.send(embed).then(msg => {
            msg.delete(5000);
          }).catch(console.error);
          return;
        }
        const addTeamPoints = sql.transaction((teamMembers, pointsToAdd) => {
          for (const member of teamMembers) {
            let userscore = client.getScore.get(member.id, message.guild.id);
            if (!userscore) {
              userscore = {
                id: `${message.guild.id}-${member.id}`,
                user: member.id,
                guild: message.guild.id,
                points: 0,
                level: 1,
                activityLevel: 0
              };
            }
            userscore.points += pointsToAdd;
            client.setScore.run(userscore);
          }
        });

        let teamMembers = message.guild.roles.get(args[0].slice(3, 21)).members.map(m => m.user);
        addTeamPoints(teamMembers, pointsToAdd);
        embed.addField(`${message.guild.roles.get(args[0].slice(3, 21)).name} has been given ${pointsToAdd} points!`, `${prefix}leaderboard to see the top scorers!`);
        message.channel.send(embed).catch(console.error);
        leaderboard(message);
        return;
      }
      //player
      else if (client.users.has(args[0].slice(3, 21)) || client.users.has(args[0].slice(2, 20))) {
        let userscore = client.getScore.get(user.id, message.guild.id);
        const pointsToAdd = parseInt(args[1], [10]);

        if (!pointsToAdd) {
          embed.addField("Error", "Please provide how many points to add.");
          message.channel.send(embed).then(msg => {
            msg.delete(5000);
          }).catch(console.error);
          return;
        } else if (!userscore) {
          userscore = {
            id: `${message.guild.id}-${user.id}`,
            user: user.id,
            guild: message.guild.id,
            points: 0,
            level: 1,
            activityLevel: 0
          };
        }
        userscore.points += pointsToAdd;
        client.setScore.run(userscore);

        embed.addField(`${message.guild.members.get(user.id).displayName} has been given ${pointsToAdd} and currently stands at:`, `Points: ${userscore.points}\nLevel: ${userscore.level}`);
        message.channel.send(embed).catch(console.error);
        leaderboard(message);
        return;
      } else {
        embed.addField("z.givepoints is broken", "<@!308224063950553088> plz fix");
      }
    }
  } else if (command === "mute" && isMod) {
    embed.setAuthor("Mute", client.user.avatarURL);

    let user = message.mentions.members.first() || client.users.get(args[0]);
    if (!user) {
      embed.addField("Error", "You must mention someone!");
      message.channel.send(embed).catch(console.error);
      return;
    } else if (user.roles.has(config.muteRole)) {
      user.removeRole(message.guild.roles.get(config.muteRole)).catch(console.error);
      embed.addField("Success!", "User has been unmuted!");
      message.channel.send(embed).catch(console.error);
      return;
    } else if (!user.roles.has(config.muteRole)) {
      user.addRole(message.guild.roles.get(config.muteRole)).catch(console.error);
      embed.addField("Success", "User has been muted");
      message.channel.send(embed).catch(console.error);
      return;
    }
  } else if (command === "setactivity" && isMod) {
    embed.setAuthor("Set Activity", client.user.avatarURL);
    //.split splits a string at the desired character, in this case a space. It creates an array from the splits. Array starts at 0. https://devdocs.io/javascript/global_objects/string/split
    let args = message.content.split(" ");
    //.splice extracts a section of a string between specified characters and returns it as a new string. In this case it's the second section of the array args. https://devdocs.io/javascript/global_objects/string/slice
    //.join joins elements in an array, with a specified character seperating them, in this case a space. https://devdocs.io/javascript/global_objects/array/join
    var argResult = args.slice(2).join(" ");
    client.user.setActivity(argResult, {
      type: args[1]
    }); //sets Activity to be the second word in the array args, and then sets the type to be the first word in the array.
    //Activity types: Playing, Watching, Listening, Watching
    embed.addField("I am now", `${args[1]} ${argResult}`);

    message.channel.send(embed).catch(console.error);
    return;
  } else if (command === "setpoints" && isMod) {
    embed.setAuthor(client.user.username, client.user.avatarURL);

    const user = getMention(args[0]);
    if (!user && !message.guild.roles.has(args[0].slice(3, 21))) {
      embed.addField("Error", "Please provide a user.");
      message.channel.send(embed).then(msg => {
        msg.delete(5000);
      }).catch(console.error);
      return;
    } else {
      //roles
      if (message.guild.roles.has(args[0].slice(3, 21))) {

        const addTeamPoints = sql.transaction((teamMembers) => {
          for (const member of teamMembers) {
            let userscore = client.getScore.get(member.id, message.guild.id);
            if (!userscore) {
              userscore = {
                id: `${message.guild.id}-${member.id}`,
                user: member.id,
                guild: message.guild.id,
                points: 0,
                level: 1,
                activityLevel: 0
              };
            }
            userscore.points = args[1];
            userscore.level = args[2];
            client.setScore.run(userscore);
          }
        });
        let teamMembers = message.guild.roles.get(args[0].slice(3, 21)).members.map(m => m.user);
        addTeamPoints(teamMembers);
        embed.addField(`${message.guild.roles.get(args[0].slice(3, 21)).name} has had their points set to ${args[1]} and their level to ${args[2]}!`, `${prefix}leaderboard to see the top scorers!`);
        message.channel.send(embed).catch(console.error);
        leaderboard(message);
        return;
      }
      //player>
      else if (client.users.has(args[0].slice(3, 21)) || client.users.has(args[0].slice(2, 20))) {
        let userscore = client.getScore.get(user.id, message.guild.id);
        if (!userscore) {
          userscore = {
            id: `${message.guild.id}-${user.id}`,
            user: user.id,
            guild: message.guild.id,
            points: 0,
            level: 1,
            activityLevel: 0
          };
        }

        userscore.points = args[1];
        userscore.level = args[2];

        client.setScore.run(userscore);

        embed.addField(`${message.guild.members.get(user.id).displayName} has had their points cleared and currently stands at:`, `Points: ${userscore.points}\nLevel: ${userscore.level}`);
        message.channel.send(embed).catch(console.error);
        leaderboard(message);
        return;
      } else {
        embed.addField("z.setpoints is broken", "<@!308224063950553088> plz fix");
      }
    }
  } else if (command === "testwin" && isMod) {
    embed.setAuthor(client.user.username, client.user.avatarURL)
      .setColor(0x000000)
      .addField("Yo dude this is like", "totally the right channel, wow");
    client.channels.get("615454759784022026").send(embed);
    return;
  }
  //not a command
  else {
    embed.setAuthor("Error", client.user.avatarURL)
      .addField("Whoa there!", `That's not a command! Use ${prefix}help for a list of commands!`);
    message.channel.send(embed).then(msg => {
      msg.delete(5000);
    }).catch(console.error); //https://discord.js.org/#/docs/main/stable/class/Message?scrollTo=delete
    return;
  }

  const botChannel = message.guild.channels.get(config.botChannel);
  const botDevChannel = message.guild.channels.get(config.botDevChannel);

  if (message.channel === botDevChannel) {
      botDevChannel.send(embed).catch(console.error);
  } else {
    if (message.channel !== botChannel) {
      botChannel.send(`<@${message.author.id}>`);
    }
    botChannel.send(embed).catch(console.error); //sends embed
  }
});

client.login(process.env.TOKEN);