/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA PROMPTER — PLAYER (teleprompter com voice-following pt-BR)

   Port do protótipo standalone do Walter (validado no iPhone e Android).
   A engine é 100% imperativa DE PROPÓSITO: reconhecimento de voz, canvas de
   espelho, MediaRecorder e scroll re-sync são código sensível a timing que já
   foi depurado no aparelho real. Reescrever isso em estado React seria trocar
   código testado por código novo com os mesmos bugs de novo.

   Contrato com o React: o componente monta UMA vez, nunca re-renderiza
   (memo com comparador sempre-true) e toda a vida acontece no useEffect.
   O DOM interno é do player; o React só entrega o esqueleto e desmonta o nó
   raiz inteiro na saída.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  title: string;
  text: string;
  onExit: () => void;
};

const SETTINGS_KEY = "cria_prompter_settings_v1";

/* Cache de SESSÃO do microfone (escopo de módulo: sobrevive a entrar/sair do
   player). No iOS a permissão vale pela sessão da página — se a gente solta a
   trilha ao sair, voltar pro player dispara o prompt de novo. Mantendo o mic
   vivo, pede UMA vez por sessão. Entre aberturas do app quem decide é o iOS. */
let sessionMic: MediaStream | null = null;

const CSS = `
.cpr{position:fixed;inset:0;z-index:60;background:#000;color:#F5F3E7;
  font-family:'Roboto',var(--active-font-body,var(--font-body,-apple-system)),'Segoe UI',sans-serif;
  --cream:#F5F3E7;--paper:#FDFBF5;--ink:#0A0A0A;--yellow:#FFCF03;--pink:#FF77B9;--blue:#0061EE;
  --panel:hsl(45 8% 10%);--panel2:hsl(45 6% 15%);--border:hsl(45 6% 22%);--txt:#F5F3E7;--dim:hsl(40 8% 66%);
  --accent:#EA4918;--accentFg:#FDFBF5;--danger:#ff4d5e;--ok:#01A652;--radius:16px;
  --glass:rgba(10,10,10,.55);--glassBrd:rgba(245,243,231,.2);
  --fontDisplay:'Baloo 2',var(--active-font-display,var(--font-display,inherit)),sans-serif;}
.cpr *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
.cpr button{font-family:inherit;}
.cpr #camVideo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;transform:scaleX(-1);}
.cpr #prompterViewport{position:absolute;inset:0;overflow-y:scroll;scrollbar-width:none;z-index:2;}
.cpr #prompterViewport::-webkit-scrollbar{display:none;}
.cpr #prompterText{padding:45vh 6vw 60vh;font-size:42px;line-height:1.5;font-weight:600;text-align:center;word-wrap:break-word;}
.cpr #prompterText .w{color:rgba(255,255,255,.92);}
.cpr #prompterText .w.done{color:rgba(255,255,255,.28);}
.cpr #prompterText .w.cur{color:var(--accent);}
.cpr.mirrorX #prompterViewport{transform:scaleX(-1);}
.cpr.mirrorY #prompterViewport{transform:scaleY(-1);}
.cpr.camOn #prompterText .w{text-shadow:0 1px 6px rgba(0,0,0,.9);}
.cpr #camDim{position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;z-index:1;}
.cpr.camOn #camDim{display:block;}
.cpr #guide{position:absolute;left:0;top:var(--readpos,35%);width:0;height:0;border-top:10px solid transparent;border-bottom:10px solid transparent;border-left:14px solid var(--accent);opacity:.85;z-index:3;pointer-events:none;}
.cpr #prompterText .w.em{color:var(--accent);font-weight:800;}
.cpr #prompterText .w.em.done{color:rgba(234,73,24,.35);}
.cpr .pausebreak{color:var(--accent);opacity:.75;font-size:.55em;letter-spacing:14px;margin:.5em 0;}
.cpr.reels #prompterText{max-width:calc(100vh * 9 / 16);margin:0 auto;}
.cpr #fgL,.cpr #fgR{position:absolute;top:0;bottom:0;background:rgba(0,0,0,.55);z-index:4;pointer-events:none;display:none;}
.cpr #fgL{left:0;border-right:1.5px dashed rgba(234,73,24,.65);}
.cpr #fgR{right:0;border-left:1.5px dashed rgba(234,73,24,.65);}
.cpr.reels.camOn #fgL,.cpr.reels.camOn #fgR{display:block;}
.cpr.cardMode #prompterViewport{background:rgba(205,205,210,.38);border-radius:18px;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);}
.cpr.cardMode #prompterText .w{color:rgba(0,0,0,.92);text-shadow:none!important;}
.cpr.cardMode #prompterText .w.done{color:rgba(0,0,0,.25);}
.cpr.cardMode #prompterText .w.cur{color:#B33D0F;font-weight:800;}
.cpr.cardMode #prompterText .w.em{color:#A0370D;font-weight:800;}
.cpr.cardMode.cardWhite #prompterViewport{background:rgba(35,35,42,.5);}
.cpr.cardMode.cardWhite #prompterText .w{color:rgba(255,255,255,.95);}
.cpr.cardMode.cardWhite #prompterText .w.done{color:rgba(255,255,255,.3);}
.cpr.cardMode.cardWhite #prompterText .w.cur{color:var(--accent);}
.cpr.cardMode.cardWhite #prompterText .w.em{color:var(--accent);}
.cpr.cardMode #camDim{display:none!important;}
.cpr.cardMode #prompterText{max-width:none;}
.cpr #topBar,.cpr #bottomBar{position:absolute;left:0;right:0;z-index:10;display:flex;align-items:center;transition:opacity .3s;}
.cpr #topBar{top:calc(6px + env(safe-area-inset-top));left:8px;right:8px;gap:6px;padding:7px 9px;background:rgba(10,10,10,.6);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--glassBrd);border-radius:26px;justify-content:space-between;}
.cpr #quickBar .pbtn{background:transparent;border:none;}
.cpr #topBar>div:last-child .pbtn{background:transparent;border:none;}
.cpr #quickBar .pbtn.on{background:var(--accent);}
/* barra inferior: UMA linha sempre — 5 botões flexíveis + obturador fixo no meio */
.cpr #bottomBar{bottom:0;gap:5px;padding:12px 8px 10px;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:linear-gradient(transparent,rgba(10,10,10,.82));justify-content:space-evenly;flex-wrap:nowrap;}
.cpr.barsHidden #topBar,.cpr.barsHidden #bottomBar{opacity:0;pointer-events:none;}
.cpr .pbtn{background:var(--glass);border:1px solid var(--glassBrd);color:var(--cream);border-radius:999px;padding:9px 13px;font-size:14px;cursor:pointer;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:inline-flex;align-items:center;justify-content:center;gap:6px;}
.cpr .pbtn small{font-family:var(--fontDisplay);}
.cpr .pbtn.on{background:var(--accent);color:var(--accentFg);border-color:var(--accent);font-weight:700;box-shadow:0 3px 14px rgba(234,73,24,.45);}
.cpr #prExit{background:rgba(10,10,10,.35);border:1.5px solid rgba(245,243,231,.45);font-family:var(--fontDisplay);font-weight:600;}
@keyframes cprPulse{50%{opacity:.6;}}
.cpr #modeMenu{position:absolute;bottom:calc(106px + env(safe-area-inset-bottom));left:14px;background:rgba(10,10,10,.85);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--glassBrd);border-radius:18px;overflow:hidden;z-index:16;display:none;min-width:176px;}
.cpr #modeMenu.show{display:block;}
.cpr #modeMenu button{display:flex;gap:10px;align-items:center;background:none;border:none;color:var(--cream);padding:13px 16px;font-size:15px;font-family:var(--fontDisplay);width:100%;cursor:pointer;text-align:left;}
.cpr #modeMenu button.on{color:var(--accent);font-weight:700;}
.cpr.light #modeMenu{background:#FDFBF5;border-color:rgba(10,10,10,.12);}
.cpr.light #modeMenu button{color:#0A0A0A;}
.cpr.light #modeMenu button.on{color:var(--accent);}
.cpr #voiceDot{width:10px;height:10px;border-radius:50%;background:var(--dim);display:inline-block;margin-right:5px;}
.cpr #voiceDot.live{background:var(--ok);animation:cprPulse 1s infinite;}
.cpr #recTimer{color:#FDFBF5;font-variant-numeric:tabular-nums;font-size:13px;font-weight:700;font-family:var(--fontDisplay);background:var(--accent);border:none;border-radius:999px;padding:7px 12px;display:none;animation:cprPulse 1.3s infinite;box-shadow:0 0 0 4px rgba(234,73,24,.25);}
.cpr #countdown{position:absolute;inset:0;z-index:20;display:none;align-items:center;justify-content:center;font-size:120px;font-weight:700;font-family:var(--fontDisplay);color:var(--accent);background:rgba(0,0,0,.6);}
/* Ajustes = bottom sheet CLARO com identidade CRIA (creme + cards brancos) */
.cpr #settingsPanel{position:absolute;left:0;right:0;bottom:0;top:auto;width:auto;max-width:520px;margin:0 auto;max-height:82vh;background:var(--cream);color:var(--ink);border:none;border-radius:28px 28px 0 0;z-index:30;transform:translateY(105%);transition:transform .32s cubic-bezier(.32,.72,.25,1);overflow-y:auto;padding:8px 14px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -14px 44px rgba(10,10,10,.45);}
.cpr #settingsPanel.open{transform:none;}
.cpr .shandle{width:44px;height:5px;border-radius:99px;background:rgba(10,10,10,.18);margin:4px auto 12px;}
.cpr #settingsPanel h2{font-size:21px;font-weight:700;margin:0 4px;color:var(--ink);font-family:var(--fontDisplay);letter-spacing:-.01em;}
.cpr .sgSub{margin:2px 4px 0;font-size:12.5px;color:rgba(10,10,10,.55);}
.cpr .sgCard{background:var(--paper);border:1px solid rgba(10,10,10,.08);border-radius:20px;padding:2px 16px 6px;margin-top:14px;box-shadow:0 2px 0 rgba(10,10,10,.06);}
.cpr .sgHead{display:flex;align-items:center;gap:10px;padding:12px 0 10px;border-bottom:1px solid rgba(10,10,10,.07);}
.cpr .sgChip{display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:var(--accent);color:#FDFBF5;flex-shrink:0;}
.cpr .sgChip .lucide{width:18px;height:18px;}
.cpr .sgChip.cYellow{background:var(--yellow);color:var(--ink);}
.cpr .sgChip.cBlue{background:var(--blue);}
.cpr .sgChip.cGreen{background:var(--ok);}
.cpr .sgChip.cPink{background:var(--pink);color:var(--ink);}
.cpr .sgTitle{font-size:16px;font-weight:700;color:var(--ink);margin:0;font-family:var(--fontDisplay);}
.cpr .set{padding:12px 0;border-bottom:1px solid rgba(10,10,10,.07);}
.cpr .sgCard>.set:last-child,.cpr .sgCard>.switchrow:last-child{border-bottom:none;}
.cpr .set label{display:flex;justify-content:space-between;align-items:center;font-size:14px;color:rgba(10,10,10,.6);margin-bottom:6px;}
.cpr .set label b{color:var(--ink);font-weight:700;font-size:15px;font-family:var(--fontDisplay);}
.cpr .set input[type=range]{width:100%;accent-color:var(--accent);margin:0;height:34px;background:transparent;-webkit-appearance:none;appearance:none;}
.cpr .set input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:rgba(10,10,10,.14);}
.cpr .set input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:var(--accent);border:3px solid var(--paper);box-shadow:0 2px 6px rgba(10,10,10,.28);margin-top:-10px;}
.cpr .set input[type=range]::-moz-range-track{height:6px;border-radius:999px;background:rgba(10,10,10,.14);}
.cpr .set input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--accent);border:3px solid var(--paper);}
.cpr .set select{width:100%;background:#fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%230A0A0A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;border:1.5px solid rgba(10,10,10,.14);color:var(--ink);border-radius:14px;padding:11px 38px 11px 12px;font-size:15px;-webkit-appearance:none;appearance:none;}
.cpr .switchrow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 0;border-bottom:1px solid rgba(10,10,10,.07);font-size:15px;color:var(--ink);}
.cpr .sw{position:relative;width:50px;height:30px;flex-shrink:0;}
.cpr .sw input{opacity:0;width:0;height:0;}
.cpr .sw i{position:absolute;inset:0;background:rgba(10,10,10,.14);border:none;border-radius:20px;transition:.2s;cursor:pointer;}
.cpr .sw i:before{content:"";position:absolute;width:24px;height:24px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 4px rgba(10,10,10,.25);}
.cpr .sw input:checked+i{background:var(--accent);}
.cpr .sw input:checked+i:before{transform:translateX(20px);}
.cpr #overlay{position:absolute;inset:0;background:rgba(10,10,10,.45);z-index:25;display:none;}
.cpr #overlay.show{display:block;}
.cpr #cprToast{position:absolute;bottom:calc(110px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:rgba(10,10,10,.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid var(--glassBrd);color:var(--cream);border-radius:16px;padding:12px 18px;font-size:14px;z-index:50;display:none;max-width:86vw;text-align:center;}
.cpr .cSheet{position:absolute;inset:0;z-index:45;display:none;align-items:flex-end;justify-content:center;background:rgba(10,10,10,.6);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);}
.cpr .cSheet.show{display:flex;}
.cpr .cSheetCard{background:#161511;border:1px solid rgba(245,243,231,.12);border-bottom:none;border-radius:28px 28px 0 0;width:min(520px,100vw);padding:22px 20px calc(22px + env(safe-area-inset-bottom));animation:cprUp .28s ease;}
@keyframes cprUp{from{transform:translateY(40px);opacity:0;}to{transform:none;opacity:1;}}
.cpr .cSheetCard h3{margin:0 0 3px;font-size:20px;font-weight:700;letter-spacing:-.01em;color:var(--cream);font-family:var(--fontDisplay);}
.cpr .cSheetCard p{margin:0 0 14px;color:var(--dim);font-size:13.5px;line-height:1.55;}
.cpr .cSheetCard p b{color:var(--cream);}
.cpr #ssMeta{margin:0 0 14px;color:var(--dim);font-size:13px;font-family:var(--fontDisplay);}
.cpr .permIcon{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:rgba(234,73,24,.16);color:var(--accent);margin-bottom:12px;}
.cpr .permIcon .lucide{width:26px;height:26px;}
.cpr #ssVideo{width:100%;max-height:36vh;border-radius:16px;background:#000;display:block;margin-bottom:14px;object-fit:contain;}
.cpr .ssBtn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:16px;padding:14px;font-size:15px;font-weight:700;font-family:var(--fontDisplay);cursor:pointer;border:1px solid rgba(245,243,231,.16);background:rgba(245,243,231,.08);color:var(--cream);margin-bottom:8px;}
.cpr .ssBtn.primary{background:var(--accent);border-color:var(--accent);color:var(--accentFg);box-shadow:0 4px 16px rgba(234,73,24,.4);}
.cpr .ssBtn.ghost{background:none;border:none;color:var(--dim);font-weight:600;margin-bottom:0;padding:10px;box-shadow:none;}
.cpr .ssHint{color:var(--dim);font-size:12px;margin:0 0 12px;text-align:center;}
.cpr #micBtn.off{color:var(--danger);border-color:rgba(255,77,94,.55);}
.cpr #micBtn.hot{border-color:var(--ok);box-shadow:0 0 0 1.5px rgba(1,166,82,.6);}
.cpr .iconbtn{background:var(--accent);border:none;color:var(--accentFg);border-radius:16px;padding:15px 12px;font-size:16px;font-weight:700;font-family:var(--fontDisplay);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 3px 0 rgba(10,10,10,.15);}
.cpr .lucide{width:20px;height:20px;stroke-width:2;flex-shrink:0;}
.cpr #shutter{width:74px;height:74px;border-radius:50%;border:4px solid var(--cream);background:rgba(10,10,10,.25);position:relative;cursor:pointer;padding:0;flex-shrink:0;box-shadow:0 0 0 5px rgba(234,73,24,.25),0 6px 22px rgba(0,0,0,.4);}
.cpr #shutter em{position:absolute;inset:6px;border-radius:50%;background:var(--accent);transition:all .18s;}
.cpr #shutter.rec em{background:var(--accent);inset:20px;border-radius:12px;animation:cprPulse 1.2s infinite;}
.cpr #shutter.camoff em{background:var(--cream);opacity:.5;}
.cpr #recBtnPulse{animation:cprPulse 1.2s infinite;}
.cpr #quickBar{display:flex;gap:4px;flex:1;justify-content:center;min-width:0;}
.cpr #quickBar .pbtn{padding:6px 5px;flex-direction:column;gap:2px;border-radius:14px;min-width:0;flex:0 1 52px;}
.cpr #quickBar .pbtn small{font-size:8.5px;font-weight:600;opacity:.95;}
.cpr #quickBar .pbtn .lucide{width:17px;height:17px;}
.cpr #bottomBar .pbtn{flex-direction:column;gap:3px;padding:9px 2px;min-width:0;flex:1 1 0;max-width:66px;border-radius:18px;background:rgba(245,243,231,.1);border:1px solid rgba(245,243,231,.16);}
.cpr #bottomBar .pbtn small{font-size:9px;font-weight:600;opacity:.95;white-space:nowrap;}
.cpr #bottomBar .pbtn .lucide{width:18px;height:18px;}
.cpr #shutterWrap{display:flex;flex-direction:column;align-items:center;gap:4px;flex:0 0 auto;}
.cpr #shutterWrap small{font-size:10px;font-weight:700;font-family:var(--fontDisplay);color:var(--cream);text-shadow:0 1px 4px rgba(0,0,0,.7);white-space:nowrap;}
.cpr.light{--panel:#FDFBF5;--panel2:#F5F3E7;--border:rgba(10,10,10,.14);--txt:#0A0A0A;--dim:rgba(10,10,10,.55);background:#F5F3E7;color:#0A0A0A;}
.cpr.light:not(.camOn) #prompterText .w{color:rgba(10,10,10,.9);}
.cpr.light:not(.camOn) #prompterText .w.done{color:rgba(10,10,10,.24);}
.cpr.light:not(.camOn) #prompterText .w.cur,.cpr.light:not(.camOn) #prompterText .w.em{color:var(--accent);}
.cpr.light #topBar{background:rgba(253,251,245,.92);border-color:rgba(10,10,10,.12);}
.cpr.light #quickBar .pbtn,.cpr.light #topBar>div:last-child .pbtn{color:#0A0A0A;background:transparent;border:none;}
.cpr.light #prExit{color:#0A0A0A;border-color:rgba(10,10,10,.35);background:transparent;}
.cpr.light #bottomBar{background:linear-gradient(transparent,rgba(245,243,231,.96));}
.cpr.light:not(.camOn) .pbtn{background:rgba(253,251,245,.92);color:#0A0A0A;border-color:rgba(10,10,10,.16);}
.cpr.light:not(.camOn) .pbtn.on{background:var(--accent);color:var(--accentFg);border-color:var(--accent);}
.cpr.light:not(.camOn) #prExit{border-color:rgba(10,10,10,.35);}
.cpr.light #countdown{background:rgba(245,243,231,.7);}
.cpr.light:not(.camOn) #shutter{border-color:#0A0A0A;background:rgba(10,10,10,.05);box-shadow:none;}
.cpr.light:not(.camOn) #shutterWrap small{color:#0A0A0A;text-shadow:none;}
.cpr.light:not(.camOn) #cprToast{background:rgba(253,251,245,.95);color:#0A0A0A;border-color:rgba(10,10,10,.14);}
`;

