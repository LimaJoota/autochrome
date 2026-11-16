// Vigia do modo escondido: enquanto a ação roda e por 4 s depois (download, janela nova aberta pela página),
// se o navegador tomar a frente sem clique do usuário, devolve a frente ao app em que ele estava.
// Uso: osascript -l JavaScript vigia.js <app do navegador> <arquivo marca>. Apagar a marca encerra a vigia em 4 s.
ObjC.import('AppKit');
ObjC.import('CoreGraphics');
function run(a) {
  const NAV = a[0], M = a[1], WS = $.NSWorkspace.sharedWorkspace, fm = $.NSFileManager.defaultManager;
  const diz = t => $.NSFileHandle.fileHandleWithStandardOutput.writeData($(t + '\n').dataUsingEncoding(4));
  const nome = () => WS.frontmostApplication.localizedName.js;
  let prev = WS.frontmostApplication;
  if (prev.localizedName.js === NAV) { diz('-'); return; }  // ele está no navegador: não há o que devolver
  diz('ok');
  const clique = () => Math.min($.CGEventSourceSecondsSinceLastEventType(1, 1), $.CGEventSourceSecondsSinceLastEventType(1, 3)) < 0.6;
  const t0 = Date.now();
  let fim = 0;
  while (Date.now() - t0 < 90000 && !(fim && Date.now() > fim)) {
    if (!fim && !fm.fileExistsAtPath(M)) fim = Date.now() + 4000;
    if (nome() !== NAV) prev = WS.frontmostApplication;  // segue o app em que ele está agora
    else if (clique()) return;  // ele mesmo clicou no navegador: a frente é dele
    else { prev.activateWithOptions(2); delay(0.05); if (nome() === NAV) WS.frontmostApplication.hide; }
    delay(0.05);
  }
}
