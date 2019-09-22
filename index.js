//z.startFold - Ping Machine
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
//z.endFold


//meat of the bot
//z.startFold - require documents
const Discord = require("discord.js");
const SQLite = require("better-sqlite3");
const sql = new SQLite("./main.sqlite");
const config = require("./config.json");
//z.endFold
//z.startFold - define client, date, prefix, and score
const client = new Discord.Client();
var date = new Date();
var prefix = config.prefix;
let score;
//z.endFold

client.on("ready",() => {
  console.log(`I'm online at ${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`);

  //sql shit
  //check if table already exists
  const table = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'scores';").get();
  if (!table["count(*)"]) {
    //If the table ain't there, create it and set it up properly
    sql.prepare("CREATE TABLE scores (id TEXT PRIMARY KEY, user TEXT, guild TEXT, points INTEGER, level INTEGER, activityLevel INTEGER);").run();
    //make sure the row ID is always unique and unindexed
    sql.prepare("CREATE UNIQUE INDEX idx_scores_id ON scores (id);").run();
    sql.pragma("synchronous = 1");
    sql.pragma("journal_mode = wal");
  }

  //prepared to get and store point data
  client.addColumn = sql.prepare("ALTER TABLE scores ADD COLUMN activityLevel INTEGER");
  client.getScore = sql.prepare("SELECT * FROM scores WHERE user = ? AND guild = ?");
  client.setScore = sql.prepare("INSERT OR REPLACE INTO scores (id, user, guild, points, level) VALUES (@id, @user, @guild, @points, @level);");
});

client.on("guildMemberAdd", (member) => {
  const newMember = member.guild.roles.get("606269975128178690").id;
  member.addRole(newMember);

  client.channels.get("607677933330628621").send(new Discord.RichEmbed()
    .setAuthor(client.user.username, client.user.avatarURL)
    .setColor(0x000000)
    .addField(
      `Welcome, ${member.displayName}!`,
      `-Hey there, and welcome to Bounty! We're a server dedicated to creating a competitive environment for solving ARG-style puzzles!\n
      -Please check out our ${client.channels.get("601398676472201216")} channel and make sure you can abide by them (they're pretty basic rules, nothing too terribly fancy).\n
      -After that, type z.joinTeam and a mod will add you to a team ASAP!\n
      -Once you're part of a team, you'll be able to see the active puzzle as well as past puzzles, and your team should help you through the rest!\n
      -Most importantly, have fun!`
    )).catch(console.error);
});

