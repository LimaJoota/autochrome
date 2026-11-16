// Janela flutuante do autochrome: mostra o registro e grava os limites em control.json.
// Sem porta de rede: a página fala com este script só pelo título (comandos) e por evaluateJavaScript (estado).
// Painel que não ativa o app: fica por cima sem tirar o teclado de quem está digitando em outro lugar.
// Uso: osascript -l JavaScript panel.js <pasta de estado> <panel.html>
ObjC.import('Cocoa');
ObjC.import('WebKit');

function run(argv) {
  const D = argv[0], HTML = argv[1], TESTE = argv[2] === 'teste', UTF8 = 4;
  const fm = $.NSFileManager.defaultManager;
  const rd = p => { const s = $.NSString.stringWithContentsOfFileEncodingError(p, UTF8, null); return s.isNil() ? '' : s.js; };
  const wr = (p, t) => $(t).writeToFileAtomicallyEncodingError(p, true, UTF8, null);
  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(D, true, $({NSFilePosixPermissions: 448}), null);
  wr(D + '/panel.pid', String($.NSProcessInfo.processInfo.processIdentifier));

  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy(1);  // accessory: sem ícone no Dock
  app.finishLaunching;
  const vf = $.NSScreen.mainScreen.visibleFrame, W = 340, H = 520;
  // 1 titled | 2 closable | 8 resizable | 16 utility | 128 nonactivating
  const p = $.NSPanel.alloc.initWithContentRectStyleMaskBackingDefer(
    $.NSMakeRect(TESTE ? -9000 : vf.origin.x + vf.size.width - W - 12, vf.origin.y + 12, W, H), 1 | 2 | 8 | 16 | 128, 2, false);
  p.title = 'autochrome';
  p.level = 3;  // flutuante
  p.hidesOnDeactivate = false;
  p.releasedWhenClosed = false;
  const wv = $.WKWebView.alloc.initWithFrameConfiguration(p.contentView.bounds, $.WKWebViewConfiguration.alloc.init);
  wv.autoresizingMask = 2 | 16;
  p.contentView.addSubview(wv);
  wv.loadHTMLStringBaseURL($(rd(HTML)), $.NSURL.URLWithString('about:blank'));
  p.orderFrontRegardless;

  // Só aceita estas chaves, com estes tipos: o resto que vier da página é ignorado.
  const apply = txt => {
    let o; try { o = JSON.parse(txt); } catch (e) { return; }
    const sites = (Array.isArray(o.sites) ? o.sites : []).filter(s => typeof s === 'string' && /^[a-z0-9.-]{1,253}$/.test(s));
    wr(D + '/control.json', JSON.stringify({stopped: o.stopped === true, show: o.show === true,
      read_only: o.read_only === true, sites: sites.slice(0, 50)}));
  };

  let seq = 0, last = '', tick = 0;
  const t0 = Date.now();  // teste: fora da tela, clica em Parar e sai
  while (p.isVisible) {
    const ev = app.nextEventMatchingMaskUntilDateInModeDequeue(
      $.NSEventMaskAny, $.NSDate.dateWithTimeIntervalSinceNow(0.2), $.NSDefaultRunLoopMode, true);
    if (!ev.isNil()) app.sendEvent(ev);
    const t = wv.title.isNil() ? '' : wv.title.js;
    const m = /^c:(\d+):([\s\S]*)$/.exec(t);
    if (m && +m[1] > seq) { seq = +m[1]; apply(m[2]); last = ''; }
    if (TESTE && Date.now() - t0 > 2500 && seq === 0) wv.evaluateJavaScriptCompletionHandler("document.getElementById('stop').click()", () => {});
    if (TESTE && Date.now() - t0 > 5000) break;
    if (Date.now() - tick > 500) {
      tick = Date.now();
      const s = JSON.stringify({c: rd(D + '/control.json'), l: rd(D + '/log.jsonl').trim().split('\n').slice(-60)});
      if (s !== last) { last = s; wv.evaluateJavaScriptCompletionHandler('render(' + s + ')', () => {}); }
    }
  }
  wr(D + '/panel.closed', String(Date.now()));
  fm.removeItemAtPathError(D + '/panel.pid', null);
}
