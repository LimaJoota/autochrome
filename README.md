# vivaldi-controle

An MCP server that lets Claude Code drive the Vivaldi you already use on a Mac: list and open tabs, read a page, click, type and attach a local file. It talks to Vivaldi through AppleScript (JXA), so there is no extension to install, no browser restart and no open port. Your logged-in sites, such as WhatsApp Web, work as they are.

![Three steps: open a tab without taking the person's tab, read numbered elements and click or type by number, attach a file and stop before sending](assets/vivaldi-controle.svg)

> **Em português:** servidor MCP para o Claude Code mexer no Vivaldi do Mac: listar e abrir abas, ler a página, clicar, digitar e anexar arquivo. Usa AppleScript (JXA), sem extensão, sem reiniciar o navegador e sem porta aberta. Os sites já logados, como o WhatsApp Web, funcionam do jeito que estão. Nada é enviado sozinho: mandar é um clique que o agente precisa escolher.

## Install

```bash
git clone https://github.com/LimaJoota/vivaldi-controle
claude mcp add --scope user vivaldi -- /usr/bin/python3 "$PWD/vivaldi-controle/vivaldi_mcp.py"
```

Then, in Vivaldi, turn on **Allow JavaScript from Apple Events** (Settings, Privacy, Apple Events). The first call makes macOS ask for the Automation permission for the app that runs Claude Code.

## What it needs

- macOS and Vivaldi (any Chromium build with AppleScript `execute javascript` should work; set `VIVALDI_APP`).
- Python 3.9 or newer. No packages.

## Tools

| Tool | What it does |
| --- | --- |
| `tabs` | Lists tabs: id, title, URL. `*` marks the active one. |
| `open` | Opens a URL in a new tab and returns its id. Leaves your tab in front unless `activate`. |
| `read` | Title, URL, visible text and numbered elements you can click or type into. File inputs show up even when hidden. |
| `click` | Clicks by number from `read` or by CSS selector. |
| `type` | Types into an input, textarea or editable field. `clear` and `enter` are optional. |
| `attach` | Puts a local file into a file input, or drops it on a drop area. |
| `js` | Runs JavaScript in the tab (function body, use `return`). |
| `close` | Closes a tab by id. |

Without MCP: `python3 vivaldi_mcp.py call read '{"tab_id":"123"}'`.

## Safety

- While **Allow JavaScript from Apple Events** is on, any program on this Mac with the Automation permission for Vivaldi can run JavaScript in your tabs, logged-in sites included. Turn it off when you do not need it.
- `read` brings the page text into the conversation, private messages included. Point it at the tab you mean.
- Nothing sends by itself. Sending a message is a separate click on the send button.
- `close` closes whatever tab id you give it. Tab ids come from `tabs` or `open`.

## Limits

- The script runs in its own JavaScript world: it sees the page's DOM, not the page's variables.
- Clicks and keys are synthetic events. Most sites accept them; a page that checks `isTrusted` will not react. The native file dialog never opens; `attach` sets the file directly.
- A hibernated tab does not answer. Open it first.

## Test

```bash
python3 teste/teste.py
```

Opens a local page in a background tab, clicks, types, attaches a 1.2 MB file, checks it byte for byte and closes the tab.

## Status

Tested end to end on Vivaldi 8.3 on macOS with the local test page. Not yet run on WhatsApp Web.

## License

MIT
