# autochrome

An MCP server that lets Claude Code drive the browser you already use on a Mac: list and open tabs, read a page, click, type and attach a local file. It talks to the browser through AppleScript (JXA), so there is no extension to install, no browser restart and no open port. Your logged-in sites, such as WhatsApp Web, work as they are.

Vivaldi comes first and is the one tested. Other Chromium browsers with AppleScript (Google Chrome, Brave, Microsoft Edge, Arc) use the same calls.

![Three steps: open a tab without taking the person's tab, read numbered elements and click or type by number, attach a file and stop before sending](assets/autochrome.svg)

> **Em português:** servidor MCP para o Claude Code mexer no navegador do Mac, a começar pelo Vivaldi: listar e abrir abas, ler a página, clicar, digitar e anexar arquivo. Usa AppleScript (JXA), sem extensão, sem reiniciar o navegador e sem porta aberta. Os sites já logados, como o WhatsApp Web, funcionam do jeito que estão. Nada é enviado sozinho: mandar é um clique que o agente precisa escolher.

## Install

```bash
git clone https://github.com/LimaJoota/autochrome
claude mcp add --scope user autochrome -- /usr/bin/python3 "$PWD/autochrome/autochrome.py"
```

Then, in the browser, turn on **Allow JavaScript from Apple Events** (Vivaldi: Settings, Privacy, Apple Events; Chrome: View, Developer). The first call makes macOS ask for the Automation permission for the app that runs Claude Code.

## What it needs

- macOS and a Chromium browser with AppleScript. Default: Vivaldi. Pick another with the `browser` argument or `AUTOCHROME_BROWSER`, using the app name (`Google Chrome`, `Brave Browser`, `Microsoft Edge`, `Arc`).
- Python 3.9 or newer. No packages.

## Tools

| Tool | What it does |
| --- | --- |
| `tabs` | Lists tabs: id, title, URL. `*` marks the active one. |
| `open` | Opens a URL in a new tab and returns its id. Leaves your tab in front unless `activate`. |
| `read` | Title, URL, visible text and numbered elements you can click or type into. File inputs show up even when hidden. |
| `click` | Clicks by number from `read` or by CSS selector. |
| `type` | Types into an input, textarea or editable field. `clear` and `enter` are optional. |
| `attach` | Puts a local file into a file input, drops it on a drop area, or pastes it into a field (`paste`, used by WhatsApp Web). |
| `js` | Runs JavaScript in the tab (async function body: `return`, and `await` if needed). |
| `close` | Closes a tab by id. |

Every tool takes `browser` and `show`. Without MCP: `python3 autochrome.py call read '{"tab_id":"123"}'`.

## Hidden or visible

- **Hidden** (default): work happens in a background tab. The browser stays behind; if it jumps to the front anyway, autochrome hands the front back to the app you were in, so your typing does not land in the address bar.
- **Visible** (`show: true`): the tab comes to the front and a drawn pointer glides to each element before the click or the typing. Your real mouse is never moved.

Pick per task with `show`, or set the default in the panel.

## Panel

autochrome puts an icon in the menu bar (a slashed cursor while stopped). Click it to open a small floating window below it; visible mode and `python3 autochrome.py panel` open it too. `python3 autochrome.py barra` keeps the icon there at every login, and **Remove from menu bar** in the window takes it away. The window shows every action as it happens and holds the limits:

- **Stop / Resume**: every call is refused until you resume.
- **Hidden / Visible**: the default mode.
- **Read only**: no click, type, attach or `js`.
- **Allowed sites**: actions only on these domains (empty means all).

The panel does not take the keyboard and opens no network port. It reads and writes files in `~/Library/Application Support/autochrome` (folder mode 700). It guards against mistakes; it is not a sandbox, because any program with shell access can edit those files.

## Safety

- `open` never opens a tab while you are using the browser: it waits up to 10 s for you to switch apps, then gives up, so a new tab never catches your typing.
- While **Allow JavaScript from Apple Events** is on, any program on this Mac with the Automation permission for the browser can run JavaScript in your tabs, logged-in sites included. Turn it off when you do not need it.
- `read` brings the page text into the conversation, private messages included. Point it at the tab you mean.
- Nothing sends by itself. Sending a message is a separate click on the send button.
- `click`, `type`, `attach` and `js` need a `tab_id`, so they never act on the tab you happen to be looking at.
- `attach` refuses keys and credentials (`~/.ssh`, `.env`, `*.pem`, keychains and similar).
- `read` marks page text as data, not instructions. The log keeps no page text and masks anything typed that looks like a key.
- `close` closes whatever tab id you give it. Tab ids come from `tabs` or `open`.
- A call to a browser that is not running opens it.

## Limits

- The script runs in its own JavaScript world: it sees the page's DOM, not the page's variables.
- Clicks and keys are synthetic events. Most sites accept them; a page that checks `isTrusted` will not react. The native file dialog never opens; `attach` sets the file directly.
- A hibernated tab does not answer. Open it first.
- Safari and Firefox are not supported yet: Safari has a different AppleScript dictionary, Firefox has none.

## Test

```bash
python3 teste/teste.py
```

Checks the panel limits without a browser, then opens a local page in a background tab, clicks, types, attaches a 1.2 MB file (file input and paste), checks it byte for byte and closes the tab.

## Status

Tested end to end on Vivaldi 8.3 on macOS with the local test page. Chrome, Brave, Edge and Arc not run yet. Not yet run on WhatsApp Web.

Not affiliated with Google or Vivaldi Technologies. Chrome and Vivaldi are their trademarks.

## License

MIT
