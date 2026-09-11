'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const T = require('../shared');
test('chip conversion, fractional buy-ins, precision and stats',()=>{
  const equal=T.calculateGame(500,[{buyIns:2,finalChips:400},{buyIns:1,finalChips:200}]);
  assert.equal(equal.chipValue,2.5);assert.deepEqual(equal.results.map(r=>r.profit),[0,0]);
  const game=T.calculateGame(500,[{playerId:'a',buyIns:2,finalChips:600},{playerId:'b',buyIns:1.5,finalChips:100}]);
  assert.equal(game.totalPool,1750);assert.equal(game.results[1].invested,750);assert.equal(game.results[0].profit,500);assert.equal(game.results[1].profit,-500);
  const stats=T.calculatePlayerStats('a',[game,{results:[{playerId:'a',amount:-100}]},{results:[{playerId:'a',profit:0}]}]);
  assert.equal(stats.netProfit,400);assert.equal(stats.gamesPlayed,3);assert.equal(stats.wins,1);assert.equal(stats.losses,1);assert.equal(stats.breakEven,1);assert.equal(stats.totalWon,500);assert.equal(stats.totalLost,100);assert.equal(stats.biggestWin,500);assert.equal(stats.biggestLoss,100);assert.equal(stats.averageProfit,400/3);
  const fractional=T.calculateGame(100,[{buyIns:1,finalChips:1},{buyIns:1,finalChips:2},{buyIns:1,finalChips:4}]);
  assert.ok(Math.abs(fractional.results.reduce((s,r)=>s+r.profit,0))<0.01);
  for(const rows of [[{buyIns:1,finalChips:1}],[{buyIns:1,finalChips:''},{buyIns:1,finalChips:1}],[{buyIns:0.3,finalChips:1},{buyIns:1,finalChips:1}],[{buyIns:1,finalChips:0},{buyIns:1,finalChips:0}]]) assert.throws(()=>T.calculateGame(500,rows));
});
test('HTTP pages, saves, player reuse, deletion, legacy and protected files',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'player-tracker-'));process.env.DATA_FILE=path.join(dir,'data.json');
  const original={players:[{id:'p1',name:'Manas'},{id:'p2',name:'Nidhish'}],games:[]};
  fs.writeFileSync(process.env.DATA_FILE,JSON.stringify(original));
  const {server,readData}=require('../server');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const get=async()=> (await fetch(base+'/api/data')).json();
  const save=async input=>fetch(base+'/api/games',{method:'POST',body:JSON.stringify(input)});
  try {
    for(const page of ['/','/game.html','/styles.css','/shared.js','/dashboard.js','/game.js']) { const res=await fetch(base+page);assert.equal(res.status,200);assert.ok((await res.text()).length>100); }
    const css = await fetch(base+'/styles.css?v=1');
    assert.equal(css.status,200);
    assert.match(css.headers.get('content-type'),/^text\/css/);
    assert.equal(await css.text(),fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8'));
    const script = await fetch(base+'/game.js');
    assert.match(script.headers.get('content-type'),/^text\/javascript/);
    assert.equal((await fetch(base+'/data.json')).status,404);
    const input={name:'Friday Poker',date:'2026-09-08',buyIn:500,results:[{name:'manas',buyIns:2,finalChips:600},{name:'New Player',buyIns:1.5,finalChips:100}]};
    let response=await save(input);assert.equal(response.status,201);const {game}=await response.json();
    let data=await get();assert.equal(data.players.length,3);assert.equal(game.results[0].playerId,'p1');assert.equal(T.calculatePlayerStats('p1',data.games).netProfit,500);assert.equal(data.games[0].chipValue,2.5);
    assert.deepEqual(JSON.parse(fs.readFileSync(process.env.DATA_FILE,'utf8')),data);assert.deepEqual(JSON.parse(fs.readFileSync(process.env.DATA_FILE+'.bak','utf8')),original);
    input.results[1].name='NEW PLAYER';assert.equal((await save(input)).status,201);assert.equal((await get()).players.length,3);
    for(const invalid of [{...input,buyIn:0},{...input,date:'2026-02-30'},{...input,results:[input.results[0]]},{...input,results:[input.results[0],{...input.results[1],name:'MANAS'}]},{...input,results:[input.results[0],{...input.results[1],finalChips:''}]}]) assert.equal((await save(invalid)).status,400);
    assert.equal((await get()).games.length,2);
    assert.equal((await fetch(base+'/api/games/'+game.id,{method:'DELETE'})).status,200);data=await get();assert.equal(T.calculatePlayerStats('p1',data.games).netProfit,500);
    assert.equal((await fetch(base+'/api/games/'+data.games[0].id,{method:'DELETE'})).status,200);data=await get();assert.equal(T.calculatePlayerStats('p1',data.games).netProfit,0);assert.equal(readData().games.length,0);
    fs.writeFileSync(process.env.DATA_FILE,JSON.stringify({players:[...original.players,{id:'p3',name:'MANAS'}],games:[{id:'old',results:[{playerId:'p3',amount:100},{playerId:'p2',amount:-100}]}]}));
    data=await get();assert.equal(data.players.length,2);assert.equal(data.games[0].results[0].playerId,'p1');assert.equal(T.calculatePlayerStats('p1',data.games).netProfit,100);
    fs.writeFileSync(process.env.DATA_FILE,'broken JSON');assert.equal((await fetch(base+'/api/data')).status,500);assert.equal((await save(input)).status,500);assert.equal(fs.readFileSync(process.env.DATA_FILE,'utf8'),'broken JSON');
    fs.unlinkSync(process.env.DATA_FILE);assert.deepEqual(await get(),{players:[],games:[]});assert.equal((await save(input)).status,201);assert.equal(readData().players.length,2);
  } finally { await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true}); }
});
