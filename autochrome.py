#!/usr/bin/env python3
"""autochrome: servidor MCP (stdio) que controla o navegador do Mac por JXA (AppleScript em JavaScript).

Padrão: Vivaldi. Outros navegadores Chromium com AppleScript (Chrome, Brave, Edge, Arc) pelo
argumento `browser` ou pela variável AUTOCHROME_BROWSER.
Precisa de: macOS, "Permitir JavaScript de Apple Events" ligado no navegador e a
permissão de Automação (Ajustes > Privacidade > Automação) para o app que chama.
Sem dependências: só a biblioteca padrão do Python 3.9+.

Uso direto, sem MCP:  python3 autochrome.py call <ferramenta> '<json>'
"""
import base64
import json
import mimetypes
import os
import subprocess
import sys

DEFAULT_APP = os.environ.get("AUTOCHROME_BROWSER", "Vivaldi")
APP = DEFAULT_APP  # trocado a cada chamada pelo argumento `browser`
CHUNK = 512 * 1024  # base64 por chamada; múltiplo de 4 para cada pedaço decodificar sozinho

# Acha a aba pelo id; sem id, usa a aba ativa da janela da frente.
JXA_TAB = """
function tab(id){
  if(id==null) return v.windows[0].activeTab();
  for(const w of v.windows()) for(const t of w.tabs()) if(t.id()==id) return t;
  throw new Error("aba não encontrada: "+id);
}
"""

# Resolve o alvo na página: número = ref devolvida por `read`; texto = seletor CSS.
PAGE_EL = """
const el=(t)=>{const e=typeof t==='number'||/^\\d+$/.test(t)?document.querySelector('[data-vc="'+t+'"]'):document.querySelector(t);
  if(!e) throw new Error('elemento não encontrado: '+t+' (rode read de novo)'); return e;};
"""


def jxa(body):
    script = "function run(){const v=Application(%s);%s\n%s}" % (json.dumps(APP), JXA_TAB, body)
    r = subprocess.run(["osascript", "-l", "JavaScript"], input=script,
                       capture_output=True, text=True, timeout=90)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or "osascript falhou")
    return r.stdout.rstrip("\n")


def page(tab_id, body, **vals):
    """Roda `body` (corpo de função JS, com return) na aba. `vals` viram constantes JS."""
    consts = "".join("const %s=%s;" % (k, json.dumps(v)) for k, v in vals.items())
    code = ("(()=>{try{%s%s return JSON.stringify({ok:(()=>{%s})()})}"
            "catch(e){return JSON.stringify({err:String(e)})}})()") % (PAGE_EL, consts, body)
    out = jxa("return String(tab(%s).execute({javascript:%s}));" % (json.dumps(tab_id), json.dumps(code)))
    if out in ("", "undefined", "missing value"):
        raise RuntimeError("a aba não devolveu resultado (aba hibernada ou página interna?)")
    res = json.loads(out)
    if "err" in res:
        raise RuntimeError(res["err"])
    return res.get("ok")


# ---- ferramentas ----

def tabs():
    return jxa("""const o=[];v.windows().forEach((w,i)=>{const a=w.activeTab().id();
      w.tabs().forEach(t=>o.push((t.id()==a?'* ':'  ')+t.id()+'  '+t.title()+'  '+t.url()));});
      return o.join('\\n');""")


def open_(url, activate=False):
    return jxa("""let w=v.windows()[0]; if(!w){v.Window().make(); w=v.windows()[0];}
      const ids=()=>w.tabs().map(t=>t.id()), before=new Set(ids()), act=w.activeTab().id();
      w.tabs.push(v.Tab({url:%s}));
      // O Vivaldi põe a aba nova ao lado da ativa, não no fim: acha pela diferença de ids.
      let novos=[]; for(let i=0;i<20&&!novos.length;i++){novos=ids().filter(x=>!before.has(x)); if(!novos.length) delay(0.1);}
      if(novos.length!==1) throw new Error("não achei a aba nova com segurança ("+novos.length+" ids novos)");
      const t=tab(novos[0]);
      for(let i=0;i<80&&t.loading();i++) delay(0.25);
      if(!%s) w.activeTabIndex=ids().indexOf(act)+1;
      return t.id();""" % (json.dumps(url), "true" if activate else "false"))


