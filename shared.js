(function (root) {
  'use strict';
  const EPSILON = 0.005;
  const key = name => name.trim().toLocaleLowerCase('en-IN');
  const findPlayer = (players, name) => players.find(p => key(p.name) === key(name));
  const generateId = prefix => `${prefix}_${globalThis.crypto.randomUUID()}`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (value, signed = false) => `${signed && value > EPSILON ? '+' : ''}${new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', minimumFractionDigits:0, maximumFractionDigits:2}).format(Math.abs(value) < EPSILON ? 0 : value)}`;
  const tone = n => n > EPSILON ? 'positive' : n < -EPSILON ? 'negative' : 'neutral';
  function calculateGame(buyIn, rows) {
    if (!Number.isFinite(buyIn) || buyIn <= 0) throw Error('Enter a base buy-in greater than zero.');
    if (rows.length < 2) throw Error('Add at least two players.');
    for (const r of rows) {
      if (!Number.isFinite(r.buyIns) || r.buyIns < 0.5 || !Number.isInteger(r.buyIns * 2)) throw Error('Buy-ins must be at least 0.5, in steps of 0.5.');
      if (r.finalChips === '' || !Number.isFinite(r.finalChips) || r.finalChips < 0) throw Error('Enter a final chip count of zero or more for every player.');
    }
    const totalPool = rows.reduce((s,r) => s + buyIn * r.buyIns, 0);
    const totalChips = rows.reduce((s,r) => s + r.finalChips, 0);
    if (totalChips <= 0) throw Error('Total final chips must be greater than zero.');
    const chipValue = totalPool / totalChips;
    const results = rows.map(r => ({...r, invested:r.buyIns * buyIn, finalValue:r.finalChips * chipValue, profit:r.finalChips * chipValue - r.buyIns * buyIn}));
    if (![totalPool,totalChips,chipValue,...results.flatMap(r => [r.invested,r.finalValue,r.profit])].every(Number.isFinite) || Math.abs(results.reduce((s,r)=>s+r.profit,0)) > 0.01) throw Error('These totals cannot be balanced. Check the amounts and chip counts.');
    return {totalPool,totalChips,chipValue,results};
  }
  function calculatePlayerStats(id, games) {
    const s = {netProfit:0,gamesPlayed:0,wins:0,losses:0,breakEven:0,totalWon:0,totalLost:0,biggestWin:0,biggestLoss:0,biggestWinPercent:null};
    for (const game of games) {
      const entries = game.results.filter(r => r.playerId === id);
      if (!entries.length) continue;
      const n = entries.reduce((sum,r)=>sum + Number(r.profit ?? r.amount),0);
      // Older amount-only games have no investment, so their return is unknown.
      if (entries.every(r => Number.isFinite(r.invested) && r.invested > 0)) {
        const invested = entries.reduce((sum,r) => sum + r.invested,0);
        const winPercent = n > EPSILON ? n / invested * 100 : 0;
        s.biggestWinPercent = Math.max(s.biggestWinPercent ?? 0,winPercent);
      }
      s.gamesPlayed++; s.netProfit += n;
      if (n > EPSILON) { s.wins++; s.totalWon += n; s.biggestWin = Math.max(s.biggestWin,n); }
      else if (n < -EPSILON) { s.losses++; s.totalLost -= n; s.biggestLoss = Math.max(s.biggestLoss,-n); }
      else s.breakEven++;
    }
    return {...s,winRate:s.gamesPlayed ? s.wins/s.gamesPlayed*100 : 0,averageProfit:s.gamesPlayed ? s.netProfit/s.gamesPlayed : 0};
  }
  async function request(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Request failed. Please try again.');
    return data;
  }
  const api = {EPSILON,key,findPlayer,generateId,escapeHtml,money,tone,calculateGame,calculatePlayerStats,fetchData:()=>request('/api/data'),saveGame:game=>request('/api/games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(game)}),deleteGame:id=>request(`/api/games/${encodeURIComponent(id)}`,{method:'DELETE'})};
  if (typeof module !== 'undefined') module.exports = api; else root.Tracker = api;
})(globalThis);
