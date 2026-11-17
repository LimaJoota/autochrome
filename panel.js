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
  const VERSAO = '1.5.0', NAVS = ['Vivaldi', 'Google Chrome', 'Brave Browser', 'Microsoft Edge', 'Arc'];
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
  const aparencia = c => { app.appearance = $.NSAppearance.appearanceNamed(c.tema === 'claro' ? 'NSAppearanceNameAqua' : 'NSAppearanceNameDarkAqua'); };

  // Estado: só estas chaves, com estes tipos; o resto que vier da janela é ignorado.
  const ctl = () => { let o = {}; try { o = JSON.parse(rd(D + '/control.json')) || {}; } catch (e) {} return o; };
  const grava = o => {
    const sites = (Array.isArray(o.sites) ? o.sites : []).filter(s => typeof s === 'string' && /^[a-z0-9.-]{1,253}$/.test(s));
    wr(D + '/control.json', JSON.stringify({stopped: o.stopped === true, show: o.show === true, read_only: o.read_only === true,
      sites: sites.slice(0, 50), browser: NAVS.includes(o.browser) ? o.browser : '',
      cor: o.cor === 'sistema' || /^#[0-9a-f]{6}$/i.test(o.cor || '') ? o.cor : '', posicao: o.posicao === 'baixo' ? 'baixo' : '',
      tema: o.tema === 'claro' ? 'claro' : ''}));
  };
  aparencia(ctl());  // escuro do Escrevoz, ou claro na opção Tema, seja qual for o tema do Mac
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

  // Pedidos (autochrome.py call ask): aviso no canto num painel que não ativa o app, então o teclado fica onde ele está.
  const PD = D + '/pedidos', PW = 320, VELHO = 6 * 3600;
  const pop = $.NSPanel.alloc.initWithContentRectStyleMaskBackingDefer($.NSMakeRect(0, 0, PW, 100), 1 | 16 | 128 | 32768, 2, false);
  pop.titlebarAppearsTransparent = true;
  pop.titleVisibility = 1;
  pop.standardWindowButton(0).hidden = true;  // sem fechar: a resposta é um dos botões
  pop.opaque = false;
  pop.backgroundColor = $.NSColor.clearColor;  // quem pinta é o cartão de cantos redondos
  pop.releasedWhenClosed = false;
  pop.floatingPanel = true;
  pop.hidesOnDeactivate = false;
  pop.becomesKeyOnlyIfNeeded = true;
  pop.collectionBehavior = 1 | 256;  // em todos os espaços, inclusive sobre app em tela cheia
  let atual = null;  // o aviso na tela: {id, options, total}
  const pedidos = () => {
    const out = [], agora = Date.now() / 1000;
    for (const n of ObjC.deepUnwrap(fm.contentsOfDirectoryAtPathError(PD, null)) || []) {
      if (!n.endsWith('.json')) continue;
      let o = null; try { o = JSON.parse(rd(PD + '/' + n)); } catch (e) {}
      if (!o || !Array.isArray(o.options) || !o.options.length || typeof o.t !== 'number') continue;
      if (agora - o.t > VELHO) { fm.removeItemAtPathError(PD + '/' + n, null); continue; }  // o chat que pediu já foi
      out.push(Object.assign(o, {id: n.slice(0, -5)}));
    }
    return out.sort((a, b) => a.t - b.t);
  };
  // Desenho do Escrevoz: cartão chapado com linha fina e cantos redondos; a cor só no ícone e, suave, no botão principal.
  // Escuro por padrão, claro na opção Tema (17/11/2026: "Deixa ele nas cores escuras do Escrevoz e possibilita... tema branco").
  const rgb = (h, a) => { const n = parseInt(h.slice(1), 16);
    return $.NSColor.colorWithSRGBRedGreenBlueAlpha((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a === undefined ? 1 : a); };
  const TEMAS = {escuro: {fundo: '#17191c', texto: '#f4f4f5', apagado: '#9a9ea6', laranja: '#ff6a33', suave: 0.18, lavado: 0.14},
                 claro: {fundo: '#ffffff', texto: '#15171a', apagado: '#6b6f76', laranja: '#ff5a1f', suave: 0.12, lavado: 0.12}};
  const cores = c => {
    const t = TEMAS[c.tema === 'claro' ? 'claro' : 'escuro'];
    const acc = c.cor === 'sistema' ? $.NSColor.controlAccentColor : rgb(/^#[0-9a-f]{6}$/i.test(c.cor || '') ? c.cor : t.laranja);
    return {t, acc, suave: acc.colorWithAlphaComponent(t.suave), lavado: rgb('#808080', t.lavado), linha: rgb('#808080', 0.22)};
  };
  const rotulo = (t, tam, cor, peso) => { const l = $.NSTextField.wrappingLabelWithString($(t));
    l.font = $.NSFont.systemFontOfSizeWeight(tam, peso || 0); l.textColor = cor; l.selectable = false; return l; };  // selecionável pegaria o teclado
  const caixa = (r, cor, raio, linha) => { const b = $.NSBox.alloc.initWithFrame(r);
    b.boxType = 4; b.titlePosition = 0; b.cornerRadius = raio; b.fillColor = cor;
    b.borderWidth = linha ? 1 : 0; if (linha) b.borderColor = linha; return b; };
  const botao = (v, t, k, x, fundo, tinta) => {  // NSBox pinta o fundo: a cor do NSButton some quando o app não está ativo
    const f = $.NSFont.systemFontOfSizeWeight(12.5, 0.23);
    const w = Math.max(Math.ceil($(t).sizeWithAttributes($({NSFont: f})).width) + 30, 72), r = $.NSMakeRect(x - w, 12, w, 26);
    const b = $.NSButton.buttonWithTitleTargetAction($(t), ALVO, 'responde:');
    b.bordered = false; b.tag = k; b.frame = r; b.font = f; b.contentTintColor = tinta;  // sem borda, a tinta vai para o texto
    v.addSubview(caixa(r, fundo, 13)); v.addSubview(b);
    return x - w - 6;
  };
  const mostra = (p, total, c) => {
    const k = cores(c), M = 16, txt = rotulo(String(p.text), 13, rgb(k.t.texto));
    const th = Math.ceil(txt.cell.cellSizeForBounds($.NSMakeRect(0, 0, PW - 2 * M, 2000)).height), H = th + 86;
    const v = $.NSView.alloc.initWithFrame($.NSMakeRect(0, 0, PW, H));
    v.addSubview(caixa($.NSMakeRect(0, 0, PW, H), rgb(k.t.fundo), 16, k.linha));  // o cartão: a janela por baixo é transparente
    const ic = $.NSImageView.imageViewWithImage($.NSImage.imageWithSystemSymbolNameAccessibilityDescription('cursorarrow.rays', 'autochrome'));
    ic.contentTintColor = k.acc; ic.frame = $.NSMakeRect(M, H - 30, 14, 14);
    v.addSubview(ic);
    const quem = rotulo(String(p.chat || 'autochrome'), 11.5, rgb(k.t.apagado), 0.23);
    quem.maximumNumberOfLines = 1; quem.lineBreakMode = 4; quem.frame = $.NSMakeRect(M + 20, H - 31, PW - 2 * M - 70, 16);
    v.addSubview(quem);
    if (total > 1) { const n = rotulo('1 de ' + total, 11.5, rgb(k.t.apagado)); n.alignment = 1; n.frame = $.NSMakeRect(PW - M - 50, H - 31, 50, 16); v.addSubview(n); }
    txt.frame = $.NSMakeRect(M, H - 40 - th, PW - 2 * M, th);
    v.addSubview(txt);
    let x = PW - M;
    p.options.slice(0, 3).forEach((o, n) => { x = botao(v, String(o), n, x, n ? k.lavado : k.suave, n ? rgb(k.t.texto) : k.acc); });
    pop.contentView = v;
    pop.setContentSize($.NSMakeSize(PW, H));
    pop.invalidateShadow;
    const vf = $.NSScreen.mainScreen.visibleFrame, px = vf.origin.x + vf.size.width - PW - 12;
    if (TESTE) pop.setFrameOrigin($.NSMakePoint(-9000, 0));
    else if (c.posicao === 'baixo') pop.setFrameOrigin($.NSMakePoint(px, vf.origin.y + 12));
    else pop.setFrameTopLeftPoint($.NSMakePoint(px, vf.origin.y + vf.size.height - 12));
    pop.orderFrontRegardless;  // aparece sem ativar o app
  };
  const exemplo = () => { fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(PD, true, $(), null);
    wr(PD + '/exemplo.json', JSON.stringify({chat: 'Configurações', options: ['Entendi'], t: Date.now() / 1000,
      text: 'Exemplo: é assim que os chats vão pedir o seu OK. O teclado continua no app em que você está.'})); };
  const responde = k => {
    const o = atual && atual.options[k];
    if (o === undefined) return;
    if (atual.id !== 'exemplo') wr(PD + '/' + atual.id + '.resposta', String(o));  // o exemplo não tem quem leia
    fm.removeItemAtPathError(PD + '/' + atual.id + '.json', null);
    atual = null;
    pop.orderOut(null);
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
    'acao:': {types: ['void', ['id']], implementation: i => acao(Number(i.tag))},
    'responde:': {types: ['void', ['id']], implementation: i => responde(Number(i.tag))},  // a ponte do JXA entrega o tag como texto,
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
  let seq = 0, simbolo = '', volta = 0, pendente = false, tema0 = ctl().tema || '';
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
    const ex = /^t:(\d+)$/.exec(t);
    if (ex && +ex[1] > seq) { seq = +ex[1]; exemplo(); }
    if (fm.fileExistsAtPath(D + '/panel.show')) { fm.removeItemAtPathError(D + '/panel.show', null); abrir(); }
    const a = fm.attributesOfItemAtPathError(D + '/log.jsonl', null);
    const recente = !a.isNil() && a.fileModificationDate.timeIntervalSinceNow > -2;
    if (volta++ % 4 === 0) {  // pedidos: uma olhada por segundo
      const l = pedidos(), c = ctl(), estilo = [c.cor, c.posicao, c.tema].join('|');
      if ((c.tema || '') !== tema0) { tema0 = c.tema || ''; aparencia(c); }  // muda também a janela Configurações
      pendente = l.length > 0;
      if (!pendente && atual) { atual = null; pop.orderOut(null); }
      else if (pendente && (!atual || atual.id !== l[0].id || atual.total !== l.length || atual.estilo !== estilo)) {
        atual = {id: l[0].id, options: l[0].options, total: l.length, estilo};
        mostra(l[0], l.length, c);
      }
    }
    const s = ctl().stopped === true ? 'cursorarrow.slash' : pendente ? 'questionmark.bubble' : recente ? 'cursorarrow.click.2' : 'cursorarrow.rays';
    if (s !== simbolo) { simbolo = s; sb.button.image = icone(s); }
    render();
    // teste: fora da tela, sem tomar o teclado
    passo(400, () => { clica('Parar o autochrome'); saida.push('parado ' + (ctl().stopped === true)); });
    passo(700, () => { monta(); saida.push('menu ' + MENU.numberOfItems + ' itens, 1º ' + MENU.itemAtIndex(2).title.js); });
    passo(900, () => { clica('Configurações…'); saida.push('config ' + win.isVisible); });
    passo(1000, () => { fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(PD, true, $(), null);
      wr(PD + '/t1.json', JSON.stringify({chat: 'Mac — organização', text: '3 abas novas desde as 10:00. Mover para a pilha Trabalho? Elas são do mesmo site.',
        options: ['Pode', 'Agora não'], t: Date.now() / 1000}));
      wr(PD + '/t2.json', JSON.stringify({chat: 'Site — desenvolvimento', text: 'Segundo pedido.', options: ['Ok'], t: Date.now() / 1000 + 1})); });
    passo(1700, () => { const v = pop.contentView, r = v.bitmapImageRepForCachingDisplayInRect(v.bounds);
      v.cacheDisplayInRectToBitmapImageRep(v.bounds, r); r.representationUsingTypeProperties(4, $()).writeToFileAtomically(D + '/aviso.png', true);
      saida.push('aviso ' + pop.isVisible + ', app ativo ' + app.isActive + ', ícone ' + simbolo);
      const sv = v.subviews; for (let k = 0; k < sv.count; k++) { const b = sv.objectAtIndex(k);
        if (b.isKindOfClass($.NSButton) && Number(b.tag) === 0) b.performClick(null); } });
    passo(1900, () => saida.push('resposta ' + rd(PD + '/t1.resposta')));
    passo(2500, () => { saida.push('resposta ' + rd(PD + '/t1.resposta') + ', pedido some ' + !fm.fileExistsAtPath(PD + '/t1.json') + ', segundo na tela ' + (pop.isVisible && atual && atual.id === 't2'));
      fm.removeItemAtPathError(PD + '/t2.json', null); });
    passo(2200, () => wv.evaluateJavaScriptCompletionHandler("document.getElementById('ro').click();" +
      "document.querySelector('#cor [data-c=sistema]').click(); document.querySelector('#pos [data-p=baixo]').click()", () => {}));
    passo(2900, () => { clica('Visível'); clica('Google Chrome'); const c = ctl();
      saida.push('só leitura ' + (c.read_only === true) + ', visível ' + (c.show === true) + ', navegador ' + c.browser + ', cor ' + c.cor + ', posição ' + c.posicao); });
    passo(3200, () => { win.close; saida.push('fechada ' + !win.isVisible); console.log(saida.join(' | ')); sair(); });
  };
  // erro no tick não pode congelar o ícone em silêncio; no teste, falha na hora
  TIMER = $.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(0.25, true, () => {
    try { tick(); } catch (e) { console.log('painel: ' + e + ' (linha ' + e.line + ')'); if (TESTE) $.exit(1); } });
  if (MOSTRAR) abrir();
  app.run;
}