def read(tab_id=None, max_elements=150, max_text=6000):
    return page(tab_id, r"""
      const S='a[href],button,input,textarea,select,[role=button],[role=link],[role=menuitem],[role=tab],'+
        '[role=checkbox],[role=option],[role=textbox],[contenteditable=true],[contenteditable=""],[onclick]';
      let n=window.__vcN||0; const out=[];
      for(const e of document.querySelectorAll(S)){
        const file=e.type==='file', r=e.getBoundingClientRect();
        if(!file&&(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')) continue;
        if(!e.dataset.vc) e.dataset.vc=++n;
        const val=e.type==='password'?'':(e.value||'');
        const lab=(e.getAttribute('aria-label')||e.title||e.innerText||val||e.placeholder||e.name||
          (e.querySelector&&e.querySelector('[data-icon]')||{dataset:{}}).dataset.icon||'').trim().replace(/\s+/g,' ').slice(0,80);
        const kind=e.tagName.toLowerCase()+(e.type&&e.tagName!=='BUTTON'?'['+e.type+']':'')+
          (e.getAttribute('role')?'(role='+e.getAttribute('role')+')':'')+(e.isContentEditable?'(editável)':'')+
          (file?'(accept='+(e.accept||'*')+')':'');
        out.push(e.dataset.vc+' '+kind+' '+JSON.stringify(lab));
        if(out.length>=MAXE) break;
      }
      window.__vcN=n;
      return {title:document.title,url:location.href,elements:out,text:document.body.innerText.slice(0,MAXT)};
    """, MAXE=max_elements, MAXT=max_text)


def click(target, tab_id=None):
    return page(tab_id, """
      const e=el(T); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect();
      const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0};
      for(const t of ['pointerdown','mousedown','pointerup','mouseup'])
        e.dispatchEvent(new (t[0]==='p'?PointerEvent:MouseEvent)(t,o));
      if(e.click) e.click(); else e.dispatchEvent(new MouseEvent('click',o));
      return 'clicado';""", T=target)


def type_(target, text, tab_id=None, clear=False, enter=False):
    return page(tab_id, """
      const e=el(T); e.focus();
      if(e.isContentEditable){
        if(C){document.execCommand('selectAll');document.execCommand('delete');}
        document.execCommand('insertText',false,X);
      }else{
        const set=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set;
        set.call(e,(C?'':e.value)+X);
        e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(N) for(const t of ['keydown','keypress','keyup'])
        e.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
      return 'digitado';""", T=target, X=text, C=clear, N=enter)


def attach(path, target="input[type=file]", tab_id=None):
    path = os.path.expanduser(path)
    data = base64.b64encode(open(path, "rb").read()).decode()
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    page(tab_id, "window.__vcUp=[];return 0;")
    for i in range(0, len(data), CHUNK):
        page(tab_id, "window.__vcUp.push(B);return 0;", B=data[i:i + CHUNK])
    return page(tab_id, """
      const e=el(T), parts=(window.__vcUp||[]).map(b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
      delete window.__vcUp;
      const f=new File(parts,NAME,{type:MIME}), dt=new DataTransfer(); dt.items.add(f);
      if(e.type==='file'){
        e.files=dt.files; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));
      }else for(const t of ['dragenter','dragover','drop'])  // área de soltar arquivo
        e.dispatchEvent(new DragEvent(t,{bubbles:true,cancelable:true,dataTransfer:dt}));
      return {anexado:f.name,bytes:f.size,tipo:f.type};""",
        T=target, NAME=os.path.basename(path), MIME=mime)


def js(code, tab_id=None):
    return page(tab_id, code)


