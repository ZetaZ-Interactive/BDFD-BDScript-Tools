# Introduction
Ever wanted to see all of your 428 errors in your BDScript code without running it?\
Well now you can with this extension

## Join Bot Designer for Discord Official Server

[![BDFD Server](https://discord.com/api/guilds/566363823137882154/embed.png?style=banner2)](https://discord.gg/bot-designer-for-discord-official-server-566363823137882154)

> [!WARNING]\
> This extension CANNOT be used to host your bot\
> This extension can only be used to improve your QoL and the development process

## Small Info on How to Use
To use this extension's features you have to use files with `.bds` extension\
You can also import your code highlight from BDFD app
> [!NOTE]\
> You can read more about code highlight in the [Change Code Highlight](#change-code-highlight) section

---

# Features
## Autocomplete
Every function has its own autocomplete with documentation\
Also every temporary variable, app variable, JSON key, component ID and async scope in the current file gets its own autocomplete too just like enum values which appear in the autocomplete whenever you need them
<details>
<summary>Click to show preview</summary>
<img src="https://raw.githubusercontent.com/ZetaZ-Interactive/BDFD-BDScript-Tools/main/assets/previews/autocomplete.png" width="448" height="356"/>
</details>

## Hover Info
When you hover over a function you get its documentation
<details>
<summary>Click to show preview</summary>
<img src="https://raw.githubusercontent.com/ZetaZ-Interactive/BDFD-BDScript-Tools/main/assets/previews/hover.png" width="537" height="357"/>
</details>

## Signature Help
Whenever you're inside of a function you get information about the current function and argument which you are currently using
<details>
<summary>Click to show preview</summary>
<img src="https://raw.githubusercontent.com/ZetaZ-Interactive/BDFD-BDScript-Tools/main/assets/previews/signature.png" width="536" height="358"/>
</details>

## Diagnostic Collection
Possibly the most useful feature of this extension which allows you to find errors in the code before running it
<details>
<summary>Click to show preview</summary>
<img src="https://raw.githubusercontent.com/ZetaZ-Interactive/BDFD-BDScript-Tools/main/assets/previews/diagnostics.png" width="719" height="355"/>
</details>

## Color Provider
Small feature which gives you a preview for colors inside of arguments with 'Color' type for example in the first argument of $color[] function
## Go to Definition
Allows you to Ctrl+Click on variable name or async scope name to easily go to where it was declared
## Extension Directives
This is a unique feature which allows you to use comments (`$c[]`) in a new way basically it let's you tell the extension how it should behave\
For example when you'll include `$c[$bdsDiagnosticDisable]` in your code it will disable diagnostics collection in the current file
<details>
<summary>Click to show preview</summary>
<img src="https://raw.githubusercontent.com/ZetaZ-Interactive/BDFD-BDScript-Tools/main/assets/previews/directives.png" width="800" height="356"/>\
</details>

You can find a complete list of directives in the autocomplete when inside of comments with description about what they do
> [!NOTE]\
> This feature requires you to enable features for advanced users in settings\
> Every directive starts with the `$bds` prefix
## Autocomplete Insert Type
You can change what gets inserted when you use autocomplete on a function in settings:
- `fullSnippet` — inserts the function with all argument names as snippet placeholders (Used by the Web Editor)
- `emptySnippet` — inserts the function with empty snippet placeholders
- `fullTag` — inserts the full function tag as plain text (Used by the BDFD app)
- `tagStart` — inserts only the function name
- `emptyArg` — inserts the function with empty brackets and cursor inside
## Change Code Highlight
This extension allows you to easily import your code highlight directly from BDFD app\
Just follow the tutorial below
### Importing your highlight from BDFD App
To import your code highlight from BDFD app follow these steps:
1. Open BDFD app and go to Settings
2. Scroll down and click 'Change code highlighting setting'
3. Click 'Share theme'
4. Click 'Copy to clipboard'
5. Transfer the copied highlight to your PC (For example with Discord or Pastebin)
6. In VSCode go to Settings > Extensions > BDScript
7. Find 'Change Code Highlight' setting
8. Click 'Edit in settings.json'
9. Replace the entire value of "bdscript.changeCodeHighlight" with your highlight
10. Save changes with `Ctrl+S` and you're done

---

### Defining your number highlight
This extension also allows you to change number highlight but it's not so straightforward as importing it from BDFD app\
Firstly add this `"numberHighlight":{"color":4291926630,"style":0}` to your highlight\
Then I recommend using [this tool](https://bdtools.netlify.app/highlighter) for simplicity
1. Copy your code highlight (it has to have "numberHighlight" property)
2. Click 'Import Theme'
3. Paste your highlight
4. Click 'Apply Theme'
5. Click the icon next to 'Numbers'
6. Change your number highlight based on your preferences
7. After you're done click 'Save'
8. Click 'Generate Code'
9. Click 'Copy'
10. Now follow steps 6-10 from [Importing your highlight from BDFD App](#importing-your-highlight-from-bdfd-app)
