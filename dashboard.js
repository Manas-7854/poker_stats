'use strict';
const {escapeHtml:e,money,tone,calculatePlayerStats,fetchData,deleteGame} = Tracker;
const error = document.querySelector('#error');
async function render() {
  try {
    const data = await fetchData(); error.textContent = '';
    const games = [...data.games].sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const players = data.players.map(p=>({...p,...calculatePlayerStats(p.id,games)})).sort((a,b)=>b.netProfit-a.netProfit || a.name.localeCompare(b.name));
    const pool = games.reduce((sum,g)=>sum+g.results.reduce((s,r)=>s+(r.invested || 0),0),0);
    document.querySelector('#summary').innerHTML = [['Games logged',games.length],['Players',players.length],['Total buy-ins tracked',money(pool)]].map(([label,value])=>`<div class="summary-card"><span class="muted">${label}</span><div class="value">${value}</div></div>`).join('');
    document.querySelector('#players').innerHTML = players.length ? players.map((p,i)=>`<article class="player-card"><div class="player-top"><span class="rank">#${i+1}</span><h3>${e(p.name)}</h3></div><div class="big-number ${tone(p.netProfit)}">${money(p.netProfit,true)}</div><span class="hint">Net profit / loss</span><dl class="stats">${[['Games played',p.gamesPlayed],['Win rate',p.winRate.toFixed(1)+'%'],['Wins',p.wins],['Losses',p.losses],['Break-even',p.breakEven],['Average / game',money(p.averageProfit,true)],['Total won',money(p.totalWon)],['Total lost',money(p.totalLost)],['Biggest win',money(p.biggestWin)],['Biggest win (% of buy-in)',p.biggestWinPercent == null ? '—' : p.biggestWinPercent.toLocaleString('en-IN',{maximumFractionDigits:2})+'%'],['Biggest loss',money(p.biggestLoss)]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></article>`).join('') : '<div class="empty"><h3>A fresh table</h3>Log your first game to start the leaderboard.</div>';
    document.querySelector('#history').innerHTML = games.length ? games.map(g=>{
      const legacy = g.buyIn == null;
      return `<details class="history-item"><summary><strong>${e(g.name || 'Game')}</strong><span class="game-meta">${e(g.date || 'Date unknown')} · ${g.results.length} players · ${legacy ? 'Legacy game · Buy-in and chips not recorded' : `${money(g.buyIn)} buy-in · ${money(g.results.reduce((s,r)=>s+r.invested,0))} pool`}</span></summary><div class="history-content"><div class="table-wrap"><table><thead><tr><th>Player</th><th>Buy-ins</th><th>Invested</th><th>Final chips</th><th>Final value</th><th>Profit / loss</th></tr></thead><tbody>${g.results.map(r=>`<tr><td>${e(data.players.find(p=>p.id===r.playerId)?.name || 'Unknown player')}</td><td>${e(r.buyIns ?? '—')}</td><td>${r.invested == null ? '—' : money(r.invested)}</td><td>${e(r.finalChips ?? '—')}</td><td>${r.finalValue == null ? '—' : money(r.finalValue)}</td><td class="${tone(r.profit ?? r.amount)}">${money(r.profit ?? r.amount,true)}</td></tr>`).join('')}</tbody></table></div><div class="history-actions"><button class="danger" data-delete="${e(g.id)}">Delete game</button></div></div></details>`;
    }).join('') : '<div class="empty"><h3>No games yet</h3>Your game history will appear here after your first save.</div>';
  } catch(err) { error.textContent = err.message; document.querySelector('#players').textContent = 'Standings unavailable. Reload after resolving the error.'; }
}
document.querySelector('#history').addEventListener('click',async event=>{
  const button = event.target.closest('[data-delete]'); if (!button) return;
  if (!button.dataset.confirm) { button.dataset.confirm = 'true'; button.textContent = 'Confirm deletion'; const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.onclick = ()=>{delete button.dataset.confirm;button.textContent='Delete game';cancel.remove();}; button.after(cancel); return; }
  button.disabled = true;
  try { await deleteGame(button.dataset.delete); await render(); } catch(err) { error.textContent = err.message;button.disabled=false; }
});
window.addEventListener('pageshow',render);
