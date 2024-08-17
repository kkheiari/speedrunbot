const { Client, Intents } = require('discord.js');
const fs = require('fs');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Bot-Token aus Umgebungsvariablen lesen
const token = process.env.DISCORD_BOT_TOKEN;

// Datei zum Speichern der Speedruns
const speedrunsFile = 'speedruns.json';

// Lade gespeicherte Speedruns
let speedruns = {};
if (fs.existsSync(speedrunsFile)) {
    speedruns = JSON.parse(fs.readFileSync(speedrunsFile, 'utf8'));
}

// Prüft, ob die Zeit im Format "MM:SS" vorliegt
const isValidTimeFormat = (time) => {
    return /^([0-5][0-9]):([0-5][0-9])$/.test(time);
};

// Speichert einen Speedrun
const saveSpeedrun = (game, time, user) => {
    if (!speedruns[game]) {
        speedruns[game] = [];
    }
    speedruns[game].push({ time, user });
    speedruns[game].sort((a, b) => {
        const [aMin, aSec] = a.time.split(':').map(Number);
        const [bMin, bSec] = b.time.split(':').map(Number);
        return (aMin * 60 + aSec) - (bMin * 60 + bSec);
    });
    fs.writeFileSync(speedrunsFile, JSON.stringify(speedruns, null, 4), 'utf8');
};

// Befehl zur Verarbeitung der Nachrichten
client.on('messageCreate', message => {
    if (message.content.startsWith('!speedrun')) {
        const args = message.content.split(' ').slice(1);
        if (args.length !== 2) {
            message.channel.send('Bitte gib das Spiel und die Zeit im Format MM:SS an.');
            return;
        }
        
        const [game, time] = args;
        if (!isValidTimeFormat(time)) {
            message.channel.send('Die Zeit muss im Format MM:SS sein.');
            return;
        }
        
        saveSpeedrun(game, time, message.author.tag);
        message.channel.send('Speedrun gespeichert!');
    }

    if (message.content.startsWith('!liste')) {
        const args = message.content.split(' ').slice(1);
        if (args.length !== 1) {
            message.channel.send('Bitte gib das Spiel an, für das du die Liste sehen möchtest.');
            return;
        }
        
        const game = args[0];
        if (!speedruns[game] || speedruns[game].length === 0) {
            message.channel.send('Keine Speedruns für dieses Spiel gefunden.');
            return;
        }
        
        const leaderboard = speedruns[game].map((run, index) => `${index + 1}. ${run.user} - ${run.time}`).join('\n');
        message.channel.send(`Speedruns für **${game}**:\n${leaderboard}`);
    }
});

client.once('ready', () => {
    console.log('Bot ist bereit!');
});

client.login(token);
