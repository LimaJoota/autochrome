// Ícone do autochrome na barra de menus: o clique abre logo abaixo a janela com o registro e os limites (control.json).
// Sem porta de rede: a página fala com este script só pelo título (comandos) e por evaluateJavaScript (estado).
// Painel que não ativa o app: fica por cima sem tirar o teclado de quem está digitando em outro lugar.
// Uso: osascript -l JavaScript panel.js <pasta de estado> <panel.html> [mostrar] [teste]
ObjC.import('Cocoa');
ObjC.import('WebKit');
let ALVO;  // alvo do clique no ícone: o botão guarda referência fraca, então fica vivo aqui

function run(argv) {
  const D = argv[0], HTML = argv[1], MOSTRAR = argv.includes('mostrar'), TESTE = argv.includes('teste'), UTF8 = 4;
  const fm = $.NSFileManager.defaultManager;
  const rd = p => { const s = $.NSString.stringWithContentsOfFileEncodingError(p, UTF8, null); return s.isNil() ? '' : s.js; };
  const wr = (p, t) => $(t).writeToFileAtomicallyEncodingError(p, true, UTF8, null);
  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(D, true, $({NSFilePosixPermissions: 448}), null);
  wr(D + '/panel.pid', String($.NSProcessInfo.processInfo.processIdentifier));

  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy(1);  // accessory: sem ícone no Dock
  app.finishLaunching;
  const W = 340, H = 520;
  // 1 titled | 2 closable | 8 resizable | 16 utility | 128 nonactivating
  const p = $.NSPanel.alloc.initWithContentRectStyleMaskBackingDefer($.NSMakeRect(0, 0, W, H), 1 | 2 | 8 | 16 | 128, 2, false);
  p.title = 'autochrome';
  p.level = 3;  // flutuante
  p.hidesOnDeactivate = false;
  p.releasedWhenClosed = false;
  const wv = $.WKWebView.alloc.initWithFrameConfiguration(p.contentView.bounds, $.WKWebViewConfiguration.alloc.init);
  wv.autoresizingMask = 2 | 16;
  p.contentView.addSubview(wv);
  wv.loadHTMLStringBaseURL($(rd(HTML)), $.NSURL.URLWithString('about:blank'));

  const sb = $.NSStatusBar.systemStatusBar.statusItemWithLength(-1);
  const icone = n => { const i = $.NSImage.imageWithSystemSymbolNameAccessibilityDescription(n, 'autochrome'); i.template = true; return i; };
  sb.button.image = icone('cursorarrow.rays');
  sb.button.toolTip = 'autochrome';
  const mostrar = () => {
    const f = sb.button.window.frame, vf = $.NSScreen.mainScreen.visibleFrame;
    const x = Math.max(vf.origin.x + 8, Math.min(f.origin.x + f.size.width / 2 - W / 2, vf.origin.x + vf.size.width - W - 8));
    p.setFrameOrigin(TESTE ? $.NSMakePoint(-9000, 0) : $.NSMakePoint(x, f.origin.y - H - 6));
    p.orderFrontRegardless;
  };
  const alternar = () => { if (p.isVisible) p.orderOut(null); else mostrar(); };
  ObjC.registerSubclass({name: 'ACAlvo', methods: {'alternar:': {types: ['void', ['id']], implementation: alternar}}});
  ALVO = $.ACAlvo.alloc.init;
  sb.button.target = ALVO;
  sb.button.action = 'alternar:';
  if (MOSTRAR) mostrar();

  // Só aceita estas chaves, com estes tipos: o resto que vier da página é ignorado.
  const apply = txt => {
    let o; try { o = JSON.parse(txt); } catch (e) { return; }
    const sites = (Array.isArray(o.sites) ? o.sites : []).filter(s => typeof s === 'string' && /^[a-z0-9.-]{1,253}$/.test(s));
    wr(D + '/control.json', JSON.stringify({stopped: o.stopped === true, show: o.show === true,
      read_only: o.read_only === true, sites: sites.slice(0, 50)}));
  };

  let seq = 0, last = '', tick = 0, parado = null, vis = p.isVisible;
  const t0 = Date.now(), feito = new Set(), saida = [];  // teste: fora da tela, abre pelo ícone, clica em Parar, fecha e sai
  const passo = (ms, f) => { if (TESTE && Date.now() - t0 > ms && !feito.has(ms)) { feito.add(ms); f(); } };
  while (true) {
    const ev = app.nextEventMatchingMaskUntilDateInModeDequeue(
      $.NSEventMaskAny, $.NSDate.dateWithTimeIntervalSinceNow(0.2), $.NSDefaultRunLoopMode, true);
    if (!ev.isNil()) app.sendEvent(ev);
    const t = wv.title.isNil() ? '' : wv.title.js;
    if (t.startsWith('q:')) break;  // "Tirar da barra"
    const m = /^c:(\d+):([\s\S]*)$/.exec(t);
    if (m && +m[1] > seq) { seq = +m[1]; apply(m[2]); last = ''; }
    if (fm.fileExistsAtPath(D + '/panel.show')) { fm.removeItemAtPathError(D + '/panel.show', null); mostrar(); }
    if (vis && !p.isVisible) wr(D + '/panel.closed', String(Date.now()));  // fechada por ele: o autochrome espera 15 min para abrir sozinho
    vis = p.isVisible;
    passo(1000, () => { alternar(); saida.push('aberta ' + p.isVisible); });
    passo(2500, () => wv.evaluateJavaScriptCompletionHandler("document.getElementById('stop').click()", () => {}));
    passo(3500, () => { alternar(); saida.push('fechada ' + !p.isVisible); });
    if (TESTE && Date.now() - t0 > 4500) break;
    if (Date.now() - tick > 500) {
      tick = Date.now();
      const c = rd(D + '/control.json'), st = /"stopped":\s*true/.test(c);
      if (st !== parado) { parado = st; sb.button.image = icone(st ? 'cursorarrow.slash' : 'cursorarrow.rays'); }
      const s = JSON.stringify({c: c, l: rd(D + '/log.jsonl').trim().split('\n').slice(-60)});
      if (s !== last) { last = s; wv.evaluateJavaScriptCompletionHandler('render(' + s + ')', () => {}); }
    }
  }
  $.NSStatusBar.systemStatusBar.removeStatusItem(sb);
  fm.removeItemAtPathError(D + '/panel.pid', null);
  return saida.join(', ');
}
