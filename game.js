'use strict';
const {escapeHtml:e,money,tone,findPlayer,calculateGame,fetchData,saveGame} = Tracker;
const $ = id => document.getElementById(id);
let players = [], rows = [], loaded = false, saving = false;
const now = new Date(); $('date').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
function inputData() { return {name:$('title').value.trim(),date:$('date').value,buyIn:Number($('buy-in').value),results:rows.map(r=>({name:r.name,buyIns:r.buyIns,finalChips:r.finalChips}))}; }
function update() {
  const input = inputData(); let calculated, message = '';
  try { calculated = calculateGame(input.buyIn,input.results); } catch(err) { message = err.message; }
  if (!input.date || !$('date').validity.valid) message = 'Choose a valid game date.';
  const pool = rows.reduce((s,r)=>s+(Number.isFinite(r.buyIns)?r.buyIns*input.buyIn:0),0);
  const chips = rows.reduce((s,r)=>s+(Number.isFinite(r.finalChips)?r.finalChips:0),0);
  $('pool').textContent = Number.isFinite(pool) ? money(pool) : '—'; $('chips').textContent = Number.isFinite(chips) ? chips.toLocaleString('en-IN') : '—';
  $('chip-value').textContent = calculated ? '₹'+calculated.chipValue.toLocaleString('en-IN',{maximumSignificantDigits:6}) : '—';
  rows.forEach((r,i)=>{
    const cells = $('entries').children[i].querySelectorAll('[data-value]');
    cells[0].textContent = Number.isFinite(r.buyIns*input.buyIn) ? money(r.buyIns*input.buyIn) : '—';
    cells[1].textContent = calculated ? money(calculated.results[i].finalValue) : '—';
    cells[2].textContent = calculated ? money(calculated.results[i].profit,true) : '—';
    cells[2].className = calculated ? tone(calculated.results[i].profit) : 'muted';
  });
  $('validation').textContent = message || 'Results balance · Total profit / loss: ₹0';
  $('save').disabled = !loaded || saving || Boolean(message);
}
function renderRows() {
  $('empty').hidden = rows.length>0; $('entry-table').hidden = !rows.length;
  $('entries').innerHTML = rows.map((r,i)=>`<tr class="entry"><td><strong>${e(r.name)}</strong></td><td><input aria-label="Buy-ins for ${e(r.name)}" data-index="${i}" data-field="buyIns" type="number" min="0.5" step="0.5" value="${r.buyIns}" required></td><td><input aria-label="Final chips for ${e(r.name)}" data-index="${i}" data-field="finalChips" type="number" min="0" step="any" placeholder="0" value="${r.finalChips}" required></td><td data-value></td><td data-value></td><td data-value></td><td><button type="button" class="remove danger" data-remove="${i}" aria-label="Remove ${e(r.name)}">Remove</button></td></tr>`).join(''); update();
}
function addPlayer() {
  const name = $('player-name').value.trim(); $('player-error').textContent = '';
  if (!name) { $('player-error').textContent='Enter a player name.'; return; }
  if (findPlayer(rows,name)) { $('player-error').textContent='This player is already at the table.'; return; }
  if (rows.length>=100) { $('player-error').textContent='A game can have up to 100 players.'; return; }
  rows.push({name:findPlayer(players,name)?.name || name,buyIns:1,finalChips:''}); $('player-name').value=''; renderRows(); $('player-name').focus();
}
$('add-player').addEventListener('click',addPlayer);
$('player-name').addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();addPlayer();}});
$('entries').addEventListener('input',ev=>{const {index,field}=ev.target.dataset;if(field) rows[index][field]=ev.target.value==='' ? '' : Number(ev.target.value);update();});
$('entries').addEventListener('click',ev=>{const button=ev.target.closest('[data-remove]');if(button){rows.splice(Number(button.dataset.remove),1);renderRows();}});
for (const id of ['title','date','buy-in']) $(id).addEventListener('input',update);
$('game-form').addEventListener('submit',async ev=>{
  ev.preventDefault();update();if($('save').disabled)return;
  saving=true;$('save-error').textContent='';$('save').textContent='Saving…';update();
  try { await saveGame(inputData());location.href='/'; } catch(err) { $('save-error').textContent=err.message;saving=false;$('save').textContent='Save game';update(); }
});
fetchData().then(data=>{players=data.players;loaded=true;$('known-players').innerHTML=players.map(p=>`<option value="${e(p.name)}"></option>`).join('');update();}).catch(err=>{$('load-error').textContent=err.message;});
update();