/* Ícones Lucide embutidos (mesmos paths do protótipo — sem CDN, sem flicker) */
const ICONS: Record<string, string> = {
  "chevron-left": '<path d="m15 18-6-6 6-6" />',
  "switch-camera": '<path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /> <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" /> <circle cx="12" cy="12" r="3" /> <path d="m18 22-3-3 3-3" /> <path d="m6 2 3 3-3 3" />',
  "gallery-thumbnails": '<rect width="18" height="14" x="3" y="3" rx="2" /> <path d="M4 21h1" /> <path d="M9 21h1" /> <path d="M14 21h1" /> <path d="M19 21h1" />',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2" /> <path d="M12 18h.01" />',
  "flip-horizontal-2": '<path d="m3 7 5 5-5 5V7" /> <path d="m21 7-5 5 5 5V7" /> <path d="M12 20v2" /> <path d="M12 14v2" /> <path d="M12 8v2" /> <path d="M12 2v2" />',
  "sun-moon": '<path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4" /> <path d="M12 2v2" /> <path d="M12 20v2" /> <path d="m4.9 4.9 1.4 1.4" /> <path d="m17.7 17.7 1.4 1.4" /> <path d="M2 12h2" /> <path d="M20 12h2" /> <path d="m6.3 17.7-1.4 1.4" /> <path d="m19.1 4.9-1.4 1.4" />',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /> <circle cx="12" cy="12" r="3" />',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /> <path d="M19 10v2a7 7 0 0 1-14 0v-2" /> <line x1="12" x2="12" y1="19" y2="22" />',
  "mic-off": '<line x1="2" x2="22" y1="2" y2="22" /> <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" /> <path d="M5 10v2a7 7 0 0 0 12 5" /> <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /> <path d="M9 9v3a3 3 0 0 0 5.12 2.12" /> <line x1="12" x2="12" y1="19" y2="22" />',
  "scroll-text": '<path d="M15 12h-5" /> <path d="M15 8h-5" /> <path d="M19 17V5a2 2 0 0 0-2-2H4" /> <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /> <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /> <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /> <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />',
  play: '<polygon points="6 3 20 12 6 21 6 3" />',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1" /> <rect x="6" y="4" width="4" height="16" rx="1" />',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /> <circle cx="12" cy="13" r="3" />',
  "camera-off": '<line x1="2" x2="22" y1="2" y2="22" /> <path d="M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16" /> <path d="M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5" /> <path d="M14.121 15.121A3 3 0 1 1 9.88 10.88" />',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" />',
  type: '<polyline points="4 7 4 4 20 4 20 7" /> <line x1="9" x2="15" y1="20" y2="20" /> <line x1="12" x2="12" y1="4" y2="20" />',
  gauge: '<path d="m12 14 4-4" /> <path d="M3.34 19a10 10 0 1 1 17.32 0" />',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14" /> <path d="M18 22V8a2 2 0 0 0-2-2H2" />',
};

