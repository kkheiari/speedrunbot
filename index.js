import dotenv from 'dotenv';
dotenv.config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const { exec } = require('child_process');

// Bot-Token aus Umgebungsvariablen lesen
const token = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// Datei zum Speichern der Speedruns
const speedrunsFile = 'speedruns.json';

// Lade gespeicherte Speedruns
let speedruns = {};
if (fs.existsSync(speedrunsFile)) {
    try {
        speedruns = JSON.parse(fs.readFileSync(speedrunsFile, 'utf8'));
    } catch (err) {
        console.error('Fehler beim Laden der Speedruns:', err);
    }
}

const startTime = Date.now();

// Function to get the elapsed time
function getElapsedTime() {
    const elapsedMS = Date.now() - startTime;
    const hours = Math.floor(elapsedMS / (1000 * 60 * 60));
    const minutes = Math.floor((elapsedMS % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsedMS % (1000 * 60)) / 1000);
    return `${hours} Stunden, ${minutes} Minuten und ${seconds} Sekunden`;
}

// Prüft, ob die Zeit im Format "HH:MM:SS.MS" vorliegt
const isValidTimeFormat = (time) => {
    return /^([0-9][0-9]):([0-5][0-9]):([0-5][0-9])\.([0-9]{1,3})$/.test(time);
};

// Capitalize the first letter and make the rest lowercase
const capitalizeFirstLetter = (str) => {
    str = str.toLowerCase();
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// Save speedrun function
const saveSpeedrun = (game, time, user) => {
    if (!speedruns[game]) {
        speedruns[game] = [];
    }
    
    // Add the new speedrun
    speedruns[game].push({ time, user });

    // Sort the runs
    speedruns[game].sort((a, b) => {
        const timeToSeconds = (time) => {
            const [hours, minutes, seconds, milliseconds] = time.split(/[:.]/).map(Number);
            return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
        };
        return timeToSeconds(a.time) - timeToSeconds(b.time);
    });

    // Update placements
    speedruns[game] = speedruns[game].map((run, index) => ({ ...run, placement: index + 1 }));

    // Save the updated list
    try {
        fs.writeFileSync(speedrunsFile, JSON.stringify(speedruns, null, 4), 'utf8');
    } catch (err) {
        console.error('Fehler beim Speichern der Speedruns:', err);
    }
};

// Remove speedrun function
const removeSpeedrun = (game, placement, user) => {
    if (!speedruns[game]) return false;

    const indexToRemove = speedruns[game].findIndex(run => run.user === user && run.placement === parseInt(placement));
    if (indexToRemove === -1) return false;

    speedruns[game].splice(indexToRemove, 1);

    if (speedruns[game].length === 0) {
        delete speedruns[game];
    } else {
        speedruns[game] = speedruns[game].map((run, index) => ({ ...run, placement: index + 1 }));
    }

    try {
        fs.writeFileSync(speedrunsFile, JSON.stringify(speedruns, null, 4), 'utf8');
    } catch (err) {
        console.error('Fehler beim Speichern der Speedruns:', err);
    }
    return true;
};

// Show user speedruns
const showUserSpeedruns = (user) => {
    let userSpeedruns = [];
    for (const [game, runs] of Object.entries(speedruns)) {
        const userRuns = runs.filter(run => run.user === user);
        if (userRuns.length > 0) {
            const runsText = userRuns.map(run => `${game} - Platzierung: ${run.placement}, Zeit: ${run.time}`).join('\n');
            userSpeedruns.push(runsText);
        }
    }
    return userSpeedruns.length > 0 ? userSpeedruns.join('\n') : 'Keine Speedruns gefunden.';
};

// Create a new Client instance with necessary intents
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
    ]
});

