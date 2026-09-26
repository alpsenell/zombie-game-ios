export const CSS = `
.pg-btn{padding:10px 14px;border-radius:11px;font-size:11px;letter-spacing:1.6px;position:relative}
.pg-btn.hot{border-color:#ffc34d88;color:var(--amber)}
#missions{background:#010406c4;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.pg-panel{width:min(94vw,640px);display:flex;flex-direction:column;max-height:calc(100vh - 2 * max(18px,var(--st)));text-align:left}
.pg-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.pg-head h2{margin:0!important;min-width:0;font-size:clamp(20px,6vw,32px)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-head .scrap{flex:none}
.pg-tabs{display:flex;gap:6px;margin-bottom:8px;flex:none}
.pg-tabs button{flex:1;padding:9px 4px;border-radius:9px;border:1px solid var(--line);background:#ffffff08;font:800 11px var(--ui);letter-spacing:1.3px;color:var(--dim);white-space:nowrap}
.pg-tabs button.on{background:#ffffff1c;color:#fff;border-color:#ffffff40}
.pg-sub{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 2px 8px;color:var(--dim);font:800 10px var(--ui);letter-spacing:1.3px;flex:none}
.pg-sub b{color:var(--amber);font-weight:900}
.pg-list{flex:1 1 auto;min-height:0;overflow-y:auto;touch-action:pan-y;display:grid;gap:6px;align-content:start;margin-bottom:12px}
.pg-m{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#0e191e;border:1px solid var(--line)}
.pg-m b{display:block;font:900 15px var(--display);letter-spacing:.6px}
.pg-m small{display:block;margin-top:4px;font:800 9px var(--ui);letter-spacing:1.1px;color:var(--dim)}
.pg-m small em{font-style:normal;color:var(--amber)}
.pg-m.done{border-color:#ffc34d99;background:linear-gradient(160deg,#2a2210,#0e191e 70%)}
.pg-m.claimed{opacity:.55}
.pg-m.claimed b:after{content:" ✔";color:var(--green)}
.pg-bar{height:5px;margin-top:6px;border-radius:3px;background:#ffffff18;overflow:hidden}
.pg-bar i{display:block;height:100%;width:var(--v);background:linear-gradient(90deg,#e5483a,#ffc34d);transition:width .4s}
.pg-m.done .pg-bar i,.pg-a.on .pg-bar i{background:linear-gradient(90deg,#ffc34d,#ffe39a)}
.pg-m button{padding:10px 14px;font-size:11px;letter-spacing:1.5px;animation:none}
.pg-m .ghost{padding:8px 10px;font-size:10px}
.pg-a{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:#ffffff06}
.pg-a:nth-child(odd){background:#ffffff0c}
.pg-a .ico{font-size:20px;text-align:center;filter:grayscale(1) opacity(.45)}
.pg-a.on .ico{filter:none}
.pg-a b{display:block;font:900 14px var(--display);letter-spacing:.6px;color:#cfd9d6}
.pg-a.on b{color:var(--amber)}
.pg-a small{display:block;font:800 9px var(--ui);letter-spacing:1px;color:var(--dim);margin-top:2px}
.pg-a .pg-bar{margin-top:5px}
.pg-a span{font:900 11px var(--ui);color:var(--dim);letter-spacing:1px}
.pg-a.on span{color:var(--green)}
.pg-foot{display:flex;gap:10px;justify-content:center;flex:none}
.pg-foot .cta{padding:12px 30px;font-size:14px;animation:none}
.pg-foot .ghost{padding:11px 16px;font-size:11px;white-space:nowrap}
.pg-feed{position:fixed;z-index:40;left:50%;top:max(12px,var(--st));transform:translateX(-50%);display:grid;gap:6px;justify-items:center;pointer-events:none;width:max-content;max-width:92vw}
#hud-extras .pg-feed{position:static;transform:none;justify-items:start;max-width:min(60vw,320px)}
.pg-note{padding:8px 13px;border-radius:10px;background:#0a1418ee;border:1px solid #ffc34d77;box-shadow:0 8px 24px #000a;font:900 11px var(--ui);letter-spacing:1.3px;color:#fff;text-shadow:none;animation:pgIn .35s cubic-bezier(.2,1.6,.4,1) both}
.pg-note em{display:block;font:900 9px var(--ui);letter-spacing:2px;color:var(--amber);font-style:normal;margin-bottom:2px}
.pg-note.ach{border-color:#6dffa088}.pg-note.ach em{color:var(--green)}
.pg-note.out{animation:pgOut .4s both}
@keyframes pgIn{from{opacity:0;transform:translateY(-10px) scale(.9)}}
@keyframes pgOut{to{opacity:0;transform:translateY(-6px)}}
.pg-pop{position:fixed;z-index:60;pointer-events:none;transform:translate(-50%,-50%);font:900 18px var(--display);letter-spacing:1px;color:var(--amber);text-shadow:0 2px 8px #000;animation:pgPop 1.1s ease-out both;white-space:nowrap}
@keyframes pgPop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}20%{opacity:1;transform:translate(-50%,-80%) scale(1.25)}100%{opacity:0;transform:translate(-50%,-260%) scale(1)}}
.pg-over{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:-6px 0 14px}
.pg-over:empty{display:none}
.pg-over span{padding:5px 10px;border-radius:20px;background:#ffffff0d;border:1px solid var(--line);font:900 10px var(--ui);letter-spacing:1.1px}
.pg-over .m{background:#ffc34d1a;border-color:#ffc34d66;color:var(--amber)}
.pg-over .a{background:#6dffa014;border-color:#6dffa066;color:var(--green)}
.pg-over .w i{display:inline-block;vertical-align:middle;width:44px;height:4px;margin-left:6px;border-radius:2px;background:#ffffff22;overflow:hidden}
.pg-over .w i:after{content:"";display:block;height:100%;width:var(--v);background:var(--amber)}
.pg-over button{padding:5px 12px;border-radius:20px;border:0;background:linear-gradient(180deg,#ffd36a,#e0a02a);color:#1a1206;font:900 10px var(--ui);letter-spacing:1.2px}
.pg-modal{position:fixed;inset:0;z-index:30;display:grid;align-items:center;align-items:end;justify-items:end;padding:max(16px,var(--st)) max(16px,var(--sr)) max(16px,var(--sb)) 16px;pointer-events:none}
.pg-card{pointer-events:auto;width:min(316px,40vw);padding:16px 16px 14px;border-radius:18px;background:#081115f5;border:1px solid #ffc34d55;box-shadow:0 20px 60px #000;text-align:center;animation:pgIn .35s cubic-bezier(.2,1.4,.4,1) both}
.pg-card h3{margin:0;font:900 28px/1 var(--display);letter-spacing:1.5px}
.pg-card h3 em{color:var(--amber);font-style:normal}
.pg-card>small{display:block;margin:5px 0 12px;font:800 10px var(--ui);letter-spacing:1.4px;color:var(--dim)}
.pg-card>small.warn{color:#ffb0a8}
.pg-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:10px}
.pg-cal div{padding:7px 2px 6px;border-radius:9px;background:#ffffff08;border:1px solid var(--line);font:800 8px var(--ui);letter-spacing:.8px;color:var(--dim);min-width:0}
.pg-cal div b{display:block;margin:3px 0 1px;font:900 14px var(--display);color:#cfd9d6}
.pg-cal div.past{background:#6dffa012;border-color:#6dffa044}
.pg-cal div.past b{color:var(--green)}
.pg-cal div.today{background:#ffc34d22;border-color:var(--amber);box-shadow:0 0 16px #ffc34d44;color:var(--amber)}
.pg-cal div.today b{color:#fff}
.pg-cal div.big b{color:var(--amber)}
.pg-extra div+div{margin-top:3px}
.pg-extra{margin:0 0 12px;font:800 10px var(--ui);letter-spacing:1.2px;color:var(--dim)}
.pg-extra b{color:var(--amber)}
.pg-card .row{justify-content:center}
.pg-card .cta{padding:13px 24px;font-size:14px}
.pg-card .ghost{padding:12px 16px;font-size:11px}
.pg-wm{display:flex;align-items:center;gap:5px;margin-top:5px;padding-right:18px;font:900 8px var(--ui);letter-spacing:.8px;color:var(--dim)}
.pg-wm i{flex:1;height:3px;border-radius:2px;background:#ffffff1a;overflow:hidden}
.pg-wm i:after{content:"";display:block;height:100%;width:var(--v);background:var(--amber)}
.wcard.pg-mastered{border-color:#ffd36a;box-shadow:inset 0 0 0 1px #ffd36a55,0 0 12px #ffc34d33}
.wcard.pg-mastered .pg-wm{color:#ffd36a}
.pg-ad{margin-top:8px}
.pg-ad .pg-stars{font-size:13px;letter-spacing:1px;color:#ffffff30}
.pg-ad .pg-stars span{color:var(--amber)}
.pg-ad .xp{margin:4px auto 0}
.stage-info .pg-ad small{color:var(--dim);font-size:9px;letter-spacing:1.3px;margin-top:4px}
.pg-badge{display:inline-block;margin-top:4px;padding:3px 8px;border-radius:6px;background:linear-gradient(180deg,#ffd36a,#e0a02a);color:#1a1206;font:900 9px var(--ui);letter-spacing:1.5px}
@media (orientation:portrait){.pg-modal{align-items:start;justify-items:center;padding-top:calc(max(16px,var(--st)) + 60px)}.pg-card{width:min(92vw,420px)}}
@media (max-height:430px){.pg-head{margin-bottom:8px}.pg-head h2{font-size:26px!important}.pg-head .scrap{padding:5px 10px;font-size:12px}.pg-tabs button{padding:7px 4px}.pg-list{gap:5px;margin-bottom:8px}.pg-m{padding:7px 11px}.pg-m b{font-size:14px}.pg-bar{margin-top:5px}.pg-m small{margin-top:3px}.pg-foot .cta{padding:10px 28px}.pg-foot .ghost{padding:9px 14px}.pg-cal{gap:4px}.pg-card{padding:12px 14px 12px}.pg-card h3{font-size:24px}.pg-card>small{margin:4px 0 8px}.pg-cal div{padding:5px 2px}.pg-extra{margin-bottom:8px}.pg-card .cta{padding:11px 22px}.pg-over{margin:-4px 0 10px}}
`;
