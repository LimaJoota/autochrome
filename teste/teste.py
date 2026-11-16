#!/usr/bin/env python3
"""Teste de ponta a ponta no Vivaldi aberto: abre a página local numa aba de fundo,
clica, digita, anexa um arquivo de 1,2 MB e fecha a aba. Não manda nada a ninguém."""
import os
import pathlib
import sys
import tempfile
import time

AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))
import autochrome as v  # noqa: E402

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
    finally:
        os.unlink(f.name)
    print("ok: abrir, ler, clicar, digitar e anexar")
finally:
    v.close(tab)