def close(tab_id):
    return jxa("tab(%s).close(); return 'fechada';" % json.dumps(tab_id))


TAB = {"tab_id": {"type": "string", "description": "id da aba (de `tabs` ou `open`); sem ele, a aba ativa"}}
TARGET = {"target": {"type": "string", "description": "número ref de `read` ou seletor CSS"}}


BROWSER = {"type": "string", "description": "app do navegador: Vivaldi (padrão), Google Chrome, Brave Browser, Microsoft Edge, Arc"}


def tool(name, fn, desc, props=None, required=()):
    return name, fn, {"name": name, "description": desc, "inputSchema": {
        "type": "object", "properties": dict(props or {}, browser=BROWSER), "required": list(required)}}


SPEC = [
    tool("tabs", tabs, "Lista as abas do navegador: id, título e URL (* = ativa)."),
    tool("open", open_, "Abre uma URL numa aba nova e devolve o id. Por padrão não troca a aba "
         "que o usuário está vendo.", {"url": {"type": "string"}, "activate": {"type": "boolean"}}, ["url"]),
    tool("read", read, "Lê a página: título, URL, texto visível e elementos clicáveis/editáveis com número ref "
         "(inputs de arquivo aparecem mesmo escondidos).",
         dict(TAB, max_elements={"type": "integer"}, max_text={"type": "integer"})),
    tool("click", click, "Clica num elemento (ref de `read` ou seletor CSS).", dict(TAB, **TARGET), ["target"]),
    tool("type", type_, "Digita num input, textarea ou campo editável. clear apaga antes; enter aperta Enter.",
         dict(TAB, **TARGET, text={"type": "string"}, clear={"type": "boolean"}, enter={"type": "boolean"}),
         ["target", "text"]),
    tool("attach", attach, "Anexa um arquivo local a um input[type=file] (padrão: o primeiro da página) "
         "ou solta numa área de arrastar.",
         dict(TAB, path={"type": "string", "description": "caminho do arquivo"},
              target={"type": "string", "description": "ref ou seletor; padrão input[type=file]"}), ["path"]),
    tool("js", js, "Roda JavaScript na aba. `code` é corpo de função: use return. Devolve o valor em JSON.",
         dict(TAB, code={"type": "string"}), ["code"]),
    tool("close", close, "Fecha uma aba pelo id.", TAB, ["tab_id"]),
]
HANDLERS = {n: f for n, f, _ in SPEC}


def call(name, args):
    global APP
    args = dict(args or {})
    APP = args.pop("browser", None) or DEFAULT_APP
    return HANDLERS[name](**args)


def send(msg):
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def serve():
    for line in sys.stdin:
        if not line.strip():
            continue
        msg = json.loads(line)
        mid, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}
        if mid is None:  # notificação
            continue
        if method == "initialize":
            res = {"protocolVersion": params.get("protocolVersion", "2024-11-05"), "capabilities": {"tools": {}},
                   "serverInfo": {"name": "autochrome", "version": "1.1.0"}}
        elif method == "tools/list":
            res = {"tools": [s for _, _, s in SPEC]}
        elif method == "tools/call":
            try:
                out = call(params["name"], params.get("arguments"))
                text = out if isinstance(out, str) else json.dumps(out, ensure_ascii=False, indent=1)
                res = {"content": [{"type": "text", "text": text}]}
            except Exception as e:  # erro da ferramenta volta ao modelo, o servidor segue vivo
                res = {"content": [{"type": "text", "text": "erro: %s" % e}], "isError": True}
        elif method == "ping":
            res = {}
        else:
            send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "método desconhecido"}})
            continue
        send({"jsonrpc": "2.0", "id": mid, "result": res})


if __name__ == "__main__":
    if sys.argv[1:2] == ["call"]:
        out = call(sys.argv[2], json.loads(sys.argv[3] if len(sys.argv) > 3 else "{}"))
        print(out if isinstance(out, str) else json.dumps(out, ensure_ascii=False, indent=1))
    else:
        serve()
