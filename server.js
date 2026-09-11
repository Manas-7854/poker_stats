'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./shared');
const dataPath = process.env.DATA_FILE || path.join(__dirname, 'data.json');

function readData() {
  let data;
  try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return {players: [], games: []};
    throw Error('Cannot read data.json. Repair the file before saving; existing data has been left untouched.');
  }
  if (!data || !Array.isArray(data.players) || !Array.isArray(data.games)) throw Error('Invalid data.json structure. Existing data has been left untouched.');
  const ids = new Set();
  for (const player of data.players) {
    if (!player || typeof player.id !== 'string' || typeof player.name !== 'string' || !player.name.trim() || ids.has(player.id)) throw Error('Invalid player records in data.json. Repair the file before saving.');
    ids.add(player.id);
  }
  const gameIds = new Set();
  for (const game of data.games) {
    if (!game || typeof game.id !== 'string' || gameIds.has(game.id) || !Array.isArray(game.results) || game.results.some(r => !r || !ids.has(r.playerId) || typeof (r.profit ?? r.amount) !== 'number' || !Number.isFinite(r.profit ?? r.amount))) throw Error('Invalid game records in data.json. Repair the file before saving.');
    gameIds.add(game.id);
  }
  const players = [], aliases = new Map();
  for (const player of data.players) {
    const existing = T.findPlayer(players, player.name);
    aliases.set(player.id, existing?.id || player.id);
    if (!existing) players.push({...player, name: player.name.trim()});
  }
  return {...data, players, games: data.games.map(g => ({...g, results: g.results.map(r => ({...r, playerId: aliases.get(r.playerId)}))}))};
}
function writeData(data) {
  if (fs.existsSync(dataPath) && !fs.existsSync(`${dataPath}.bak`)) fs.copyFileSync(dataPath, `${dataPath}.bak`, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(`${dataPath}.tmp`, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(`${dataPath}.tmp`, dataPath);
}
function send(res, status, data) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(data));
}
// Explicit routes keep data files and server source private.
const staticFiles = new Map(Object.entries({
  '/': 'index.html', '/index.html': 'index.html', '/game.html': 'game.html',
  '/styles.css': 'styles.css', '/shared.js': 'shared.js',
  '/dashboard.js': 'dashboard.js', '/game.js': 'game.js'
}));
const mimeTypes = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript'};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/data') return send(res, 200, readData());
    if (req.method === 'POST' && url.pathname === '/api/games') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 100000) return send(res, 413, {error: 'Game is too large.'});
      }
      let input;
      try { input = JSON.parse(body); } catch { return send(res, 400, {error: 'Invalid JSON.'}); }
      const data = readData();
      let game;
      try {
        if (!input || (input.name != null && (typeof input.name !== 'string' || input.name.length > 120))) throw Error('Enter a game title of up to 120 characters.');
        if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw Error('Enter a valid date.');
        if (!Array.isArray(input.results) || input.results.length > 100) throw Error('Enter between 2 and 100 players.');
        const names = new Set();
        const rows = input.results.map(r => {
          if (!r || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 80) throw Error('Player names must contain 1–80 characters.');
          const name = r.name.trim();
          if (names.has(T.key(name))) throw Error('A player cannot appear twice in one game.');
          names.add(T.key(name));
          let player = T.findPlayer(data.players, name);
          if (!player) { player = {id: T.generateId('player'), name}; data.players.push(player); }
          return {playerId: player.id, buyIns: r.buyIns, finalChips: r.finalChips};
        });
        const calculated = T.calculateGame(input.buyIn, rows);
        game = {id: T.generateId('game'), name: input.name?.trim() || 'Game', date: input.date, createdAt: new Date().toISOString(), buyIn: input.buyIn, chipValue: calculated.chipValue, results: calculated.results};
      } catch (error) { return send(res, 400, {error: error.message}); }
      data.games.unshift(game);
      writeData(data);
      return send(res, 201, {game});
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/games/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/games/'.length));
      const data = readData();
      if (!data.games.some(g => g.id === id)) return send(res, 404, {error: 'Game no longer exists. Refresh the dashboard.'});
      data.games = data.games.filter(g => g.id !== id);
      writeData(data);
      return send(res, 200, {success: true});
    }
    const file = staticFiles.get(url.pathname);
    if ((req.method === 'GET' || req.method === 'HEAD') && file) {
      const content = fs.readFileSync(path.join(__dirname, file));
      res.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(file)] + '; charset=utf-8',
        'Content-Length': content.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(req.method === 'HEAD' ? undefined : content);
    }
    send(res, 404, {error: 'Not found'});
  } catch (error) { console.error(error.message); send(res, 500, {error: error.message}); }
});
if (require.main === module) server.listen(process.env.PORT || 3000, () => console.log(`App running at http://localhost:${process.env.PORT || 3000}`));
module.exports = {server, readData};