// Command processing
client.on('messageCreate', async message => {
    if (message.channel.id !== CHANNEL_ID) return; // Ignore messages from other channels
    if (message.author.bot) return; // Ignore bot messages

    const content = message.content.toLowerCase().trim();

    if (content.startsWith('!speedrun')) {
        const args = content.slice('!speedrun'.length).trim();
        const lastSpaceIndex = args.lastIndexOf(' ');
        if (lastSpaceIndex === -1) {
            message.channel.send('Bitte gib das Spiel und die Zeit im Format "HH:MM:SS.MS" an. Beispiel: !speedrun Super Mario 64 01:23.45');
            return;
        }

        const gameTitle = capitalizeFirstLetter(args.slice(0, lastSpaceIndex).trim());
        const timeFormat = args.slice(lastSpaceIndex + 1).trim();
        
        if (!isValidTimeFormat(timeFormat)) {
            message.channel.send('Die Zeit ist im falschen Format. Bitte benutze "HH:MM:SS.MS". Beispiel: !speedrun Super Mario 64 01:23.45');
            return;
        }
        
        saveSpeedrun(gameTitle, timeFormat, message.author.tag);
        message.channel.send('Speedrun gespeichert!');
    }

    if (content.startsWith('!remove')) {
        const args = content.slice('!remove'.length).trim();
        const [placementStr, ...gameTitleParts] = args.split(',');
        const gameTitle = capitalizeFirstLetter(gameTitleParts.join(',').trim());
        const placement = placementStr.trim();

        if (!placement || !gameTitle) {
            message.channel.send('Bitte gib den Speedrun im Format "Platzierung,Spiel" an, um den Speedrun zu entfernen. Beispiel: !remove 10,Super Mario 64');
            return;
        }

        if (isNaN(placement)) {
            message.channel.send('Die Platzierung muss eine Zahl sein.');
            return;
        }

        const success = removeSpeedrun(gameTitle, placement, message.author.tag);
        message.channel.send(success ? 'Speedrun entfernt!' : 'Der angegebene Speedrun existiert nicht.');
    }

    if (message.content.startsWith('!user')) {
        const input = message.content.slice('!user'.length).trim();
        
        if (!input) {
            message.channel.send('Bitte gib den Benutzernamen oder Nicknamen an, für den du die Speedruns sehen möchtest.');
            return;
        }
        
        const member = message.guild.members.cache.find(member =>
            member.user.username.toLowerCase() === input.toLowerCase() ||
            (member.nickname && member.nickname.toLowerCase() === input.toLowerCase()) ||
            (member.user.globalName && member.user.globalName.toLowerCase() === input.toLowerCase())
        );
        
        if (!member) {
            message.channel.send('Benutzer nicht gefunden. Bitte stelle sicher, dass der Name korrekt ist.');
            return;
        }
        
        const userTag = member.user.tag;
        
        try {
            const userSpeedruns = showUserSpeedruns(userTag);
            if (userSpeedruns) {
                message.channel.send(`Speedruns von **${userTag}**:\n${userSpeedruns}`);
            } else {
                message.channel.send('Keine Speedruns für diesen Benutzer gefunden.');
            }
        } catch (error) {
            console.error('Fehler beim Abrufen der Speedruns:', error);
            message.channel.send('Beim Abrufen der Speedruns ist ein Fehler aufgetreten.');
        }
    }
    
    if (content.startsWith('!liste')) {
        const args = content.slice('!liste'.length).trim();
        if (!args) {
            message.channel.send('Bitte gib das Spiel an, für das du die Liste sehen möchtest.');
            return;
        }
    
        const game = capitalizeFirstLetter(args);
        if (!speedruns[game] || speedruns[game].length === 0) {
            message.channel.send('Keine Speedruns für dieses Spiel gefunden.');
            return;
        }
    
        const bestSpeedruns = new Map();
        speedruns[game].forEach(run => {
            if (!bestSpeedruns.has(run.user) || bestSpeedruns.get(run.user).time > run.time) {
                bestSpeedruns.set(run.user, run);
            }
        });
    
        const sortedSpeedruns = Array.from(bestSpeedruns.values())
            .sort((a, b) => {
                const timeToSeconds = (time) => {
                    const [hours, minutes, seconds, milliseconds] = time.split(/[:.]/).map(Number);
                    return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
                };
                return timeToSeconds(a.time) - timeToSeconds(b.time);
            });
    
        const leaderboard = sortedSpeedruns
            .map((run, index) => {
                let medal = '';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';
                return `${medal} ${index + 1}. ${run.user} - ${run.time}`;
            })
            .join('\n');
    
        message.channel.send(`Speedruns für **${game}**:\n${leaderboard}`);
    }
    
    if (content.startsWith('!info')) {
        message.channel.send(`Der Bot wurde von @derkaiyo erstellt. Commands:
        !speedrun <Spielname> <Zeit> - Speichert deine SpeedRun-Zeit. Format: "HH:MM:SS.MS".
        !remove <Platzierung>,<Spielname> - Entfernt einen Speedrun. Gib Platzierung und Spielname an.
        !user <Benutzername> - Zeigt alle Speedruns eines bestimmten Benutzers an.
        !liste <Spielname> - Zeigt die Bestenliste für ein bestimmtes Spiel an.
        !games - Zeigt alle verfügbaren Spiele an.
        !shutdown - Schaltet den Bot aus.
        !status - Zeigt die Zeit, die der Bot online war.`);
    }

    if (content.startsWith('!games')) {
        const displayGames = Object.keys(speedruns).join(',\n');
        message.channel.send(`Verfügbare Spiele:\n${displayGames}`);
    }

    if (content.startsWith('!shutdown')) {
        message.channel.send('Shutting down...').then(async () => {
            await sendOfflineMessage();
            process.exit(0);
        });
    }    

    if (content.startsWith('!status')) {
        const elapsedTime = getElapsedTime();
        message.channel.send(`Der Bot ist Online seit: ${elapsedTime}.`);
    }
});

async function sendOfflineMessage() {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
        await channel.send('Der Bot ist gerade offline, weil Kai Strom sparen will! Er war online für ' + getElapsedTime() + '.');
    }
}

client.once('ready', () => {
    console.log('Bot ist bereit!');
    client.channels.fetch(CHANNEL_ID)
        .then(channel => {
            if (channel) {
                channel.send('Der Bot ist Jetzt Online, weil Kai ausnahmsweise keinen Strom sparen will!');
            }
        })
        .catch(error => {
            console.error(`Error fetching channel: ${error}`);
        });
});

process.on('exit', () => {  
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
        sendOfflineMessage();
    }
});

client.login(token).catch(console.error); // Handle login errors