const DEF = {
  font: 42, margin: 6, line: 1.5,
  fontFam: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  speed: 60, useWpm: false, wpm: 140, count: 3, mirX: false, mirY: false, guide: true,
  camRes: "max", camFace: "user", fps: 30, readPos: 35, reels: false, fixMirror: true,
  cardOn: false, cardPos: "top", cardH: 35, cardW: 100, cardColor: "preto",
  theme: "dark", mode: "voice", micDeviceId: "",
};

function PrompterPlayerInner({ title, text, onExit }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useEffect(() => {
    const root = rootRef.current!;
    const $ = (s: string) => root.querySelector(s) as any;
    const $$ = (s: string) => root.querySelectorAll(s) as NodeListOf<any>;

    /* ---------- settings (localStorage; roteiros ficam no Supabase) ---------- */
    let S: any = { ...DEF };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) S = Object.assign({}, DEF, JSON.parse(raw));
    } catch { /* primeiro uso */ }
    const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S)); } catch { /* quota */ } };

    /* ---------- ícones ---------- */
    function refreshIcons(scope?: Element) {
      (scope || root).querySelectorAll("[data-lucide]").forEach((el) => {
        const inner = ICONS[el.getAttribute("data-lucide")!] || "";
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("class", "lucide"); svg.innerHTML = inner;
        el.replaceWith(svg);
      });
    }
    const applyTheme = () => root.classList.toggle("light", S.theme === "light");

    /* ---------- toast ---------- */
    let toastT: any;
    function toast(msg: string, ms = 2600) {
      const t = $("#cprToast"); if (!t) return;
      t.textContent = msg; t.style.display = "block";
      clearTimeout(toastT); toastT = setTimeout(() => (t.style.display = "none"), ms);
    }

    /* ============================================================
       PROMPTER — núcleo
       ============================================================ */
    let words: string[] = [], wordEls: HTMLElement[] = [], pos = 0, mode = S.mode || "voice";
    let playing = false, rafId: number | null = null, lastT = 0, pxPerSec = 60;
    let wakeLock: any = null;
    let disposed = false;

    const vp = $("#prompterViewport") as HTMLElement;
    const pt = $("#prompterText") as HTMLElement;

    function normWord(w: string) {
      return w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    }
    function buildText() {
      pt.innerHTML = ""; words = []; wordEls = [];
      const paras = text.split(/\n+/);
      paras.forEach((p) => {
        if (/^\s*\[pausa\]\s*$/i.test(p)) {
          const d = document.createElement("div"); d.className = "pausebreak"; d.textContent = "●●●"; pt.appendChild(d); return;
        }
        const div = document.createElement("div"); div.style.marginBottom = "0.8em";
        let em = false;
        p.split(/(\*\*)/).forEach((seg) => {
          if (seg === "**") { em = !em; return; }
          (seg.match(/\S+/g) || []).forEach((w) => {
            if (/^\[pausa\]$/i.test(w)) {
              const ps = document.createElement("span"); ps.className = "pausebreak"; ps.textContent = " ●●● "; div.appendChild(ps); return;
            }
            const sp = document.createElement("span"); sp.className = "w" + (em ? " em" : ""); sp.textContent = w + " ";
            (sp as any).dataset.i = String(words.length); div.appendChild(sp);
            words.push(normWord(w)); wordEls.push(sp);
          });
        });
        if (div.childNodes.length) pt.appendChild(div);
      });
    }
    function resetProgress() {
      pos = 0; wordEls.forEach((e) => e.classList.remove("done", "cur"));
      vp.scrollTop = 0; stopPlay();
    }
    function requestWake() {
      if ("wakeLock" in navigator) (navigator as any).wakeLock.request("screen").then((w: any) => (wakeLock = w)).catch(() => {});
    }
    const onVis = () => {
      if (disposed) return;
      if (document.visibilityState === "visible") { requestWake(); return; }
      /* app foi pro fundo sem estar gravando: solta o mic na hora (o indicador
         laranja do iPhone apaga). Na volta, o app recaptura sem novo prompt. */
      if (!(recorder && recorder.state === "recording")) {
        if (sessionMic) { try { sessionMic.getTracks().forEach((t) => t.stop()); } catch { /* ok */ } sessionMic = null; }
        micStream = null; resetAudioGraph(); stopVu();
        try { setMicIcon(); } catch { /* ok */ }
      }
    };
    document.addEventListener("visibilitychange", onVis);

    /* ---------- settings apply ---------- */
    function applySettings() {
      pt.style.fontSize = S.font + "px";
      pt.style.lineHeight = String(S.line);
      pt.style.fontFamily = S.fontFam;
      pt.style.paddingLeft = S.margin + "vw"; pt.style.paddingRight = S.margin + "vw";
      root.classList.toggle("mirrorX", S.mirX);
      root.classList.toggle("mirrorY", S.mirY);
      root.classList.toggle("reels", S.reels);
      root.style.setProperty("--readpos", S.readPos + "%");
      root.classList.toggle("cardMode", S.cardOn);
      root.classList.toggle("cardWhite", S.cardOn && S.cardColor === "branco");
      if (S.cardOn) {
        vp.style.height = S.cardH + "%";
        vp.style.width = S.cardW + "%";
        vp.style.left = (100 - S.cardW) / 2 + "%";
        vp.style.right = "auto";
        if (S.cardPos === "top") { vp.style.top = "calc(env(safe-area-inset-top) + 62px)"; vp.style.bottom = "auto"; }
        else if (S.cardPos === "bottom") { vp.style.top = "auto"; vp.style.bottom = "calc(env(safe-area-inset-bottom) + 92px)"; }
        else { vp.style.top = (100 - S.cardH) / 2 + "%"; vp.style.bottom = "auto"; }
      } else {
        vp.style.height = ""; vp.style.width = ""; vp.style.left = ""; vp.style.right = ""; vp.style.top = ""; vp.style.bottom = "";
      }
      requestAnimationFrame(() => {
        if (disposed) return;
        if (S.cardOn) {
          pt.style.paddingTop = Math.round(vp.clientHeight * S.readPos / 100) + "px";
          pt.style.paddingBottom = Math.round(vp.clientHeight * 0.9) + "px";
        } else { pt.style.paddingTop = "45vh"; pt.style.paddingBottom = "60vh"; }
        const r = vp.getBoundingClientRect(), g = $("#guide");
        if (g) {
          g.style.top = Math.round(r.top + (r.height * S.readPos) / 100) + "px";
          g.style.left = S.cardOn ? Math.max(0, Math.round(r.left - 2)) + "px" : "0px";
        }
      });
      $("#guide").style.display = S.guide ? "block" : "none";
      $("#vFont").textContent = S.font + "px"; $("#vMargin").textContent = S.margin + "%";
      $("#vLine").textContent = String(S.line); $("#vSpeed").textContent = S.speed + " px/s";
      $("#vWpm").textContent = S.wpm + " wpm"; $("#vCount").textContent = S.count + "s";
      $("#vRead").textContent = S.readPos + "%";
      $("#vCardH").textContent = S.cardH + "%"; $("#vCardW").textContent = S.cardW + "%";
      updateFrameGuide();
    }
    function updateFrameGuide() {
      const w = window.innerWidth, h = window.innerHeight;
      const target = (h * 9) / 16;
      const side = w > target ? (w - target) / 2 : 0;
      $("#fgL").style.width = $("#fgR").style.width = side + "px";
    }
    const onResize = () => applySettings();
    window.addEventListener("resize", onResize);

    function initSettingsUI() {
      $("#sFont").value = S.font; $("#sMargin").value = S.margin; $("#sLine").value = S.line;
      $("#sFontFam").value = S.fontFam; $("#sSpeed").value = S.speed; $("#sUseWpm").checked = S.useWpm;
      $("#sWpm").value = S.wpm; $("#sCount").value = S.count; $("#sMirX").checked = S.mirX;
      $("#sMirY").checked = S.mirY; $("#sGuide").checked = S.guide; $("#sCamRes").value = S.camRes; $("#sCamFace").value = S.camFace;
      $("#sRead").value = S.readPos; $("#sReels").checked = S.reels; $("#sFps").value = String(S.fps);
      $("#sFixMirror").checked = S.fixMirror; $("#sCardOn").checked = S.cardOn; $("#sCardPos").value = S.cardPos;
      $("#sCardH").value = S.cardH; $("#sCardW").value = S.cardW; $("#sCardColor").value = S.cardColor;
      const bind = (id: string, key: string, parse?: (v: string) => any) => {
        $(id).addEventListener("input", (e: any) => { S[key] = parse ? parse(e.target.value) : e.target.value; save(); applySettings(); });
      };
      bind("#sFont", "font", Number); bind("#sMargin", "margin", Number); bind("#sLine", "line", Number);
      bind("#sFontFam", "fontFam"); bind("#sSpeed", "speed", Number); bind("#sWpm", "wpm", Number); bind("#sCount", "count", Number);
      bind("#sRead", "readPos", Number); bind("#sCardH", "cardH", Number); bind("#sCardW", "cardW", Number);
      $("#sCardPos").addEventListener("change", (e: any) => { S.cardPos = e.target.value; save(); applySettings(); });
      $("#sCardColor").addEventListener("change", (e: any) => { S.cardColor = e.target.value; save(); applySettings(); });
      const bindChk = (id: string, key: string) => {
        $(id).addEventListener("change", (e: any) => { S[key] = e.target.checked; save(); applySettings(); syncQuick(); });
      };
      bindChk("#sUseWpm", "useWpm"); bindChk("#sMirX", "mirX"); bindChk("#sMirY", "mirY"); bindChk("#sGuide", "guide");
      bindChk("#sReels", "reels"); bindChk("#sCardOn", "cardOn"); bindChk("#sFixMirror", "fixMirror");
      $("#sCamRes").addEventListener("change", (e: any) => { S.camRes = e.target.value; save(); if (camStream) startCamera(true); });
      $("#sCamFace").addEventListener("change", (e: any) => { S.camFace = e.target.value; save(); if (camStream) startCamera(true); });
      $("#sFps").addEventListener("change", (e: any) => { S.fps = Number(e.target.value); save(); if (camStream) startCamera(true); });
      /* trocar de microfone: salva e recaptura na hora pra valer no VU e na
         próxima gravação, no mesmo padrão dos outros toggles de mic */
      $("#sMicDevice").addEventListener("change", async (e: any) => {
        S.micDeviceId = (e.target.value || "").toString(); save();
        micEnabled = true;
        forceFreshMic();
        await ensureMic();
        if (micLive()) { buildAnalyser(); watchMicTrack(); startVu(); }
        setMicIcon();
      });
    }
    $("#settingsBtn").onclick = () => { $("#settingsPanel").classList.add("open"); $("#overlay").classList.add("show"); try { populateMicDevices(); } catch { /* ok */ } };
    /* repopula a lista quando um mic é conectado/desconectado */
    const onDeviceChange = () => { try { populateMicDevices(); } catch { /* ok */ } };
    try { (navigator.mediaDevices as any)?.addEventListener?.("devicechange", onDeviceChange); } catch { /* ok */ }
    $("#closeSettings").onclick = $("#overlay").onclick = () => { $("#settingsPanel").classList.remove("open"); $("#overlay").classList.remove("show"); };

    /* ---------- modes ---------- */
    const MODE_META: Record<string, [string, string]> = { voice: ["mic", "Por voz"], auto: ["scroll-text", "Rolagem"], manual: ["hand", "Manual"] };
    function setMode(m: string) {
      /* iPhone/Safari não suporta seguir o texto pela voz. Ao escolher "Por voz"
         no iOS, abre o aviso e cai na Rolagem automática. */
      if (m === "voice" && isIOS) {
        $("#iosVoiceSheet")?.classList.add("show");
        setMode("auto");
        return;
      }
      mode = m; S.mode = m; save();
      const [ic, lbl] = MODE_META[m];
      $("#modeBtn").innerHTML = '<i data-lucide="' + ic + '"></i><small>' + lbl + "</small>";
      $$("#modeMenu button").forEach((b: any) => b.classList.toggle("on", b.dataset.mode === m));
      stopPlay();
      $("#voiceStatus").style.display = m === "voice" ? "inline" : "none";
      $("#playBtn").style.display = m === "manual" ? "none" : "inline-flex";
      refreshIcons($("#modeBtn"));
    }
    $("#modeBtn").onclick = (e: Event) => { e.stopPropagation(); $("#modeMenu").classList.toggle("show"); };
    $$("#modeMenu button").forEach((b: any) => (b.onclick = () => { setMode(b.dataset.mode); $("#modeMenu").classList.remove("show"); }));
    const onDocClick = (e: Event) => { if (!(e.target as Element).closest("#modeMenu,#modeBtn")) $("#modeMenu")?.classList.remove("show"); };
    document.addEventListener("click", onDocClick);
    /* aviso do iOS sobre o modo por voz: só fecha o popup (o modo já está em Rolagem) */
    $("#iosVoiceClose").onclick = () => $("#iosVoiceSheet").classList.remove("show");
    $("#iosVoiceSpeed").onclick = () => {
      $("#iosVoiceSheet").classList.remove("show");
      $("#settingsPanel").classList.add("open"); $("#overlay").classList.add("show");
    };

    /* ---------- quick actions ---------- */
    function syncQuick() {
      $("#qCard").classList.toggle("on", S.cardOn);
      $("#qReels").classList.toggle("on", S.reels);
      $("#qMir").classList.toggle("on", S.mirX);
    }
    $("#qFlip").onclick = () => {
      S.camFace = S.camFace === "user" ? "environment" : "user"; $("#sCamFace").value = S.camFace; save();
      if (camStream) startCamera(true); else toast(S.camFace === "user" ? "Câmera frontal selecionada" : "Câmera traseira selecionada");
    };
    $("#qCard").onclick = () => { S.cardOn = !S.cardOn; $("#sCardOn").checked = S.cardOn; save(); applySettings(); syncQuick(); };
    $("#qReels").onclick = () => { S.reels = !S.reels; $("#sReels").checked = S.reels; save(); applySettings(); syncQuick(); };
    $("#qMir").onclick = () => { S.mirX = !S.mirX; $("#sMirX").checked = S.mirX; save(); applySettings(); syncQuick(); };
    $("#qTheme").onclick = () => { S.theme = S.theme === "light" ? "dark" : "light"; save(); applyTheme(); };

    /* ---------- play / pause ---------- */
    function setPlayIcon() {
      $("#playBtn").innerHTML = '<i data-lucide="' + (playing ? "pause" : "play") + '"></i><small>' + (playing ? "Pausar" : "Play") + "</small>";
      refreshIcons($("#playBtn"));
    }
    $("#playBtn").onclick = () => { playing ? stopPlay() : startPlay(); };
    $("#restartBtn").onclick = () => resetProgress();
    function startPlay(onReady?: () => void) {
      const go = () => {
        playing = true; setPlayIcon();
        if (mode === "auto") { computeSpeed(); lastT = performance.now(); rafId = requestAnimationFrame(tick); }
        else if (mode === "voice") startVoice();
        if (typeof onReady === "function") onReady();
      };
      if (S.count > 0) countdown(S.count, go); else go();
    }
    function stopPlay() {
      playing = false; setPlayIcon();
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      stopVoice();
    }
    function countdown(n: number, done: () => void) {
      const el = $("#countdown"); el.style.display = "flex";
      let i = n; el.textContent = String(i);
      const iv = setInterval(() => {
        if (disposed) { clearInterval(iv); return; }
        i--;
        if (i <= 0) { clearInterval(iv); el.style.display = "none"; done(); } else el.textContent = String(i);
      }, 1000);
    }
    function computeSpeed() {
      if (S.useWpm && words.length) {
        const h = pt.scrollHeight - parseFloat(getComputedStyle(pt).paddingTop) - parseFloat(getComputedStyle(pt).paddingBottom);
        pxPerSec = (S.wpm / 60) * (h / words.length);
      } else pxPerSec = S.speed;
    }
    function tick(t: number) {
      if (!playing || disposed) return;
      const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t; /* clamp: 1o frame ou aba dormida não dá pulo */
      if (mode === "voice") tickVoice(t, dt);
      else if (!userScrolling && !touchDown) vp.scrollTop += pxPerSec * dt; /* dedo no texto = rolagem livre */
      if (vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 2) { stopPlay(); toast("Fim do roteiro 🎉"); }
      else rafId = requestAnimationFrame(tick);
    }
    vp.addEventListener("click", () => { if (playing) root.classList.toggle("barsHidden"); });

    /* ============================================================
       VOICE FOLLOWING (pt-BR)
       ============================================================ */
    function wordsEq(a: string, b: string) {
      if (!a || !b) return false;
      if (a === b) return true;
      if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
      if (a.length >= 5 && b.length >= 5 && lev1(a, b)) return true;
      return false;
    }
    function lev1(a: string, b: string) {
      if (Math.abs(a.length - b.length) > 1) return false;
      let i = 0, j = 0, d = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++d > 1) return false;
        if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
      }
      return d + (a.length - i) + (b.length - j) <= 1;
    }

    const LOOKAHEAD = 12, TAIL = 8;

    /* ---------- VAD: rolagem gatilhada por INTENSIDADE DE VOZ ----------
       Sem SpeechRecognition (que no iOS Safari tomava o mic com exclusividade e
       deixava a gravação muda). Aqui o texto rola enquanto a pessoa FALA e segura
       no silêncio, lendo o nível do MESMO micAnalyser que já alimenta o medidor.
       O microfone vai só pro gravador + analyser, então o áudio grava em todo
       navegador (Safari no iPhone, Chrome no Android, desktop). */
    let vadBuf: Uint8Array | null = null;
    let vadFloor = 0.02, vadEnv = 0, vadLastLoud = -1e9, vadHlT = 0;
    const VOICE_HOLD_MS = 400; /* release: pausa curta entre palavras não para a rolagem */
    function resetVad() {
      vadFloor = 0.02; vadEnv = 0; vadLastLoud = -1e9; vadHlT = 0;
    }
    /* nível 0..1 do microfone (RMS do desvio em torno de 128); -1 = mic não pronto */
    function readVoiceLevel(): number {
      if (!micAnalyser) return -1;
      if (!vadBuf || vadBuf.length !== micAnalyser.fftSize) vadBuf = new Uint8Array(micAnalyser.fftSize);
      micAnalyser.getByteTimeDomainData(vadBuf);
      let sum = 0;
      for (let i = 0; i < vadBuf.length; i++) { const d = vadBuf[i] - 128; sum += d * d; }
      return Math.sqrt(sum / vadBuf.length) / 128;
    }
    function tickVoice(t: number, dt: number) {
      /* iOS às vezes suspende o AudioContext: tenta retomar (barato, no-op se não der) */
      if (audioCtx && audioCtx.state !== "running") { try { audioCtx.resume().catch(() => {}); } catch { /* ok */ } }
      const lvl = readVoiceLevel();
      if (lvl < 0) return; /* analyser ainda não pronto: segura o texto */
      /* PISO DE RUÍDO adaptativo, robusto contra "falar já no começo": desce rápido
         pro silêncio, sobe MUITO devagar, com teto baixo pra a fala sempre passar.
         Sem janela de calibração (ela capturava a voz como se fosse ruído e travava). */
      if (lvl < vadFloor) vadFloor += (lvl - vadFloor) * 0.5;
      else vadFloor += (lvl - vadFloor) * 0.002;
      if (vadFloor > 0.03) vadFloor = 0.03;
      /* envelope: ataque rápido (40ms), release lento (250ms), sem stutter */
      const tau = lvl > vadEnv ? 0.04 : 0.25;
      vadEnv += (lvl - vadEnv) * (1 - Math.exp(-dt / tau));
      /* limiar = piso + margem, com mínimo absoluto: fala real (>~0.08) sempre passa,
         sala em silêncio (~0.01) não dispara. */
      const thr = Math.max(0.03, vadFloor + 0.012);
      if (vadEnv > thr) vadLastLoud = t;
      /* realce da palavra na linha de leitura, derivado da rolagem (throttle 140ms) */
      if (t - vadHlT > 140) { vadHlT = t; const i = currentWordAtLine(); if (i !== pos) hardSetPos(i); }
      const speaking = (t - vadLastLoud) < VOICE_HOLD_MS;
      if (speaking && !userScrolling && !touchDown) {
        const over = Math.min(1, (vadEnv - thr) / 0.06);
        vp.scrollTop += pxPerSec * dt * (0.7 + over * 0.45); /* 0.7x..1.15x pela energia */
      }
    }
    function startVoice() {
      resetVad();
      computeSpeed();
      /* garante o pipeline de microfone + analyser (VAD precisa de dado mesmo sem
         estar gravando). ensureMic é async: o tick já segura o texto até o mic vir. */
      if (micEnabled) {
        void (async () => {
          await ensureMic();
          if (disposed) return;
          if (micLive()) { buildAnalyser(); watchMicTrack(); startVu(); $("#voiceDot")?.classList.add("live"); }
          else $("#voiceDot")?.classList.remove("live");
        })();
      } else {
        $("#voiceDot")?.classList.remove("live");
      }
      lastT = performance.now();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    }
    function stopVoice() {
      $("#voiceDot")?.classList.remove("live");
    }
    function matchAdvance(tail: string[]) {
      if (!words.length) return;
      if (userScrolling || touchDown) return; /* usuário arrastando: não puxa */
      const start = Math.max(0, pos - 2), end = Math.min(words.length - 1, pos + LOOKAHEAD);
      let bestJ = -1, bestScore = 0;
      for (let j = start; j <= end; j++) {
        let score = 0, k = tail.length - 1, jj = j, misses = 0;
        while (k >= 0 && jj >= 0 && misses <= 2) {
          if (wordsEq(tail[k], words[jj])) { score++; k--; jj--; }
          else { misses++; k--; }
        }
        const dist = Math.abs(j - pos);
        const adj = score - dist * 0.18;
        if (score >= 2 && adj > bestScore) { bestScore = adj; bestJ = j; }
      }
      if (bestJ < 0 && tail.length) {
        for (let j = pos; j <= Math.min(pos + 3, words.length - 1); j++) {
          if (wordsEq(tail[tail.length - 1], words[j])) { bestJ = j; break; }
        }
      }
      if (bestJ >= 0) setPos(bestJ + 1);
    }
    function setPos(p: number) {
      p = Math.min(p, words.length);
      for (let i = pos; i < p; i++) { wordEls[i].classList.add("done"); wordEls[i].classList.remove("cur"); }
      pos = p;
      if (pos < words.length) {
        const el = wordEls[pos]; el.classList.add("cur");
        scrollToWord(pos);
      } else { stopPlay(); toast("Fim do roteiro 🎉"); }
    }
    function scrollToWord(i: number) {
      const el = wordEls[i]; if (!el) return;
      const target = Math.max(0, el.offsetTop - vp.clientHeight * (S.readPos / 100));
      if (Math.abs(target - vp.scrollTop) < 2) return;
      autoScrollUntil = Date.now() + 900; /* rolagem programática */
      vp.scrollTo({ top: target, behavior: "smooth" });
    }

    /* ---------- rolagem manual com re-sincronização ---------- */
    let autoScrollUntil = 0, userScrolling = false, touchDown = false, resyncT: any = null;
    function markUserScroll() { userScrolling = true; autoScrollUntil = 0; clearTimeout(resyncT); }
    function scheduleResync() {
      clearTimeout(resyncT);
      resyncT = setTimeout(() => { userScrolling = false; resyncFromScroll(); }, 260);
    }
    vp.addEventListener("touchstart", () => { touchDown = true; markUserScroll(); }, { passive: true });
    vp.addEventListener("touchmove", markUserScroll, { passive: true });
    vp.addEventListener("touchend", () => { touchDown = false; scheduleResync(); }, { passive: true });
    vp.addEventListener("touchcancel", () => { touchDown = false; scheduleResync(); }, { passive: true });
    vp.addEventListener("wheel", () => { markUserScroll(); scheduleResync(); }, { passive: true });
    vp.addEventListener("scroll", () => {
      if (Date.now() < autoScrollUntil) return;
      if (userScrolling || touchDown) scheduleResync();
    }, { passive: true });

    function currentWordAtLine() {
      if (!wordEls.length) return 0;
      const line = vp.scrollTop + vp.clientHeight * (S.readPos / 100);
      let lo = 0, hi = wordEls.length - 1, ans = wordEls.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1, el = wordEls[mid];
        if (el.offsetTop + el.offsetHeight > line) { ans = mid; hi = mid - 1; }
        else lo = mid + 1;
      }
      return ans;
    }
    function hardSetPos(p: number) {
      p = Math.max(0, Math.min(p, words.length));
      for (let i = 0; i < wordEls.length; i++) {
        wordEls[i].classList.toggle("done", i < p);
        wordEls[i].classList.toggle("cur", i === p);
      }
      pos = p;
    }
    function resyncFromScroll() {
      if (mode === "auto" || !wordEls.length) return;
      const i = currentWordAtLine(), prev = pos;
      if (i === prev) return;
      hardSetPos(i);
      if (mode === "voice" && playing) {
        const w = wordEls[i] ? wordEls[i].textContent!.trim() : "";
        toast((i < prev ? "↩︎ Voltei para: " : "Retomando em: ") + "“" + w + "”", 1500);
      }
    }

    /* ============================================================
       CAMERA + RECORDING
       ============================================================ */
    let camStream: MediaStream | null = null, recorder: MediaRecorder | null = null, chunks: Blob[] = [], recT0 = 0, recIv: any = null;
    const camVideo = $("#camVideo") as HTMLVideoElement;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    /* mic capturado 1x e roteado por WebAudio (evita vídeo mudo no iOS) */
    let micStream: MediaStream | null = null, audioCtx: AudioContext | null = null,
      micSource: MediaStreamAudioSourceNode | null = null, micAnalyser: AnalyserNode | null = null;
    /* "live" não basta no iOS: o sistema silencia a trilha e ela vira zumbi
       (readyState live, muted true). Trilha muda = mic inválido. */
    function micLive() { const t = micStream && micStream.getAudioTracks()[0]; return !!t && t.readyState === "live" && !t.muted; }
    function forceFreshMic() {
      try { if (sessionMic) sessionMic.getTracks().forEach((t) => t.stop()); } catch { /* ok */ }
      sessionMic = null; micStream = null; resetAudioGraph();
    }
    function resetAudioGraph() { try { if (micSource) micSource.disconnect(); } catch { /* ok */ } micSource = null; micAnalyser = null; }
    async function ensureMic() {
      if (micLive()) return micStream;
      /* reaproveita o mic da sessão (evita novo prompt do iOS ao reentrar),
         mas só se a trilha estiver viva E com som (não zumbi) */
      const st = sessionMic && sessionMic.getAudioTracks()[0];
      if (st && st.readyState === "live" && !st.muted) { micStream = sessionMic; resetAudioGraph(); return micStream; }
      forceFreshMic();
      resetAudioGraph();
      const baseAudio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
      const wantId = (S.micDeviceId || "").toString();
      const audioConstraints: any = wantId ? { ...baseAudio, deviceId: { exact: wantId } } : { ...baseAudio };
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        sessionMic = micStream;
      } catch (e: any) {
        micStream = null;
        const name = e && e.name;
        /* microfone escolhido sumiu/ocupado: cai pro padrão do sistema em vez de
           deixar a gravação sem áudio. Só faz sentido se havia um deviceId forçado. */
        const constraintFail = name === "OverconstrainedError" || name === "NotFoundError" || name === "NotReadableError" || name === "DevicesNotFoundError";
        if (wantId && constraintFail) {
          try {
            S.micDeviceId = ""; save();
            $("#sMicDevice") && ($("#sMicDevice").value = "");
            micStream = await navigator.mediaDevices.getUserMedia({ audio: { ...baseAudio } });
            sessionMic = micStream;
            toast("Microfone escolhido indisponível, usando o padrão.", 4000);
          } catch (e2: any) {
            micStream = null;
            if (e2 && (e2.name === "NotAllowedError" || e2.name === "SecurityError")) showPermSheet("denied");
            else toast("Sem acesso ao microfone. Confere a permissão e tenta de novo.", 5000);
          }
        } else if (name === "NotAllowedError" || name === "SecurityError") showPermSheet("denied");
        else toast("Sem acesso ao microfone. Confere a permissão e tenta de novo.", 5000);
      }
      if (micStream) { try { populateMicDevices(); } catch { /* ok */ } }
      return micStream;
    }
    /* Analyser SÓ pro VU (não fica no caminho da gravação). No iOS o
       AudioContext pode acordar "interrupted"/"suspended" — qualquer estado
       diferente de running, tenta resume (idealmente dentro de um gesto). */
    function buildAnalyser() {
      if (!micLive()) return;
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!audioCtx) audioCtx = new AC();
        if (audioCtx!.state !== "running") audioCtx!.resume().catch(() => {});
        if (!micSource) micSource = audioCtx!.createMediaStreamSource(micStream!);
        if (!micAnalyser) { micAnalyser = audioCtx!.createAnalyser(); micAnalyser.fftSize = 512; micSource.connect(micAnalyser); }
      } catch { /* VU indisponível; gravação não depende dele */ }
    }
    /* A GRAVAÇÃO recebe a trilha CRUA do mic, sem WebAudio no meio.
       O túnel mic→AudioContext→MediaRecorder do protótipo era o ponto que o
       iOS silenciava (contexto interrompido = gravação muda com mic bom).
       Clone: o recorder ganha a própria trilha, sem brigar com o VU. */
    function micTrackForRecording() {
      if (!micLive()) return null;
      buildAnalyser();
      const t = micStream!.getAudioTracks()[0];
      if (!t) return null;
      try { return t.clone(); } catch { return t; }
    }
    /* vigia de silêncio */
    let silIv: any = null, sawSound = false;
    function stopAudioWatch() { if (silIv) { clearInterval(silIv); silIv = null; } }
    function startAudioWatch() {
      stopAudioWatch(); sawSound = false;
      if (!micEnabled) return; /* sem áudio de propósito: não reclama */
      if (!micAnalyser) { showMicSheet(); return; }
      const buf = new Uint8Array(micAnalyser.fftSize);
      silIv = setInterval(() => {
        micAnalyser!.getByteTimeDomainData(buf);
        let peak = 0; for (let i = 0; i < buf.length; i++) { const d = Math.abs(buf[i] - 128); if (d > peak) peak = d; }
        if (peak > 3) sawSound = true;
      }, 200);
      setTimeout(() => {
        if (!(recorder && recorder.state === "recording") || sawSound) return;
        /* medidor quebrado (AudioContext fora do ar) não é prova de gravação
           muda — a trilha crua pode estar ok. Só alarma com medidor confiável. */
        if (!audioCtx || audioCtx.state !== "running") return;
        showMicSheet();
      }, 4000);
    }

    /* ---------- botão de microfone: estado visível + liga/desliga ----------
       Pedido do Walter: a pessoa precisa VER se o mic está pegando antes de
       gravar. Botão com 3 estados: Mic (habilitado), Mic off (desligado pela
       pessoa) e brilho verde quando está captando som de verdade (VU). */
    let micEnabled = true, vuIv: any = null;
    function setMicIcon() {
      const t = micStream && micStream.getAudioTracks()[0];
      const muted = !!(t && (t.muted || t.readyState !== "live"));
      const label = !micEnabled ? "Mic off" : muted ? "Mudo" : "Mic";
      const icon = !micEnabled || muted ? "mic-off" : "mic";
      $("#micBtn").innerHTML = '<i data-lucide="' + icon + '"></i><small>' + label + "</small>";
      $("#micBtn").classList.toggle("off", !micEnabled || muted);
      if (!micEnabled) $("#micBtn").classList.remove("hot");
      refreshIcons($("#micBtn"));
    }
    /* o iOS muta/desmuta a trilha por conta própria — reflete no botão na hora */
    function watchMicTrack() {
      const t = micStream && micStream.getAudioTracks()[0];
      if (!t) return;
      t.onmute = t.onunmute = t.onended = () => { if (!disposed) setMicIcon(); };
    }
    /* captura nova + grafo novo + VU; usado no toggle e depois da câmera */
    async function refreshMicPipeline() {
      forceFreshMic();
      await ensureMic();
      if (!micLive()) return false;
      buildAnalyser();
      try { if (audioCtx && audioCtx.state !== "running") audioCtx.resume(); } catch { /* ok */ }
      watchMicTrack(); startVu();
      return true;
    }
    /* ---------- lista de microfones (seletor de entrada de áudio) ----------
       Os labels só vêm depois da permissão concedida; antes disso enumerateDevices
       devolve entradas sem nome. Repopulamos ao abrir Ajustes, depois de uma
       captura boa e quando um mic é conectado/desconectado (devicechange). */
    async function populateMicDevices() {
      const sel = $("#sMicDevice") as HTMLSelectElement | null;
      if (!sel) return;
      let list: any[] = [];
      try { list = await (navigator.mediaDevices as any).enumerateDevices(); } catch { list = []; }
      const mics = (list || []).filter((d: any) => d && d.kind === "audioinput");
      const want = (S.micDeviceId || "").toString();
      let html = '<option value="">Padrão do sistema</option>';
      mics.forEach((d: any, i: number) => {
        const label = (d.label && d.label.trim()) ? d.label : ("Microfone " + (i + 1));
        const id = (d.deviceId || "").toString();
        html += '<option value="' + id.replace(/"/g, "&quot;") + '">' + label.replace(/</g, "&lt;") + "</option>";
      });
      sel.innerHTML = html;
      /* se o mic salvo ainda existe, mantém selecionado; senão volta pro padrão */
      const exists = want && mics.some((d: any) => (d.deviceId || "").toString() === want);
      sel.value = exists ? want : "";
    }
    function stopVu() { if (vuIv) { clearInterval(vuIv); vuIv = null; } $("#micBtn")?.classList.remove("hot"); }
    function startVu() {
      stopVu();
      vuIv = setInterval(() => {
        if (disposed || !micAnalyser || !micEnabled) { $("#micBtn")?.classList.remove("hot"); return; }
        const buf = new Uint8Array(micAnalyser.fftSize);
        micAnalyser.getByteTimeDomainData(buf);
        let peak = 0; for (let i = 0; i < buf.length; i++) { const d = Math.abs(buf[i] - 128); if (d > peak) peak = d; }
        $("#micBtn")?.classList.toggle("hot", peak > 3);
      }, 200);
    }
    $("#micBtn").onclick = async () => {
      const t = micStream && micStream.getAudioTracks()[0];
      const wasMuted = micEnabled && !!(t && (t.muted || t.readyState !== "live"));
      /* botão mudo = a pessoa quer CONSERTAR, não desligar: recaptura na hora */
      if (!micEnabled || wasMuted) {
        micEnabled = true;
        const ok = await refreshMicPipeline();
        toast(ok ? "Microfone renovado. Fala algo: o botão brilha verde quando está captando. 🎙️" : "Ainda sem acesso ao microfone. Confere a permissão.", 5000);
      } else {
        micEnabled = false;
        toast("Microfone desativado: o vídeo sai sem áudio.");
      }
      setMicIcon();
    };

    function setCamIcon() {
      $("#camBtn").innerHTML = '<i data-lucide="' + (camStream ? "camera-off" : "camera") + '"></i><small>' + (camStream ? "Desligar" : "Câmera") + "</small>";
      $("#camBtn").classList.toggle("on", !!camStream);
      $("#shutter").classList.toggle("camoff", !camStream);
      $("#shutterLbl").textContent = camStream ? "Gravar" : "Ligar câmera";
      refreshIcons($("#camBtn"));
    }
    /* ---------- permissões com cara de CRIA ----------
       O diálogo nativo do iOS não se estiliza; o que dá pra fazer é preparar a
       pessoa ANTES (sheet de boas-vindas) e socorrer DEPOIS (sheet de ajuda
       quando negou), em vez de vomitar erro em inglês num toast. */
    function showPermSheet(kind: "intro" | "denied") {
      $("#permTitle").textContent = kind === "intro" ? "Liberar câmera e microfone" : "Permissão bloqueada";
      $("#permText").innerHTML = kind === "intro"
        ? "O iPhone/Android vai perguntar se o CRIA pode usar a <b>câmera</b> e o <b>microfone</b>. Toca em <b>Permitir</b> nas duas — é o que faz a mágica do teleprompter por voz e da gravação."
        : "Sem a permissão o prompter não grava. Pra liberar:<br><b>iPhone (Safari):</b> toca em <b>AA</b> na barra de endereço → Ajustes de Site → Câmera e Microfone → <b>Permitir</b>.<br><b>App instalado:</b> feche e abra o app de novo e toque em Permitir quando ele perguntar.<br><b>Android (Chrome):</b> cadeado na barra → Permissões.";
      $("#permGo").textContent = kind === "intro" ? "Beleza, liberar acesso" : "Tentar de novo";
      $("#permSheet").classList.add("show");
    }
    $("#permClose").onclick = () => $("#permSheet").classList.remove("show");
    $("#permGo").onclick = async () => {
      $("#permSheet").classList.remove("show");
      await startCamera();
    };
    const needsPermIntro = () => {
      const st = sessionMic && sessionMic.getAudioTracks()[0];
      const micOk = !!st && st.readyState === "live";
      let seen = false;
      try { seen = !!localStorage.getItem("cria_prompter_perm_seen"); } catch { /* ok */ }
      return !micOk && !camStream && !seen;
    };
    const camFlow = async () => {
      if (needsPermIntro()) {
        try { localStorage.setItem("cria_prompter_perm_seen", "1"); } catch { /* ok */ }
        showPermSheet("intro");
        return;
      }
      await startCamera();
    };
    $("#camBtn").onclick = () => { camStream ? stopCamera() : camFlow(); };
    $("#shutter").onclick = async () => {
      if (!camStream) { await camFlow(); return; }
      recorder && recorder.state === "recording" ? stopRec() : startRec();
    };
    async function startCamera(restart?: boolean) {
      if (restart) stopCamera(true);
      const facingUser = S.camFace === "user";
      const isMax = S.camRes === "max";
      let [w, h] = isMax ? [3840, 2160] : S.camRes.split("x").map(Number);
      /* CÂMERA FRONTAL: teto em 1080p. Pedir os modos altos da frontal faz o
         iOS entregar um sensor RECORTADO (campo de visão menor = cara de zoom).
         1080p usa o FOV padrão, que é o enquadramento da câmera nativa. */
      if (facingUser) { w = Math.min(w, 1920); h = Math.min(h, 1080); }
      await ensureMic(); /* mic separado: câmera pede SÓ vídeo */
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: S.camFace, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: S.fps } },
        });
      } catch (e: any) {
        if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) showPermSheet("denied");
        else toast("Não consegui acessar a câmera: " + e.message);
        return;
      }
      try {
        const track = camStream.getVideoTracks()[0];
        if ((track as any).getCapabilities) {
          const cap: any = (track as any).getCapabilities();
          const want: any = {};
          /* "máxima" só espreme a TRASEIRA; na frontal vira zoom (crop) */
          if (isMax && !facingUser && cap.width && cap.height) { want.width = cap.width.max; want.height = cap.height.max; }
          if (cap.frameRate) want.frameRate = Math.min(cap.frameRate.max || 30, S.fps);
          /* zoom de volta pro neutro, se o navegador expõe o controle */
          if (cap.zoom && typeof cap.zoom.min === "number" && cap.zoom.min <= 1) want.zoom = 1;
          if (Object.keys(want).length) await (track as any).applyConstraints(want).catch(() => {});
        }
      } catch { /* ok */ }
      camVideo.srcObject = camStream; camVideo.style.display = "block";
      camVideo.style.transform = S.camFace === "user" ? "scaleX(-1)" : "none";
      try { await camVideo.play(); } catch { /* autoplay */ }
      root.classList.add("camOn");
      setCamIcon();
      /* ligar a câmera às vezes derruba/silencia o mic no iOS: confere e,
         se preciso, recaptura (sem novo prompt dentro da mesma sessão) */
      if (micEnabled) {
        if (!micLive()) await refreshMicPipeline();
        else { buildAnalyser(); watchMicTrack(); startVu(); }
      }
      setMicIcon();
      const s = camStream.getVideoTracks()[0].getSettings();
      toast("Câmera ligada: " + (s.width || "?") + "×" + (s.height || "?") + (micEnabled && micLive() ? " · mic OK" : " · SEM MIC"));
    }
    function stopCamera(silent?: boolean) {
      if (recorder && recorder.state !== "inactive") stopRec();
      if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; }
      camVideo.style.display = "none"; camVideo.srcObject = null;
      root.classList.remove("camOn");
      setCamIcon();
      if (!silent) toast("Câmera desligada");
    }
    function pickMime() {
      const list = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4",
        "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      for (const m of list) { if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; }
      return "";
    }
    /* espelho na gravação via canvas com requestVideoFrameCallback (sem frame duplicado) */
    let mirCanvas: HTMLCanvasElement | null = null, mirCtx: CanvasRenderingContext2D | null = null,
      mirStream: MediaStream | null = null, mirTrack: MediaStreamTrack | null = null, mirDrawing = false;
    function mirroredVideoTrack() {
      const st = camStream!.getVideoTracks()[0].getSettings();
      const w = st.width || 1280, h = st.height || 720;
      mirCanvas = document.createElement("canvas"); mirCanvas.width = w; mirCanvas.height = h;
      mirCtx = mirCanvas.getContext("2d", { alpha: false, desynchronized: true } as any) as CanvasRenderingContext2D;
      mirCtx!.setTransform(-1, 0, 0, 1, w, 0);
      mirDrawing = true;
      mirStream = (mirCanvas as any).captureStream(0);
      mirTrack = mirStream!.getVideoTracks()[0];
      const manual = !!(mirTrack && (mirTrack as any).requestFrame);
      if (!manual) {
        mirStream!.getTracks().forEach((t) => t.stop());
        mirStream = (mirCanvas as any).captureStream(st.frameRate || S.fps || 30);
        mirTrack = mirStream!.getVideoTracks()[0];
      }
      const pump = () => {
        if (!mirDrawing) return;
        try {
          mirCtx!.drawImage(camVideo, 0, 0, w, h);
          if (manual) (mirTrack as any).requestFrame();
        } catch { /* frame perdido */ }
        if ((camVideo as any).requestVideoFrameCallback) (camVideo as any).requestVideoFrameCallback(() => pump());
        else requestAnimationFrame(pump);
      };
      pump();
      return mirTrack!;
    }
    function makeRecordingStream(rawForce: boolean) {
      const mirror = S.camFace === "user" && S.fixMirror && !rawForce;
      const vTrack = mirror ? mirroredVideoTrack() : camStream!.getVideoTracks()[0];
      const aTrack = micEnabled ? micTrackForRecording() : null;
      return new MediaStream(aTrack ? [vTrack, aTrack] : [vTrack]);
    }
    function stopMirrorPipe() {
      mirDrawing = false;
      if (mirStream) { mirStream.getTracks().forEach((t) => t.stop()); mirStream = null; }
      mirCanvas = null; mirCtx = null; mirTrack = null;
    }

    async function startRec() {
      if (!camStream) return;
      /* começa a rolagem (no modo voz o VAD já segura o texto no silêncio) */
      if (!playing) {
        await new Promise<void>((res) => startPlay(res));
      }
      /* Mic NOVO no momento do REC, já com a sessão de áudio no estado final
         (câmera ligada). Trilha velha capturada em outro estado é exatamente a
         que o iOS entrega muda. Sem novo prompt na mesma sessão. */
      if (micEnabled) {
        forceFreshMic();
        await ensureMic();
        if (micLive()) buildAnalyser(); /* reconstrói o analyser pro VAD seguir vivo */
        watchMicTrack(); startVu(); setMicIcon();
      }
      let vt = camStream && camStream.getVideoTracks()[0];
      if (!vt || vt.readyState !== "live" || vt.muted) {
        await startCamera(true); await sleep(300);
        vt = camStream && camStream.getVideoTracks()[0];
      }
      if (!vt) { toast("Câmera indisponível."); return; }
      const mime = pickMime();
      const vs = vt.getSettings();
      const px = (vs.width || 1920) * (vs.height || 1080), fr = vs.frameRate || S.fps || 30;
      const vbr = Math.min(Math.round(px * fr * 0.12), 50_000_000);
      /* acima de 1080p grava a trilha CRUA (fluidez garantida; espelho fica só no preview) */
      const rawForce = px > 2_300_000;
      if (S.camFace === "user" && S.fixMirror && rawForce) {
        toast("Qualidade máxima: o vídeo sai sem espelho (imagem real) para garantir fluidez. Se quiser espelhado, inverta no CapCut ou grave em 1080p.", 7000);
      }
      const recStream = makeRecordingStream(rawForce);
      if (!recStream.getAudioTracks().length) {
        toast(micEnabled ? "⚠️ Gravando sem áudio: microfone não disponível." : "Gravando sem áudio (microfone desativado no botão Mic).", 6000);
      }
      try {
        recorder = new MediaRecorder(recStream, mime ? { mimeType: mime, videoBitsPerSecond: vbr, audioBitsPerSecond: 192_000 } : {});
      } catch (e: any) { stopMirrorPipe(); toast("Gravação não suportada aqui: " + e.message); return; }
      chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = saveRecording;
      /* iOS: gravar em BLOCO ÚNICO. Com timeslice (start(1000)) o WebKit entrega
         fatias de MP4 sem finalização — duração 00:00, player não toca e o
         Fotos RECUSA salvar. Era a causa raiz do "não salva na galeria".
         Android/desktop (webm) seguem com fatias, que lá funcionam. */
      if (isIOS) recorder.start(); else recorder.start(1000);
      startAudioWatch();
      $("#shutter").classList.add("rec"); $("#shutterLbl").textContent = "Parar";
      recT0 = Date.now(); $("#recTimer").style.display = "inline-block";
      recIv = setInterval(() => {
        const s = Math.floor((Date.now() - recT0) / 1000);
        $("#recTimer").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      }, 500);
    }
    function stopRec() {
      stopAudioWatch();
      if (recorder && recorder.state !== "inactive") recorder.stop();
      $("#shutter").classList.remove("rec"); $("#shutterLbl").textContent = camStream ? "Gravar" : "Ligar câmera";
      clearInterval(recIv); $("#recTimer").style.display = "none";
    }
    function saveRecording() {
      stopMirrorPipe();
      if (discardNext) { discardNext = false; chunks = []; return; }
      const type = recorder!.mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type });
      const name = "cria-prompter_" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + "." + ext;
      showSaveSheet(blob, name, type);
    }

    /* ---------- rede de segurança: áudio não entrou ----------
       No uso normal isso não dispara (o modo voz agora grava áudio em todo
       navegador). Fica só como socorro se a trilha realmente não veio: recaptura
       o microfone e regrava do começo, no mesmo modo. */
    let discardNext = false;
    function showMicSheet() {
      $("#micText").textContent = "Não consegui capturar o áudio do microfone. Verifique a permissão do microfone e tente de novo.";
      $("#micSheet").classList.add("show");
    }
    $("#micKeep").onclick = () => $("#micSheet").classList.remove("show");
    $("#micFix").onclick = async () => {
      $("#micSheet").classList.remove("show");
      discardNext = true;
      stopRec();                                  /* onstop vê discardNext e joga fora */
      forceFreshMic();                            /* mata a trilha zumbi, captura nova */
      resetProgress();
      await sleep(500);
      await ensureMic();
      startRec();
      toast("Regravando com o microfone renovado. 🎙️", 4000);
    };

    /* ---------- vídeo pronto: preview + salvar nas Fotos (share sheet) ----------
       O download automático de antes caía na tela de arquivo do Safari (feia e
       sem "Salvar Vídeo"). Agora: sheet com preview e navigator.share(files),
       que no iPhone/Android abre o share sheet nativo — "Salvar Vídeo" manda
       direto pro rolo da câmera. Download vira o fallback (desktop). */
    let pendingBlob: Blob | null = null, pendingName = "", pendingType = "", pendingUrl = "";
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
    function showSaveSheet(blob: Blob, name: string, type: string) {
      pendingBlob = blob; pendingName = name; pendingType = type;
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
      pendingUrl = URL.createObjectURL(blob);
      const cleanType = (type.split(";")[0] || "video/mp4").trim();
      const v = $("#ssVideo") as HTMLVideoElement;
      /* <source> com type explícito: sem a dica o WebKit às vezes mostra o
         play cortado e se recusa a tocar blob de MediaRecorder */
      v.innerHTML = "";
      const srcEl = document.createElement("source");
      srcEl.src = pendingUrl; srcEl.type = cleanType;
      v.appendChild(srcEl);
      v.onerror = () => { v.style.display = "none"; }; /* preview falhou? some, o vídeo em si está salvo no blob */
      v.style.display = "block";
      /* Blob de MediaRecorder não tem duração indexada: o player mostra
         00:00/00:00 e trava no primeiro frame. O "seek hack" força o browser
         a varrer o arquivo e calcular a duração de verdade. */
      const fixDur = () => {
        if (!isFinite(v.duration) || v.duration === 0) {
          const volta = () => { v.currentTime = 0; v.removeEventListener("seeked", volta); };
          v.addEventListener("seeked", volta);
          try { v.currentTime = 1e7; } catch { /* ok */ }
        }
        v.removeEventListener("loadedmetadata", fixDur);
      };
      v.addEventListener("loadedmetadata", fixDur);
      try { v.load(); } catch { /* ok */ }
      /* Alguns WebKit ignoram <source> filho pra blob: se em 1,5s nada carregou,
         tenta o src direto no elemento. */
      setTimeout(() => {
        if (v.readyState < 2 && pendingUrl) {
          v.innerHTML = ""; v.src = pendingUrl;
          v.addEventListener("loadedmetadata", fixDur);
          try { v.load(); } catch { /* ok */ }
        }
      }, 1500);
      const secs = Math.max(1, Math.round((Date.now() - recT0) / 1000));
      $("#ssMeta").textContent =
        String(Math.floor(secs / 60)).padStart(2, "0") + ":" + String(secs % 60).padStart(2, "0") +
        " · " + (blob.size / 1048576).toFixed(1) + " MB · " + (cleanType.includes("mp4") ? "MP4" : "WebM");
      const canShare = !!((navigator as any).canShare && (navigator as any).canShare({ files: [new File([""], "t.mp4", { type: "video/mp4" })] }));
      $("#ssShare").style.display = canShare ? "flex" : "none";
      /* no iOS o download de blob abre o visualizador de arquivo do Safari e
         NUNCA chega na galeria — é só armadilha. Fica escondido (a não ser
         que o share não exista, aí é o único caminho). */
      $("#ssDownload").style.display = isIOS && canShare ? "none" : "flex";
      $("#ssHint").style.display = isIOS && canShare ? "block" : "none";
      $("#saveSheet").classList.add("show");
    }
    function closeSaveSheet() {
      $("#saveSheet").classList.remove("show");
      const v = $("#ssVideo") as HTMLVideoElement;
      try { v.pause(); } catch { /* ok */ }
      v.innerHTML = ""; v.removeAttribute("src"); try { v.load(); } catch { /* ok */ }
      if (pendingUrl) { URL.revokeObjectURL(pendingUrl); pendingUrl = ""; }
      pendingBlob = null;
    }
    function downloadPending() {
      if (!pendingBlob || !pendingUrl) return;
      const a = document.createElement("a"); a.href = pendingUrl; a.download = pendingName;
      document.body.appendChild(a); a.click();
      setTimeout(() => a.remove(), 2000);
      toast("Baixando " + pendingName);
    }
    $("#ssClose").onclick = () => closeSaveSheet();
    $("#ssDownload").onclick = () => downloadPending();
    $("#ssShare").onclick = async () => {
      if (!pendingBlob) return;
      try {
        /* tipo SEM codecs: "video/mp4;codecs=..." faz o iOS não reconhecer o
           arquivo como vídeo e esconder o "Salvar Vídeo" do share sheet */
        const cleanType = (pendingType.split(";")[0] || "video/mp4").trim();
        const file = new File([pendingBlob], pendingName, { type: cleanType });
        if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({ files: [file] });
          toast("Prontinho! Se escolheu Salvar Vídeo, ele já está na sua galeria. 🎉", 5000);
          return;
        }
      } catch (e: any) {
        if (e && e.name === "AbortError") return; /* pessoa fechou o share sheet */
      }
      downloadPending(); /* fallback: navegador sem share de arquivo */
    };

    /* ---------- exit ---------- */
    function teardown() {
      disposed = true;
      stopPlay();
      if (recorder && recorder.state === "recording") stopRec();
      if (pendingUrl) { URL.revokeObjectURL(pendingUrl); pendingUrl = ""; }
      stopMirrorPipe();
      stopCamera(true);
      /* solta TUDO ao sair: indicador de mic aceso fora do player é quebra de
         confiança. Dentro da mesma sessão da página o iOS NÃO re-pergunta a
         permissão no próximo getUserMedia, então o cache vivo era desnecessário. */
      if (sessionMic) { try { sessionMic.getTracks().forEach((t) => t.stop()); } catch { /* ok */ } sessionMic = null; }
      micStream = null;
      resetAudioGraph();
      if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
      stopAudioWatch(); stopVu();
      clearTimeout(toastT); clearTimeout(resyncT); clearInterval(recIv);
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onResize);
      try { (navigator.mediaDevices as any)?.removeEventListener?.("devicechange", onDeviceChange); } catch { /* ok */ }
    }
    $("#prExit").onclick = () => { exitRef.current(); };

    /* ---------- boot ---------- */
    buildText();
    initSettingsUI();
    applyTheme();
    applySettings();
    /* no iPhone o modo por voz não funciona: começa em Rolagem silenciosamente,
       sem popup no boot (o aviso só aparece quando a pessoa ativa "Por voz" de propósito) */
    setMode(isIOS && (S.mode === "voice" || !S.mode) ? "auto" : (S.mode || "voice"));
    setPlayIcon();
    setCamIcon();
    setMicIcon();
    syncQuick();
    refreshIcons();
    requestWake();
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    try {
      if (!localStorage.getItem("cria_prompter_hint")) {
        localStorage.setItem("cria_prompter_hint", "1");
        setTimeout(() => { if (!disposed) toast("Botão redondo = liga a câmera e grava. Play = só o teleprompter, sem vídeo.", 7000); }, 600);
      }
    } catch { /* ok */ }

    return teardown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Esqueleto estático. O React nunca re-renderiza isto (memo sempre-true):
     o DOM interno pertence à engine imperativa acima. */
  return (
    <div ref={rootRef} className="cpr" aria-label={title}>
      <style>{CSS}</style>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video id="camVideo" autoPlay muted playsInline />
      <div id="camDim" />
      <div id="prompterViewport"><div id="prompterText" /></div>
      <div id="fgL" /><div id="fgR" />
      <div id="guide" />
      <div id="countdown" />

      <div id="topBar">
        <button className="pbtn" id="prExit"><i data-lucide="chevron-left" />Sair</button>
        <div id="quickBar">
          <button className="pbtn" id="qFlip" title="Trocar câmera"><i data-lucide="switch-camera" /><small>Trocar</small></button>
          <button className="pbtn" id="qCard" title="Modo card"><i data-lucide="gallery-thumbnails" /><small>Card</small></button>
          <button className="pbtn" id="qReels" title="Reels 9:16"><i data-lucide="smartphone" /><small>9:16</small></button>
          <button className="pbtn" id="qMir" title="Espelhar"><i data-lucide="flip-horizontal-2" /><small>Espelho</small></button>
          <button className="pbtn" id="qTheme" title="Tema claro/escuro"><i data-lucide="sun-moon" /><small>Tema</small></button>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span id="recTimer">00:00</span>
          <span id="voiceStatus" style={{ display: "none", color: "#fff", fontSize: 13 }}><span id="voiceDot" /></span>
          <button className="pbtn" id="restartBtn" title="Recomeçar do início"><i data-lucide="rotate-ccw" /></button>
          <button className="pbtn" id="settingsBtn"><i data-lucide="settings" /></button>
        </div>
      </div>

      <div id="bottomBar">
        <button className="pbtn" id="modeBtn"><i data-lucide="mic" /><small>Por voz</small></button>
        <button className="pbtn" id="playBtn"><i data-lucide="play" /><small>Play</small></button>
        <div id="shutterWrap">
          <button id="shutter" className="camoff" title="Gravar"><em /></button>
          <small id="shutterLbl">Ligar câmera</small>
        </div>
        <button className="pbtn" id="micBtn"><i data-lucide="mic" /><small>Mic</small></button>
        <button className="pbtn" id="camBtn" title="Câmera"><i data-lucide="camera" /><small>Câmera</small></button>
      </div>
      <div id="modeMenu">
        <button data-mode="voice"><i data-lucide="mic" />Por voz</button>
        <button data-mode="auto"><i data-lucide="scroll-text" />Rolagem</button>
        <button data-mode="manual"><i data-lucide="hand" />Manual</button>
      </div>

      <div id="overlay" />
      <div id="settingsPanel">
        <div className="shandle" />
        <h2>Ajustes do prompter</h2>
        <p className="sgSub">Tudo é salvo na hora, neste aparelho.</p>

        <div className="sgCard">
          <div className="sgHead"><span className="sgChip"><i data-lucide="type" /></span><p className="sgTitle">Texto</p></div>
          <div className="set"><label>Tamanho da fonte <b id="vFont" /></label><input type="range" id="sFont" min={20} max={90} step={1} /></div>
          <div className="set"><label>Margens laterais <b id="vMargin" /></label><input type="range" id="sMargin" min={0} max={30} step={1} /></div>
          <div className="set"><label>Altura da linha <b id="vLine" /></label><input type="range" id="sLine" min={1.2} max={2.2} step={0.05} /></div>
          <div className="set"><label>Posição de leitura (altura) <b id="vRead" /></label><input type="range" id="sRead" min={12} max={50} step={1} /></div>
          <div className="set"><label>Fonte</label>
            <select id="sFontFam" defaultValue={DEF.fontFam}>
              <option value="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">Padrão (Sans)</option>
              <option value="Georgia,'Times New Roman',serif">Serif</option>
              <option value="'Courier New',monospace">Monoespaçada</option>
              <option value="'Arial Black',Arial,sans-serif">Arial Black</option>
              <option value="Verdana,sans-serif">Verdana</option>
            </select>
          </div>
        </div>

        <div className="sgCard">
          <div className="sgHead"><span className="sgChip cYellow"><i data-lucide="gauge" /></span><p className="sgTitle">Ritmo</p></div>
          <div className="set"><label>Velocidade (rolagem) <b id="vSpeed" /></label><input type="range" id="sSpeed" min={10} max={200} step={1} /></div>
          <div className="switchrow">Usar palavras/minuto<label className="sw"><input type="checkbox" id="sUseWpm" /><i /></label></div>
          <div className="set"><label>Palavras por minuto <b id="vWpm" /></label><input type="range" id="sWpm" min={80} max={220} step={5} /></div>
          <div className="set"><label>Contagem regressiva <b id="vCount" /></label><input type="range" id="sCount" min={0} max={10} step={1} /></div>
        </div>

        <div className="sgCard">
          <div className="sgHead"><span className="sgChip cBlue"><i data-lucide="crop" /></span><p className="sgTitle">Enquadramento</p></div>
          <div className="switchrow">Modo Reels/Shorts 9:16<label className="sw"><input type="checkbox" id="sReels" /><i /></label></div>
          <div className="switchrow">Espelhar horizontal (vidro)<label className="sw"><input type="checkbox" id="sMirX" /><i /></label></div>
          <div className="switchrow">Espelhar vertical<label className="sw"><input type="checkbox" id="sMirY" /><i /></label></div>
          <div className="switchrow">Seta guia<label className="sw"><input type="checkbox" id="sGuide" defaultChecked /><i /></label></div>
        </div>

        <div className="sgCard">
          <div className="sgHead"><span className="sgChip cPink"><i data-lucide="gallery-thumbnails" /></span><p className="sgTitle">Modo card (estilo CapCut)</p></div>
          <div className="switchrow">Ativar modo card<label className="sw"><input type="checkbox" id="sCardOn" /><i /></label></div>
          <div className="set"><label>Posição do card</label>
            <select id="sCardPos" defaultValue="top"><option value="top">Em cima</option><option value="center">Centro</option><option value="bottom">Embaixo</option></select>
          </div>
          <div className="set"><label>Altura do card <b id="vCardH" /></label><input type="range" id="sCardH" min={15} max={70} step={1} /></div>
          <div className="set"><label>Largura do card <b id="vCardW" /></label><input type="range" id="sCardW" min={50} max={100} step={1} /></div>
          <div className="set"><label>Cor do texto no card</label>
            <select id="sCardColor" defaultValue="preto"><option value="preto">Preto</option><option value="branco">Branco</option></select>
          </div>
        </div>

        <div className="sgCard">
          <div className="sgHead"><span className="sgChip cGreen"><i data-lucide="camera" /></span><p className="sgTitle">Câmera</p></div>
          <div className="set"><label>Qual câmera</label>
            <select id="sCamFace" defaultValue="user">
              <option value="user">Frontal</option>
              <option value="environment">Traseira</option>
            </select>
          </div>
          <div className="set"><label>Qualidade</label>
            <select id="sCamRes" defaultValue="1920x1080">
              <option value="max">⚡ Máxima do aparelho</option>
              <option value="1280x720">HD 720p</option>
              <option value="1920x1080">Full HD 1080p</option>
              <option value="3840x2160">4K</option>
            </select>
          </div>
          <div className="set"><label>Quadros por segundo</label>
            <select id="sFps" defaultValue="30">
              <option value="30">30 fps</option>
              <option value="60">60 fps (se suportado)</option>
            </select>
          </div>
          <div className="switchrow">Gravar como no espelho (frontal)<label className="sw"><input type="checkbox" id="sFixMirror" defaultChecked /><i /></label></div>
        </div>

        <div className="sgCard">
          <div className="sgHead"><span className="sgChip"><i data-lucide="mic" /></span><p className="sgTitle">Áudio</p></div>
          <div className="set"><label>Microfone</label>
            <select id="sMicDevice" defaultValue="">
              <option value="">Padrão do sistema</option>
            </select>
          </div>
          <p className="sgSub" style={{ margin: "2px 4px 8px" }}>No iPhone o sistema escolhe a entrada sozinho: conecte por USB-C ou Bluetooth e ele assume. USB-C tem a melhor qualidade.</p>
        </div>

        <button className="iconbtn" id="closeSettings" style={{ width: "100%", marginTop: 16 }}>Fechar</button>
      </div>

      {/* Vídeo pronto */}
      <div id="saveSheet" className="cSheet">
        <div className="cSheetCard">
          <h3>Vídeo pronto 🎬</h3>
          <p id="ssMeta" />
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video id="ssVideo" controls playsInline preload="metadata" />
          <p className="ssHint" id="ssHint">Toca em <b>Salvar no celular</b> e escolhe <b>"Salvar Vídeo"</b> no menu que abrir: vai direto pra sua galeria.</p>
          <button className="ssBtn primary" id="ssShare">Salvar no celular</button>
          <button className="ssBtn" id="ssDownload">Baixar arquivo</button>
          <button className="ssBtn ghost" id="ssClose">Fechar e continuar gravando</button>
        </div>
      </div>

      {/* Permissões */}
      <div id="permSheet" className="cSheet">
        <div className="cSheetCard">
          <span className="permIcon"><i data-lucide="camera" /></span>
          <h3 id="permTitle">Liberar câmera e microfone</h3>
          <p id="permText" />
          <button className="ssBtn primary" id="permGo">Beleza, liberar acesso</button>
          <button className="ssBtn ghost" id="permClose">Agora não</button>
        </div>
      </div>

      {/* Rede de segurança: áudio não entrou */}
      <div id="micSheet" className="cSheet">
        <div className="cSheetCard">
          <span className="permIcon"><i data-lucide="mic" /></span>
          <h3>O áudio não está entrando</h3>
          <p id="micText" />
          <button className="ssBtn primary" id="micFix">Tentar de novo</button>
          <button className="ssBtn ghost" id="micKeep">Fechar</button>
        </div>
      </div>

      {/* iPhone: modo por voz não roda no Safari */}
      <div id="iosVoiceSheet" className="cSheet">
        <div className="cSheetCard">
          <span className="permIcon"><i data-lucide="mic" /></span>
          <h3>O modo por voz não roda no iPhone</h3>
          <p>Seguir o texto pela sua voz enquanto grava é uma limitação do Safari no iPhone. A sugestão do Cria é usar a Rolagem automática: o texto rola sozinho na velocidade que você ajusta. No Android e no computador o modo por voz funciona normalmente.</p>
          <button className="ssBtn primary" id="iosVoiceClose">Usar Rolagem</button>
          <button className="ssBtn ghost" id="iosVoiceSpeed">Ajustar velocidade</button>
        </div>
      </div>

      <div id="cprToast" />
    </div>
  );
}

/* Nunca re-renderizar: a engine imperativa é dona do DOM interno. */
export const PrompterPlayer = memo(PrompterPlayerInner, () => true);
export default PrompterPlayer;