client.on("message", message => {
  //z.startFold - user filter
  if (!message.content.startsWith(prefix)|| message.author === client.user || message.author.bot || !message.guild) return;
  //z.endFold
  //z.startFold - define things
  const modRoles = message.guild.roles.get("599162538541711361").id;
  const pokeRole = message.guild.roles.get("615371237970935809");
  const pornRole = message.guild.roles.get("616736785682399248");
  const muteRole = message.guild.roles.get("615598648931123200");

  const leaderboardChannel = client.channels.get("625359487141937154");
  //z.endFold
  //z.startFold - defining arguments
  //argument variables
  //slice removes prefix, trim any whitespace surrounding the command, split the string beteen spaces of any amount.
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  //shift removes the first entry of the array, changing the value of the array as well
  const command = args.shift().toLowerCase();
  //z.endFold
  //z.startFold - SQL
  score = client.getScore.get(message.author.id, message.guild.id);
  if (!score) {
    score = { id: `${message.guild.id}-${message.author.id}`, user: message.author.id, guild: message.guild.id, points: 0, level: 1};
  }
  score.activityLevel++;
  const curLevel = Math.floor(0.1 * Math.sqrt(score.points));
  if (score.level < curLevel) {
    score.level++;
  }
  client.setScore.run(score);
  //z.endFold
  //z.startFold - get mentions
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
  //z.endFold
  //z.startFold - leaderboard
  function leaderboard() {
    let leaderboardEmbed = new Discord.RichEmbed().setColor(0x000000)
    .setAuthor("Top 10 Scoring Players!", client.user.avatarURL);
    //creates variable equal to an array that lists the top 10 scorers.
    const top10 = sql.prepare("SELECT * FROM scores WHERE guild = ? ORDER BY points DESC LIMIT 10;").all(message.guild.id);

    for (let data of top10) {
      if (!client.users.get(data.user)) continue;
      leaderboardEmbed.addField(`${message.guild.members.get(client.users.get(data.user).id).displayName}`, `${data.points} points, level ${data.level}`);
    }
    //message ID 625360059785936926
    leaderboardChannel.fetchMessages({around: "625360059785936926", limit: 1})
      .then(messages => {
        const fetchedMsg = messages.first();
        fetchedMsg.edit(leaderboardEmbed);
      });
  }
  //z.endFold
  //z.startFold - embed template
  let embed = new Discord.RichEmbed().setColor(0x000000);
  //z.endFold
  //commands
  //z.startFold - commands
  //z.startFold - help
  if (command === "help" ) {


    const dmSent = new Discord.RichEmbed().setAuthor("Help", client.user.avatarURL).setColor(0x000000).addField("DM Sent!", "You've been sent a DM that lists the commands!");

    let cmdList = [
      {
        name: "help",
        perms: "none",
        description: "You can probably figure this one out"
      },
      {
        name: "info",
        perms: "none",
        description: "Displays info about the server or provided channel"
      },
      {
        name: "NSFW",
        perms: "none",
        description: "Adds you to the NSFW role"
      },
      {
        name: "Pokecord",
        perms: "none",
        description: "Adds you to the Poke Nerd role"
      },
      {
        name: "jointeam",
        perms: "none",
        description: "Tells the mods to add you to a team"
      },
      {
        name: "leaderboard",
        perms: "none",
        description: "Lists the top 10 scoring players"
      },
      {
        name: "ping",
        perms: "none",
        description: "Pings the bot and outputs response time"
      },
      {
        name: "points",
        perms: "none",
        description: "Outputs your points and level"
      },
      {
        name: "clearpoints",
        perms: "mod",
        description: "Clears a user's points and level"
      },
      {
        name: "givepoints",
        perms: "mod",
        description: "Gives the target the specified amount of points"
      },
      {
        name: "mute",
        perms: "mod",
        description: "Toggles the muted status of the mentioned user"
      },
      {
        name: "setactivity",
        perms: "mod",
        description: "Sends a goat at a random time interval"
      },
      {
        name: "setpoints",
        perms: "mod",
        description: "Sets a user's points and level"
      },
      {
        name: "testwin",
        perms: "mod",
        description: "Sends a test message to a channel in the testing server"
      }
    ];

    embed.setAuthor("Command Help", client.user.avatarURL);

    let desc = "";
    for (let info = 0; info < cmdList.length; info++) {
      if (cmdList[info].perms === "mod" && !message.member.roles.has(modRoles)) continue;

      let text1 = `\n**z.${cmdList[info].name}**\n${cmdList[info].description}\n`;
      desc = text1 + desc;
      embed.setDescription(desc);
    }
    message.member.send(embed);
    message.channel.send(dmSent).then(msg => {msg.delete(5000);}).catch(console.error);
    return;
  }
  //z.endFold
  //z.startFold - info
  else if (command === "info") {

    let channel = args[0];
    const onlineEmoji = client.emojis.find(emoji => emoji.name === "online");
    const offlineEmoji = client.emojis.find(emoji => emoji.name === "offline");
    const alectoEmoji = client.emojis.find(emoji => emoji.name === "coinAlecto");
    const megaEmoji = client.emojis.find(emoji => emoji.name === "coinMegaera");
    const tisiEmoji = client.emojis.find(emoji => emoji.name === "coinTisiphone");


    if (!channel) {

      const userCount = message.guild.members.filter(member => !member.user.bot === true);
      let botCount = message.guild.members.filter(member => member.user.bot === true);
      let online = userCount.filter(member => member.user.presence.status !== "offline").size;

      let alectoSize = userCount.filter(member => member.roles.has("603713542432227348")).size;
      let tisiSize = userCount.filter(member => member.roles.has("603713554855493643")).size;
      let megaSize = userCount.filter(member => member.roles.has("603713544990752788")).size;

      let alectoOnline = userCount.filter(member => member.roles.has("603713542432227348") && member.user.presence.status !== "offline").size;
      let tisiOnline = userCount.filter(member => member.roles.has("603713554855493643") && member.user.presence.status !== "offline").size;
      let megaOnline = userCount.filter(member => member.roles.has("603713544990752788") && member.user.presence.status !== "offline").size;

      embed.setAuthor("Bounty", client.user.avatarURL)
        .setDescription("A server dedicated to creating a friendly but competitive puzzle-solving environment!")
        .setFooter(`Bounty created on ${message.guild.createdAt.toString().slice(0, 15)} because other bots suck`, "https://cdn.glitch.com/39aa19a3-f12a-47f0-a2a7-f8a89d8d451d%2Fz.avatar.png?v=1567397815049")
        .setThumbnail(message.guild.iconURL)
        .setTitle(`${message.guild.memberCount} Members - [Users ${userCount.size} | ${botCount.size} Bots]`)
        .addField("Members",
          `${onlineEmoji}${online} Online
          ${offlineEmoji}${userCount.size - online} Offline
          ${alectoEmoji}${alectoOnline}/${alectoSize} Alecto players online
          ${tisiEmoji}${tisiOnline}/${tisiSize} Tisiphone players online
          ${megaEmoji}${megaOnline}/${megaSize} Megaera players online`)
        .addField("Region", message.guild.region, true)
        .addField("Channels", message.guild.channels.size, true)
        .addField("Roles", message.guild.roles.size, true);
    }
    else if (message.guild.channels.has(args[0].slice(2, 20))) {

      channel = args[0].slice(2, 20);

      const userCount = message.guild.channels.get(channel).members.filter(member => !member.user.bot === true);
      let botCount = message.guild.channels.get(channel).members.filter(member => member.user.bot === true);
      let online = userCount.filter(member => member.user.presence.status !== "offline").size;



      let alectoSize = userCount.filter(member => member.roles.has("603713542432227348")).size;
      let tisiSize = userCount.filter(member => member.roles.has("603713554855493643")).size;
      let megaSize = userCount.filter(member => member.roles.has("603713544990752788")).size;

      let alectoOnline = userCount.filter(member => member.roles.has("603713542432227348") && member.user.presence.status !== "offline").size;
      let tisiOnline = userCount.filter(member => member.roles.has("603713554855493643") && member.user.presence.status !== "offline").size;
      let megaOnline = userCount.filter(member => member.roles.has("603713544990752788") && member.user.presence.status !== "offline").size;

      embed.setAuthor(message.guild.channels.get(channel).name, client.user.avatarURL)
        .setFooter(`Bounty created on ${message.guild.createdAt.toString().slice(0, 15)} because other bots suck`, "https://cdn.glitch.com/39aa19a3-f12a-47f0-a2a7-f8a89d8d451d%2Fz.avatar.png?v=1567397815049")
        .setThumbnail(message.guild.iconURL)
        .setTitle(`${userCount.size + botCount.size} Members - [Users ${userCount.size} | ${botCount.size} Bots]`)
        .addField("Members",
          `${onlineEmoji}${online} Online
          ${offlineEmoji}${userCount.size - online} Offline
          ${alectoEmoji}${alectoOnline}/${alectoSize} Alecto players online
          ${tisiEmoji}${tisiOnline}/${tisiSize} Tisiphone players online
          ${megaEmoji}${megaOnline}/${megaSize} Megaera players online`)
        .addField("Category", `${message.guild.channels.get(channel).parent}`, true)
        .addField("Channel created on", `${message.guild.channels.get(channel).createdAt.toString().slice(0, 15)}`, true);
    }
    else {

      embed.setAuthor("Error!", client.user.avatarURL)
        .setDescription("Please enter a channel!");
      message.channel.send(embed).then(msg => {msg.delete(5000);}).catch(console.error);
      return;
    }
  }
  //z.endFold
  //z.startFold - NSFW
  else if (command === "nsfw") {


    embed.setAuthor("Join NSFW", message.author.avatarURL);

    if (message.member.roles.has(pornRole.id)) {
      message.member.removeRole(pornRole).catch(console.error);
      embed.addField("Success!", "You've left the NSFW channel!");
    }
    else if (!message.member.roles.has(pornRole.id)) {
      message.member.addRole(pornRole).catch(console.error);
      embed.addField("Success!", "Welcome to the NSFW channel!");
    }
    else {
      embed.addField("z.nsfw is broken!", "<@!308224063950553088> plz fix");
    }
  }
  //z.endFold
  //z.startFold - Pokecord
  else if (command === "pokecord") {

    embed.setAuthor("Join Pokecord", message.author.avatarURL);

    if (message.member.roles.has(pokeRole.id)) {
      message.member.removeRole(pokeRole).catch(console.error);
      embed.addField("Success!", "You've left the Pokenerd channel!");
    }
    else if (!message.member.roles.has(pokeRole.id)) {
      message.member.addRole(pokeRole).catch(console.error);
      embed.addField("Success!", "Welcome to the Pokenerd channel!");
    }
    else {
      embed.addField("z.pokecord is broken!", "<@!308224063950553088> plz fix");
    }
  }
  //z.endFold
  //z.startFold - joinTeam
  else if (command === "jointeam") {

    embed.setAuthor("Join a team!", client.user.avatarURL);

    if (message.member.roles.has("603713554855493643") || message.member.roles.has("603713544990752788") || message.member.roles.has("603713542432227348")) {
      embed.addField("Error!", "You're already in a team!");
      message.channel.send(embed).then(msg => {msg.delete(5000);}).catch(console.error);
      return;
    }
    else {
      embed.addField("Success!", "The mods have been notified that you need a team!");
      message.guild.channels.get("605705541582454784").send(new Discord.RichEmbed().setAuthor(client.user.username, client.user.avatarURL).setColor(0x000000).addField("A new player needs a team!", `<@&599162538541711361>\nPlease assign a team to <@${message.author.id}>`));
    }
  }
  //z.endFold
  //z.startFold - ping
  else if (command === "ping") {

    embed.setAuthor("Ping", client.user.avatarURL)
      .addField("Pong!", `${Date.now() - message.createdTimestamp}ms`);
  }
  //z.endFold
  //z.startFold - points
  else if (command === "points") {

    embed.setAuthor("Points", client.user.avatarURL);

    const user = getMention(args[0]);
    if (!user) {
      embed.addField("Your current points and level are:", `Points: ${score.points}\nLevel: ${score.level}`);
    }
    else if (client.users.has(args[0].slice(3, 21)) || client.users.has(args[0].slice(2, 20))) {

      let userscore = client.getScore.get(user.id, message.guild.id);
      if (!userscore) {
        userscore = { id: `${message.guild.id}-${user.id}`, user: user.id, guild: message.guild.id, points: 0, level: 1 };
      }

      client.setScore.run(userscore);

      embed.addField(`${message.guild.members.get(user.id).displayName} currently stands at:`, `Points: ${userscore.points}\nLevel: ${userscore.level}`);
    }
    else {
      embed.addField("z.points is broken!", "<@!308224063950553088> plz fix");
    }
  }
  //z.endFold
  //mod commands start here
  //z.startFold - clearpoints
  else if (command === "clearpoints" && message.member.roles.has(modRoles)) {

    embed.setAuthor(client.user.username, client.user.avatarURL);

    const user = getMention(args[0]);
    if(!user && !message.guild.roles.has(args[0].slice(3, 21))) {
      embed.addField("Error", "Please provide a user.");
      message.channel.send(embed).then(msg => {msg.delete(5000);}).catch(console.error);
      return;
    }
    else {
      //roles
      if (message.guild.roles.has(args[0].slice(3, 21))){

        const addTeamPoints = sql.transaction((teamMembers) => {
          for (const member of teamMembers) {
            let userscore = client.getScore.get(member.id, message.guild.id);
            if (!userscore) {
              userscore = { id: `${message.guild.id}-${member.id}`, user: member.id, guild: message.guild.id, points: 0, level: 1 };
            }
            userscore.points = 0;
            userscore.level = 1;
            client.setScore.run(userscore);
          }
        });

        let teamMembers = message.guild.roles.get(args[0].slice(3, 21)).members.map(m => m.user);
        addTeamPoints(teamMembers);
        embed.addField(`${message.guild.roles.get(args[0].slice(3, 21)).name} has had their points cleared!`, "z.leaderboard to see the top scorers!");
        message.channel.send(embed).catch(console.error);
        return;
      }
      //player
      else if (client.users.has(args[0].slice(3, 21)) || client.users.has(args[0].slice(2, 20))) {

        let userscore = client.getScore.get(user.id, message.guild.id);
        if (!userscore) {
          userscore = { id: `${message.guild.id}-${user.id}`, user: user.id, guild: message.guild.id, points: 0, level: 1 };
        }

        userscore.points = 0;
        userscore.level = 1;

        client.setScore.run(userscore);

        embed.addField(`${message.guild.members.get(user.id).displayName} has had their points cleared and currently stands at:`, `Points: ${userscore.points}\nLevel: ${userscore.level}`);
        message.channel.send(embed).catch(console.error);
        return;
      }
      else {
        embed.addField("z.clearpoints is broken", "<@!308224063950553088> plz fix");
      }
    }
  }
  //z.endFold
  //z.startFold - givepoints
  else if (command === "givepoints" && message.member.roles.has(modRoles)) {

    embed.setAuthor(client.user.username, client.user.avatarURL);

    const user = getMention(args[0]);
    if(!user && !message.guild.roles.has(args[0].slice(3, 21))) {
      embed.addField("Error", "Please provide a user.");
      message.channel.send(embed).then(msg => {msg.delete(5000);}).catch(console.error);
      return;
    }
    else {
      //roles
      if (message.guild.roles.has(args[0].slice(3, 21))){

        const pointsToAdd = parseInt(args[1], [10]);
        if(!pointsToAdd) {
          embed.addField("Error", "Please provide how many points to add.");
          message.channel.send(embed).then(msg => {msg.delete(5000);}).catch(console.error);
          return;
        }
        const addTeamPoints = sql.transaction((teamMembers, pointsToAdd) => {
          for (const member of teamMembers) {
            let userscore = client.getScore.get(member.id, message.guild.id);
            if (!userscore) {
              userscore = { id: `${message.guild.id}-${member.id}`, user: member.id, guild: message.guild.id, points: 0, level: 1 };
            }
            userscore.points += pointsToAdd;
            client.setScore.run(userscore);
          }
        });

        let teamMembers = message.guild.roles.get(args[0].slice(3, 21)).members.map(m => m.user);
        addTeamPoints(teamMembers, pointsToAdd);
        embed.addField(`${message.guild.roles.get(args[0].slice(3, 21)).name} has been given ${pointsToAdd} points!`, "z.leaderboard to see the top scorers!");
        message.channel.send(embed).catch(console.error);
        leaderboard();
        return;
      }
      //player
      else if (client.users.has(args[0].slice(3, 21)) || client.users.has(args[0].slice(2, 20))) {
        let userscore = client.getScore.get(user.id, message.guild.id);
        const pointsToAdd = parseInt(args[1], [10]);

        if(!pointsToAdd) {
          embed.addField("Error", "Please provide how many points to add.");
          message.channel.send(embed).then(msg => {msg.delete(5000);}).catch(console.error);
          return;
        }
        else if (!userscore) {
          userscore = { id: `${message.guild.id}-${user.id}`, user: user.id, guild: message.guild.id, points: 0, level: 1 };
        }
        userscore.points += pointsToAdd;
        client.setScore.run(userscore);

        embed.addField(`${message.guild.members.get(user.id).displayName} has been given ${pointsToAdd} and currently stands at:`, `Points: ${userscore.points}\nLevel: ${userscore.level}`);
        message.channel.send(embed).catch(console.error);
        leaderboard();
        return;
      }
      else {
        embed.addField("z.givepoints is broken", "<@!308224063950553088> plz fix");
      }
    }
  }
  //z.endFold
  //z.startFold - mute
  else if (command === "mute" && message.member.roles.has(modRoles)) {

    embed.setAuthor("Mute", client.user.avatarURL);

    let user = message.mentions.members.first() || client.users.get(args[0]);
    if(!user) {
      embed.addField("Error", "You must mention someone!");
      message.channel.send(embed).catch(console.error);
      return;
    }
    else if (user.roles.has(muteRole.id)) {
      user.removeRole(muteRole).catch(console.error);
      embed.addField("Success!", "User has been unmuted!");
      message.channel.send(embed).catch(console.error);
      return;
    }
    else if(!user.roles.has(muteRole.id)) {
      user.addRole(muteRole).catch(console.error);
      embed.addField("Success", "User has been muted");
      message.channel.send(embed).catch(console.error);
      return;
    }
  }
  //z.endFold
  //z.startFold - setActivity
  else if (command === "setactivity" && message.member.roles.has(modRoles)) {

    embed.setAuthor("Set Activity", client.user.avatarURL);
    //.split splits a string at the desired character, in this case a space. It creates an array from the splits. Array starts at 0. https://devdocs.io/javascript/global_objects/string/split
    let args = message.content.split(" ");
    //.splice extracts a section of a string between specified characters and returns it as a new string. In this case it's the second section of the array args. https://devdocs.io/javascript/global_objects/string/slice
    //.join joins elements in an array, with a specified character seperating them, in this case a space. https://devdocs.io/javascript/global_objects/array/join
    var argResult = args.slice(2).join(" ");
    client.user.setActivity(argResult, {type : args[1]});//sets Activity to be the second word in the array args, and then sets the type to be the first word in the array.
    //Activity types: Playing, Watching, Listening, Watching
    embed.addField("I am now", `${args[1]} ${argResult}`);

    message.channel.send(embed).catch(console.error);
    return;
  }
  //z.endFold
  //z.startFold - setpoints
  else if (command === "setpoints" && message.member.roles.has(modRoles)) {

    embed.setAuthor(client.user.username, client.user.avatarURL);

    const user = getMention(args[0]);
    if(!user && !message.guild.roles.has(args[0].slice(3, 21))) {
      embed.addField("Error", "Please provide a user.");
      message.channel.send(embed).then(msg => {msg.delete(5000);}).catch(console.error);
      return;
    }
    else {
      //roles
      if (message.guild.roles.has(args[0].slice(3, 21))){

        const addTeamPoints = sql.transaction((teamMembers) => {
          for (const member of teamMembers) {
            let userscore = client.getScore.get(member.id, message.guild.id);
            if (!userscore) {
              userscore = { id: `${message.guild.id}-${member.id}`, user: member.id, guild: message.guild.id, points: 0, level: 1 };
            }
            userscore.points = args[1];
            userscore.level = args[2];
            client.setScore.run(userscore);
          }
        });

        let teamMembers = message.guild.roles.get(args[0].slice(3, 21)).members.map(m => m.user);
        addTeamPoints(teamMembers);
        embed.addField(`${message.guild.roles.get(args[0].slice(3, 21)).name} has had their points set to ${args[1]} and their level to ${args[2]}!`, "z.leaderboard to see the top scorers!");
        message.channel.send(embed).catch(console.error);
        return;
      }
      //player
      else if (client.users.has(args[0].slice(3, 21)) || client.users.has(args[0].slice(2, 20))) {

        let userscore = client.getScore.get(user.id, message.guild.id);
        if (!userscore) {
          userscore = { id: `${message.guild.id}-${user.id}`, user: user.id, guild: message.guild.id, points: 0, level: 1 };
        }

        userscore.points = args[1];
        userscore.level = args[2];

        client.setScore.run(userscore);

        embed.addField(`${message.guild.members.get(user.id).displayName} has had their points cleared and currently stands at:`, `Points: ${userscore.points}\nLevel: ${userscore.level}`);
        message.channel.send(embed).catch(console.error);
        return;
      }
      else {
        embed.addField("z.setpoints is broken", "<@!308224063950553088> plz fix");
      }
    }
  }
  //z.endFold
  //z.startFold - testwin
  else if (command === "testwin" && message.member.roles.has(modRoles)) {

    embed.setAuthor(client.user.username, client.user.avatarURL)
      .setColor(0x000000)
      .addField("Yo dude this is like", "totally the right channel, wow");
    client.channels.get("615454759784022026").send(embed);
    return;
  }
  //z.endFold
  //not a command
  else if (message.content.startsWith(prefix)) {

    embed.setAuthor("Error", client.user.avatarURL)
      .addField("Whoa there!", `That's not a command! Use ${prefix} for a list of commands!`);
    message.channel.send(embed).then(msg => {msg.delete(5000);}).catch(console.error); //https://discord.js.org/#/docs/main/stable/class/Message?scrollTo=delete
    return;
  }
  //end ifs
  else {
    return;
  }
  //z.endFold
  if(message.channel === message.guild.channels.get("616344562822283271")) {
    message.guild.channels.get("616344562822283271").send(embed).catch(console.error); //sends embed
  }
  else {
    message.guild.channels.get("616344562822283271").send(`<@${message.author.id}>`);
    message.guild.channels.get("616344562822283271").send(embed).catch(console.error); //sends embed
  }

});

//client.login(process.env.TOKEN);
