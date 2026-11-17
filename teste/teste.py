#!/usr/bin/env python3
"""Teste de ponta a ponta no Vivaldi aberto: abre a página local numa aba de fundo,
clica, digita, anexa um arquivo de 1,2 MB (input e paste) e fecha a aba. Antes, confere as travas
do painel sem navegador. Não manda nada a ninguém e não traz o navegador para a frente."""
import os
import pathlib
import sys
import tempfile
import time

AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))
import autochrome as v  # noqa: E402


def travas():
    """Limites do painel numa pasta temporária: parado, só leitura, sem tab_id, arquivo sensível, site fora."""
    v.D = tempfile.mkdtemp()
    def recusa(nome, args, ctl, trecho):
        try:
            v.guard(nome, args, dict(dict(stopped=False, show=False, read_only=False, sites=[]), **ctl))
        except RuntimeError as e:
            assert trecho in str(e), e
            return
        raise AssertionError("passou: %s %s" % (nome, ctl))
    recusa("tabs", {}, {"stopped": True}, "PARADO")
    recusa("click", {"tab_id": "1", "target": "1"}, {"read_only": True}, "só leitura")
    recusa("click", {"target": "1"}, {}, "tab_id")
    recusa("attach", {"tab_id": "1", "path": "~/.ssh/id_ed25519"}, {}, "sensível")
    recusa("open", {"url": "https://evil.example/x"}, {"sites": ["whatsapp.com"]}, "fora da lista")
    # ask: com key o aviso fica e a próxima chamada pega o botão; sem key ele sai no fim da espera
    assert v.ask("Pode?", wait=0, key="k1").startswith("sem resposta")
    assert v.ask("Pode?", wait=0, key="k1").startswith("sem resposta")  # não duplica o aviso
    assert sorted(os.listdir(os.path.join(v.D, "pedidos"))) == ["k1.json"]
    pathlib.Path(v.D, "pedidos", "k1.resposta").write_text("Agora não")
    assert v.ask("Pode?", wait=0, key="k1") == "Agora não" and not os.path.exists(os.path.join(v.D, "pedidos", "k1.resposta"))
    assert v.ask("Pode?", wait=0) == "sem resposta" and os.listdir(os.path.join(v.D, "pedidos")) == ["k1.json"]
    assert v.guard("open", {"url": "https://web.whatsapp.com/"}, dict(stopped=False, show=False, read_only=False,
                                                                     sites=["whatsapp.com"])) == "web.whatsapp.com"
    v.log("type", {"target": "#i", "text": "ghp_" + "x" * 30}, "a.com", True, "")
    assert "•••" in open(os.path.join(v.D, "log.jsonl")).read()  # texto com cara de chave não vai ao registro
    # registro em português: o que fez, onde e por que falhou, sem código
    v.APP = "Vivaldi"
    assert v.frase("open", {"url": "vivaldi://bookmarks/"}, "bookmarks", False, "") == "tentou abrir Favoritos"
    assert v.motivo("O usuário está usando o Vivaldi agora: não abri") == "você estava usando o Vivaldi"
    assert v.frase("js", {"code": "x()", "label": "agrupar as abas por site"}, "bookmarks", True, "") == \
        "mandou agrupar as abas por site · Favoritos"
    assert v.frase("js", {"code": "x()"}, "www.a.com", True, "") == "rodou um comando · a.com"
    assert v.frase("click", {}, "web.whatsapp.com", True, "clicado: Enviar") == "clicou em “Enviar” · web.whatsapp.com"
    assert "•••" in v.frase("type", {"text": "ghp_" + "x" * 30}, "a.com", True, "")
    print("ok: travas do painel e registro em português")


travas()
tab = v.open_((AQUI / "pagina.html").as_uri())
try:
    pag = v.read(tab)
    assert pag["title"] == "teste autochrome", pag
    refs = {linha.split(" ", 2)[2].strip('"'): linha.split(" ")[0] for linha in pag["elements"]}

    v.click(refs["clique aqui"], tab)
    assert v.js("return document.getElementById('b').textContent", tab) == "clicou"

    v.type_("#i", "Joaquim", tab)
    v.type_("#e", "texto livre", tab, enter=True)
    assert v.js("return [document.getElementById('i').value, document.getElementById('e').innerText.trim()]",
                tab) == ["Joaquim", "texto livre"]

    dados = os.urandom(1_200_000)  # passa de um pedaço de 512 KB em base64
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(dados)
    try:
        print(v.attach(f.name, tab_id=tab))
        for _ in range(20):
            # o JS do AppleScript vê o DOM, não as variáveis da página: lê o <pre id=r>
            res = v.js("const t=document.getElementById('r').textContent;return t?JSON.parse(t):null", tab)
            if res:
                break
            time.sleep(0.25)
        assert res == {"nome": os.path.basename(f.name), "bytes": len(dados), "soma": sum(dados) % 2**32}, res
        v.attach(f.name, "#e", tab, paste=True)  # WhatsApp Web: colar no campo de mensagem
        res = v.js("const t=document.getElementById('p').textContent;return t?JSON.parse(t):null", tab)
        assert res == {"nome": os.path.basename(f.name), "bytes": len(dados)}, res
    finally:
        os.unlink(f.name)
    assert v.js("await new Promise(r=>setTimeout(r,50)); return 2+2", tab) == 4  # js com await
    print("ok: abrir, ler, clicar, digitar, anexar (input e paste) e js com await")
finally:
    v.close(tab)
