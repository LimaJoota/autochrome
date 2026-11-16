// autochrome na barra de menus, no modelo do Escrevoz: menu nativo com o estado, as últimas ações e os atalhos;
// os ajustes ficam na janela Configurações…, aberta só a pedido.
// Sem porta de rede: a janela fala com este script só pelo título (comandos) e por evaluateJavaScript (estado).
// Uso: osascript -l JavaScript panel.js <pasta de estado> <panel.html> [mostrar] [teste]
ObjC.import('Cocoa');
ObjC.import('WebKit');
ObjC.import('stdlib');
let ALVO, MENU, TIMER;  // referências fortes: o AppKit só guarda fracas

function run(argv) {
  const D = argv[0], HTML = argv[1], MOSTRAR = argv.includes('mostrar'), TESTE = argv.includes('teste'), UTF8 = 4;
  const VERSAO = '1.4.0', NAVS = ['Vivaldi', 'Google Chrome', 'Brave Browser', 'Microsoft Edge', 'Arc'];
  const fm = $.NSFileManager.defaultManager;
  const rd = p => { const s = $.NSString.stringWithContentsOfFileEncodingError(p, UTF8, null); return s.isNil() ? '' : s.js; };
  const wr = (p, t) => $(t).writeToFileAtomicallyEncodingError(p, true, UTF8, null);
  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(D, true, $({NSFilePosixPermissions: 448}), null);
  const EU = String($.NSProcessInfo.processInfo.processIdentifier), PID = D + '/panel.pid';
  const vivo = n => { const t = $.NSTask.launchedTaskWithLaunchPathArguments('/bin/kill', ['-0', n]); t.waitUntilExit; return t.terminationStatus === 0; };
  if (!TESTE) {  // um ícone só na barra: se outro painel está vivo, passa o pedido a ele e sai
    const outro = rd(PID).trim();
    if (/^\d+$/.test(outro) && outro !== EU && vivo(outro)) { if (MOSTRAR) wr(D + '/panel.show', ''); return; }
    wr(PID, EU);
  }
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy(1);  // accessory: sem ícone no Dock

  // Estado: só estas chaves, com estes tipos; o resto que vier da janela é ignorado.
  const ctl = () => { let o = {}; try { o = JSON.parse(rd(D + '/control.json')) || {}; } catch (e) {} return o; };
  const grava = o => {
    const sites = (Array.isArray(o.sites) ? o.sites : []).filter(s => typeof s === 'string' && /^[a-z0-9.-]{1,253}$/.test(s));
    wr(D + '/control.json', JSON.stringify({stopped: o.stopped === true, show: o.show === true, read_only: o.read_only === true,
      sites: sites.slice(0, 50), browser: NAVS.includes(o.browser) ? o.browser : ''}));
  };
  const muda = k => grava(Object.assign(ctl(), k));
  const acoes = n => rd(D + '/log.jsonl').trim().split('\n').filter(Boolean).slice(-n).reverse()
    .map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const hm = t => { const d = new Date(t * 1000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  // Janela Configurações…: comum, aberta só a pedido; fechar devolve o teclado ao app de antes.
  const W = 440, H = 600;
  const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer($.NSMakeRect(0, 0, W, H), 1 | 2 | 4, 2, false);
  win.title = 'autochrome';
  win.releasedWhenClosed = false;
  win.collectionBehavior = 2 | 256;  // vem para o espaço atual, inclusive sobre app em tela cheia
  const wv = $.WKWebView.alloc.initWithFrameConfiguration(win.contentView.bounds, $.WKWebViewConfiguration.alloc.init);
  wv.autoresizingMask = 2 | 16;
  win.contentView.addSubview(wv);
  wv.loadHTMLStringBaseURL($(rd(HTML)), $.NSURL.URLWithString('about:blank'));
  let last = '';
  const render = () => {
    if (!win.isVisible || wv.loading) return;
    const s = JSON.stringify({c: rd(D + '/control.json'), l: rd(D + '/log.jsonl').trim().split('\n').slice(-40), v: VERSAO});
    if (s !== last) { last = s; wv.evaluateJavaScriptCompletionHandler('render(' + s + ')', () => {}); }
  };
  const abrir = () => {
    if (TESTE) win.setFrameOrigin($.NSMakePoint(-9000, 0)); else win.center;
    win.makeKeyAndOrderFront(null);
    if (!TESTE) { app.unhide(null); app.activateIgnoringOtherApps(true); }  // ele pediu a janela: ela pode receber o teclado
    last = ''; render();
  };
  const sair = () => {
    $.NSStatusBar.systemStatusBar.removeStatusItem(sb);
    if (rd(PID).trim() === EU) fm.removeItemAtPathError(PID, null);  // só apaga o registro se for o dele
    $.exit(0);
  };

  // Menu nativo: refeito a cada abertura (menuNeedsUpdate:).
  const item = (menu, titulo, tag, extra) => {
    const i = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent(titulo, tag ? 'acao:' : null, (extra && extra.atalho) || '');
    if (tag) { i.target = ALVO; i.tag = tag; }
    i.enabled = !!tag || !!(extra && extra.texto);
    if (extra && extra.on) i.state = 1;
    menu.addItem(i);
    return i;
  };
  const sep = m => m.addItem($.NSMenuItem.separatorItem);
  const monta = () => {
    const c = ctl(), nav = c.browser || 'Vivaldi';
    MENU.removeAllItems;
    item(MENU, 'autochrome v' + VERSAO);
    sep(MENU);
    item(MENU, c.stopped ? 'Retomar o autochrome' : 'Parar o autochrome', 1);
    sep(MENU);
    item(MENU, 'Últimas ações');
    const ult = acoes(8);
    if (!ult.length) item(MENU, 'Nenhuma ação ainda');
    const corta = t => t.length > 72 ? t.slice(0, 71) + '…' : t;
    for (const e of ult) {  // "12:21 Painel: tentou abrir Favoritos" e, embaixo, o motivo da falha
      const quem = (e.chat || '').split(' — ')[0];
      const txt = e.frase ? (quem ? quem + ': ' : '') + e.frase : e.tool + ' ' + [e.site, e.alvo].filter(Boolean).join(' · ');
      const it = item(MENU, (e.ok ? '' : '⚠︎ ') + corta(hm(e.t) + '  ' + txt), 0, {texto: true});
      if (e.chat) it.toolTip = e.chat;
      if (!e.ok && e.motivo) item(MENU, corta(e.motivo), 0, {texto: true}).indentationLevel = 3;
    }
    sep(MENU);
    const modo = item(MENU, 'Modo (' + (c.show ? 'Visível' : 'Escondido') + ')', 0, {texto: true});
    modo.submenu = $.NSMenu.alloc.init;
    item(modo.submenu, 'Escondido', 2, {on: !c.show});
    item(modo.submenu, 'Visível', 3, {on: c.show === true});
    const navs = item(MENU, 'Navegador (' + nav + ')', 0, {texto: true});
    navs.submenu = $.NSMenu.alloc.init;
    NAVS.forEach((n, k) => item(navs.submenu, n, 10 + k, {on: n === nav}));
    item(MENU, 'Só leitura', 4, {on: c.read_only === true});
    sep(MENU);
    item(MENU, 'Configurações…', 5, {atalho: ','});
    sep(MENU);
    item(MENU, 'Sair', 6, {atalho: 'q'});
  };
  const acao = tag => {
    const c = ctl();
    if (tag === 1) muda({stopped: !c.stopped});
    else if (tag === 2 || tag === 3) muda({show: tag === 3});
    else if (tag === 4) muda({read_only: !c.read_only});
    else if (tag === 5) abrir();
    else if (tag === 6) sair();
    else if (tag >= 10) muda({browser: NAVS[tag - 10]});
  };
  ObjC.registerSubclass({name: 'ACAlvo', protocols: ['NSMenuDelegate', 'NSWindowDelegate'], methods: {
    'acao:': {types: ['void', ['id']], implementation: i => acao(Number(i.tag))},  // a ponte do JXA entrega o tag como texto,
    'menuNeedsUpdate:': {types: ['void', ['id']], implementation: () => monta()},
    'windowWillClose:': {types: ['void', ['id']], implementation: () => { if (!TESTE) app.hide(null); }},
  }});
  ALVO = $.ACAlvo.alloc.init;
  MENU = $.NSMenu.alloc.init;
  MENU.autoenablesItems = false;
  MENU.delegate = ALVO;
  win.delegate = ALVO;
  const sb = $.NSStatusBar.systemStatusBar.statusItemWithLength(-1);
  const icone = n => { const i = $.NSImage.imageWithSystemSymbolNameAccessibilityDescription(n, 'autochrome'); i.template = true; return i; };
  sb.button.toolTip = 'autochrome';
  sb.menu = MENU;

  // Ícone: cursor riscado se parado, cursor clicando logo depois de uma ação, cursor normal no resto.
  let seq = 0, simbolo = '';
  const t0 = Date.now(), feito = new Set(), saida = [];
  // clica no item como o usuário: pelo target/action do menu (ou submenu), não chamando acao() direto
  const clica = t => { monta(); for (let k = 0; k < MENU.numberOfItems; k++) { const it = MENU.itemAtIndex(k), sub = it.submenu;
    const m = it.title.js === t ? MENU : !sub.isNil() && sub.indexOfItemWithTitle(t) >= 0 ? sub : null;
    if (m) return m.performActionForItemAtIndex(m.indexOfItemWithTitle(t)); } };
  const passo = (ms, f) => { if (TESTE && Date.now() - t0 > ms && !feito.has(ms)) { feito.add(ms); f(); } };
  const tick = () => {
    const t = wv.title.isNil() ? '' : wv.title.js;
    const m = /^c:(\d+):([\s\S]*)$/.exec(t);
    if (m && +m[1] > seq) { seq = +m[1]; try { grava(JSON.parse(m[2])); } catch (e) {} last = ''; }
    if (fm.fileExistsAtPath(D + '/panel.show')) { fm.removeItemAtPathError(D + '/panel.show', null); abrir(); }
    const a = fm.attributesOfItemAtPathError(D + '/log.jsonl', null);
    const recente = !a.isNil() && a.fileModificationDate.timeIntervalSinceNow > -2;
    const s = ctl().stopped === true ? 'cursorarrow.slash' : recente ? 'cursorarrow.click.2' : 'cursorarrow.rays';
    if (s !== simbolo) { simbolo = s; sb.button.image = icone(s); }
    render();
    // teste: fora da tela, sem tomar o teclado
    passo(400, () => { clica('Parar o autochrome'); saida.push('parado ' + (ctl().stopped === true)); });
    passo(700, () => { monta(); saida.push('menu ' + MENU.numberOfItems + ' itens, 1º ' + MENU.itemAtIndex(2).title.js); });
    passo(900, () => { clica('Configurações…'); saida.push('config ' + win.isVisible); });
    passo(2200, () => wv.evaluateJavaScriptCompletionHandler("document.getElementById('ro').click()", () => {}));
    passo(2900, () => { clica('Visível'); clica('Google Chrome'); const c = ctl();
      saida.push('só leitura ' + (c.read_only === true) + ', visível ' + (c.show === true) + ', navegador ' + c.browser); });
    passo(3200, () => { win.close; saida.push('fechada ' + !win.isVisible); console.log(saida.join(' | ')); sair(); });
  };
  TIMER = $.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(0.25, true, tick);
  if (MOSTRAR) abrir();
  app.run;
}
