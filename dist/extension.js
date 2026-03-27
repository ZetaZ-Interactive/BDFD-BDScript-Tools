import * as vscode from 'vscode';
import {
    functions,
    permissionList
} from './shared/sharedData.js';
import {
    parseVariables,
    buildFunctionSnippet
} from './completion/functions.js';
import {
    curArg,
    getActiveFunc
} from './signature/functions.js';
import {
    getCommentFlags,
    getDocumentFlags,
    argType,
    isEmptiable,
    isRequired,
    isRepeatable,
    enumValues
} from './shared/sharedFunctions.js';
import {
    bdscriptValidate
} from './diagnostic/functions.js';
import {
    updateCodeHighlight
} from './textmate/functions.js';
const cachedColors = new WeakMap();
const diagnosticDebounceMap = new Map();
export function activate(context) {
    updateCodeHighlight(vscode.workspace.getConfiguration('bdscript').get("changeCodeHighlight"));
    const flags = {
        "$bdsCompletionDisable": "Directive used to disable **Completion Provider** in the current file",
        "$bdsCompletionLineDisable": "Directive used to disable **Completion Provider** on the current line",
        "$bdsCompletionOnlyFunctions": "Directive used to disable **Completion Provider** for variables in the current file",
        "$bdsDiagnosticDisable": "Directive used to disable **Diagnostic Provider** in the current file",
        "$bdsDiagnosticDeprecatedDisable": "Directive used to disable warning about using deprecated functions in **Diagnostic Provider** in the current file",
        "$bdsDiagnosticInformationDisable": "Directive used to disable showing information severity in **Diagnostic Provider** in the current file",
        "$bdsDiagnosticLineDisable": "Directive used to disable **Diagnostic Provider** on the current line",
        "$bdsDiagnosticUseArguments": "Directive used to show argument name errors instead of argument position errors in **Diagnostic Provider** in the current file",
        "$bdsDiagnosticIgnoreNests": "Directive used to disable **Diagnostic Provider** for nested functions in the current file",
        "$bdsColorDisable": "Directive used to disable **Color Provider** in the current file",
        "$bdsColorLineDisable": "Directive used to disable **Color Provider** on the current line",
        "$bdsHoverDisable": "Directive used to disable **Hover Provider** in the current file",
        "$bdsHoverLineDisable": "Directive used to disable **Hover Provider** on the current line",
        "$bdsSignatureDisable": "Directive used to disable **Signature Help** in the current file",
        "$bdsSignatureLineDisable": "Directive used to disable **Signature Help** on the current line",
        "$bdsDefinitionDisable": "Directive used to disable **Definition Provider** in the current file",
    };
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'bdscript',
        {
            provideCompletionItems(document, position, token, context) {
                if(getDocumentFlags(document).includes("$bdsCompletionDisable")) return;
                if(getCommentFlags(document.lineAt(position.line).text).includes("$bdsCompletionLineDisable")) return;
                const charBefore = position.character > 0 ? document.getText(new vscode.Range(position.translate(0, -1), position)) : '';
                const dol = context.triggerCharacter === '$' || charBefore === '$';
                const d = dol?'':'$';
                const sd = dol ? '' : '\\\$'; // nwm czemu i jak ale to naprawia to co sie rozjebało kubusiowi w jego edytorze
                const insertType = vscode.workspace.getConfiguration('bdscript').get('autocompleteInsertType');
                const funcCompletion = functions.map(func => {
                    const item = new vscode.CompletionItem(func.tagStart, func.kind || vscode.CompletionItemKind.Function);
                    const hasArgs = func.arguments.length > 0;
                    switch (insertType) {
                        case 'fullSnippet':
                            item.insertText = hasArgs?new vscode.SnippetString(`${sd}${func.name}[${buildFunctionSnippet(func, false)}]$0`):`${d}${func.name}`;
                            break;
                        case 'emptySnippet':
                            item.insertText = hasArgs?new vscode.SnippetString(`${sd}${func.name}[${buildFunctionSnippet(func, true)}]$0`):`${d}${func.name}`;
                            break;
                        case 'fullTag':
                            item.insertText = `${d}${func.fullTag.replace('$', '')}`;
                            break;
                        case 'tagStart':
                            item.insertText = `${d}${func.name}`;
                            break;
                        case 'emptyArg':
                            item.insertText = new vscode.SnippetString(`${sd}${func.name}${hasArgs?'[$0]':'$0'}`);
                            break;
                        default:
                            item.insertText = hasArgs?new vscode.SnippetString(`${sd}${func.name}[${buildFunctionSnippet(func, false)}]$0`):`${d}${func.name}`;
                            break;
                    }
                    item.detail = func.fullTag;
                    item.documentation = func.completionDocs;
                    item.sortText = `bbb_${func.fullTag}`;
                    return item;
                });
                const line = document.lineAt(position.line).text;
                const cursor = position.character;
                const textBeforeCursor = line.slice(0, cursor);
                const activeFunction = getActiveFunc(textBeforeCursor);
                const activeFunc = activeFunction?functions.find(f => f.tagStart === activeFunction.funcName):null;
                const enumCompletion = [];
                if(activeFunc?.arguments?.length) {
                    const activeFuncArg = curArg(textBeforeCursor.slice(activeFunction.bracketIndex));
                    const argData = activeFunc.arguments[Math.min(activeFuncArg, activeFunc.arguments.length - 1)];
                    const enumData = argData?.enumData?.length?argData.enumData
                        :argData?.type?.includes('Permission')?permissionList
                            :null;
                    if(enumData) {
                        const isPermission = argData.type.includes('Permission');
                        enumData.forEach(enumValue => {
                            const item = new vscode.CompletionItem(enumValue, vscode.CompletionItemKind.Enum);
                            item.detail = isPermission?`Permission '${enumValue}'`:`Enum '${enumValue}'`;
                            item.documentation = new vscode.MarkdownString(`${isPermission?'Permission':'Enum value'} used by \`${argData.name}\` argument`);
                            item.sortText = `aaa_${isPermission?`Permission '${enumValue}'`:`Enum '${enumValue}'`}`;
                            enumCompletion.push(item);
                        });
                    }
                }
                const onlyFunctions = getDocumentFlags(document).includes("$bdsCompletionOnlyFunctions");
                const varCompletion = onlyFunctions?[]:parseVariables(document).map(vars => {
                    const item = new vscode.CompletionItem(vars.name, vars.kind);
                    item.insertText = vars.name;
                    item.detail = vars.detail;
                    item.documentation = vars.description;
                    item.sortText = `ccc_${vars.kind}_${vars.name}`;
                    return item;
                });
                const advanced = vscode.workspace.getConfiguration('bdscript').get('enableFeaturesForAdvancedUsers');
                const flagCompletion = [];
                if(advanced && textBeforeCursor.match(/\$c\[[^\]]*$/)) {
                    Object.entries(flags).forEach(([flag, desc]) => {
                        const item = new vscode.CompletionItem(flag, vscode.CompletionItemKind.Reference);
                        item.insertText = d + flag.slice(1);
                        item.detail = 'Extension Directive';
                        item.documentation = new vscode.MarkdownString(`${desc}\n\n\`${flag}\``);
                        item.sortText = `aaa_${d+flag.slice(1)}`;
                        flagCompletion.push(item);
                    });
                }
                return [...funcCompletion, ...varCompletion, ...enumCompletion, ...flagCompletion];
            }
        },
        '$'
    );
    context.subscriptions.push(completionProvider);
    const definitionProvider = vscode.languages.registerDefinitionProvider(
        'bdscript',
        {
            provideDefinition(document, position) {
                if(getDocumentFlags(document).includes("$bdsDefinitionDisable")) return;
                const text = document.getText();
                const offset = document.offsetAt(position);
                let start = offset;
                while(start > 0 && text[start] !== '[' && text[start] !== ']' && text[start] !== ';') start--;
                if(text[start] !== '[') return null;
                const beforeBracket = text.slice(Math.max(0, start - 4), start);
                const advanced = vscode.workspace.getConfiguration('bdscript').get('enableFeaturesForAdvancedUsers');
                const isVar = beforeBracket === '$var' || (advanced && (
                    text.slice(Math.max(0, start - 10), start).endsWith('$$c[]var') ||
                    text.slice(Math.max(0, start - 11), start).endsWith('%{DOL}%var')
                ));
                const isAwait = text.slice(Math.max(0, start - 6), start) === '$await' || (advanced && (
                    text.slice(Math.max(0, start - 12), start).endsWith('$$c[]await') ||
                    text.slice(Math.max(0, start - 13), start).endsWith('%{DOL}%await')
                ));
                if(!isVar && !isAwait) return null;
                let end = offset;
                while(end < text.length && text[end] !== ';' && text[end] !== ']') end++;
                const hoveredName = text.slice(start + 1, end).trim();
                if(!hoveredName) return null;
                const defRegex = isVar
                    ?/(?:\$\$c\[\]|%\{DOL\}%|\$)var\[([^\];]+);[^\]]*\]/g
                    :/(?:\$\$c\[\]|%\{DOL\}%|\$)async\[([^\]]+)\]/g;
                const results = [];
                let match;
                while((match = defRegex.exec(text)) !== null) {
                    if(match[1].trim() !== hoveredName) continue;
                    let rangeEnd = match.index + match[0].length;
                    if(isAwait) {
                        const endasyncPattern = /(?:\$\$c\[\]|%\{DOL\}%|\$)endasync/g;
                        endasyncPattern.lastIndex = rangeEnd;
                        const endasyncMatch = endasyncPattern.exec(text);
                        if(endasyncMatch) {
                            rangeEnd = endasyncMatch.index + endasyncMatch[0].length;
                        }
                    }
                    results.push(new vscode.Location(
                        document.uri,
                        new vscode.Range(
                            document.positionAt(match.index),
                            document.positionAt(rangeEnd)
                        )
                    ));
                }
                return results.length?results:null;
            }
        }
    );
    context.subscriptions.push(definitionProvider);
    const colorProvider = vscode.languages.registerColorProvider(
        'bdscript',
        {
            provideDocumentColors(document) {
                if(getDocumentFlags(document).includes("$bdsColorDisable")) return;
                if(cachedColors.has(document)) return cachedColors.get(document);
                const text = document.getText();
                const colors = [];
                for(let i = 0; i < text.length; i++) {
                    if(text[i] !== '$') continue;
                    const nameMatch = text.slice(i).match(/^\$[a-zA-Z_][a-zA-Z0-9_]*/);
                    if(!nameMatch) continue;
                    const funcName = nameMatch[0];
                    const func = functions.find(func => func.tagStart === funcName);
                    if(!func || !func.arguments.some(arg => arg.type === 'Color')) continue;
                    const bracketStart = i + funcName.length;
                    if(text[bracketStart] !== '[') continue;
                    const lineNumber = document.positionAt(i).line;
                    if(getCommentFlags(document.lineAt(lineNumber).text).includes("$bdsColorLineDisable")) {
                        i = bracketStart;
                        continue;
                    }
                    let depth = 0, ii = bracketStart, fullCall = '';
                    while(ii < text.length) {
                        const char = text[ii];
                        if(char === '[') depth++;
                        if(char === ']') depth--;
                        fullCall += char;
                        ii++;
                        if(depth === 0) break;
                    }
                    if(depth !== 0) continue;
                    const argsValue = fullCall.slice(1, -1);
                    const args = [];
                    let current = '', argDepth = 0;
                    for(let j = 0; j < argsValue.length; j++) {
                        const char = argsValue[j];
                        if(char === '[') argDepth++;
                        if(char === ']') argDepth--;
                        if(char === ';' && argDepth === 0) {
                            args.push(current); current = '';
                        }
                    else current += char;
                    }
                    args.push(current);
                    let argOffset = bracketStart + 1;
                    args.forEach((argValue, index) => {
                        const arg = func.arguments[index];
                        if(arg?.type === 'Color') {
                            const trimmed = argValue.trim();
                            let r, g, b;
                            if(/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
                                r = parseInt(trimmed.slice(1, 3), 16) / 255;
                                g = parseInt(trimmed.slice(3, 5), 16) / 255;
                                b = parseInt(trimmed.slice(5, 7), 16) / 255;
                            } else if(/^\d+$/.test(trimmed)) {
                                const dec = parseInt(trimmed);
                                r = ((dec >> 16) & 0xFF) / 255;
                                g = ((dec >> 8) & 0xFF) / 255;
                                b = (dec & 0xFF) / 255;
                            }
                            if(r !== undefined) {
                                const start = document.positionAt(argOffset + argValue.indexOf(trimmed));
                                const end = document.positionAt(argOffset + argValue.indexOf(trimmed) + trimmed.length);
                                colors.push(new vscode.ColorInformation(
                                    new vscode.Range(start, end),
                                    new vscode.Color(r, g, b, 1)
                                ));
                            }
                        }
                        argOffset += argValue.length + 1;
                    });
                }
                cachedColors.set(document, colors);
                return colors;
            },
            provideColorPresentations(color) {
                const r = Math.round(color.red * 255).toString(16).padStart(2, '0');
                const g = Math.round(color.green * 255).toString(16).padStart(2, '0');
                const b = Math.round(color.blue * 255).toString(16).padStart(2, '0');
                return [new vscode.ColorPresentation(`#${r}${g}${b}`)];
            }
        }
    );
    context.subscriptions.push(colorProvider);
    const hoverProvider = vscode.languages.registerHoverProvider(
        'bdscript',
        {
            provideHover(document, position) {
                if(getDocumentFlags(document).includes("$bdsHoverDisable")) return;
                if(getCommentFlags(document.lineAt(position.line).text).includes("$bdsHoverLineDisable")) return;
                const range = document.getWordRangeAtPosition(position, /\$[a-zA-Z_][a-zA-Z0-9_]*/);
                if(!range) return;
                const func = functions.find(func => func.tagStart === document.getText(range));
                if(!func) return;
                return new vscode.Hover(func.hoverDocs, range);
            }
        }
    );
    context.subscriptions.push(hoverProvider);
    const signatureProvider = vscode.languages.registerSignatureHelpProvider(
        'bdscript',
        {
            provideSignatureHelp(document, position) {
                if(getDocumentFlags(document).includes("$bdsSignatureDisable")) return;
                if(getCommentFlags(document.lineAt(position.line).text).includes("$bdsSignatureLineDisable")) return;
                const textBeforeCursor = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
                const activeFunction = getActiveFunc(textBeforeCursor);
                if(!activeFunction) return;
                const activeFunc = functions.find(f => f.tagStart === activeFunction.funcName && f.arguments.length > 0);
                if(!activeFunc) return;
                const textToCursor = document.getText(new vscode.Range(document.positionAt(activeFunction.bracketIndex), position));
                const activeFuncArg = curArg(textToCursor);
                let activeArg = Math.min(activeFuncArg, activeFunc.arguments.length - 1);
                const repeatableIndex = activeFunc.arguments.findIndex(arg => arg.repeatable);
                if(repeatableIndex !== -1 && activeFuncArg >= repeatableIndex) {
                    const remaining = document.getText(new vscode.Range(position, document.lineAt(document.lineCount - 1).range.end));
                    const nextClose = remaining.indexOf(']');
                    const nextSemi = remaining.indexOf(';');
                    const isLast = nextClose !== -1 && (nextSemi === -1 || nextClose < nextSemi);
                    if(!isLast) activeArg = repeatableIndex;
                }
                const signature = new vscode.SignatureInformation(activeFunc.fullTag, activeFunc.signatureDocs);
                signature.parameters = activeFunc.arguments.map(arg => new vscode.ParameterInformation(
                    arg.name,
                    `${argType(arg)} ${isRequired(arg)}${isEmptiable(arg)}${isRepeatable(arg)}${enumValues(arg) || ''}${arg.description ? `\n${arg.description}` : ''}\n`
                ));
                const signatureHelp = new vscode.SignatureHelp();
                signatureHelp.signatures = [signature];
                signatureHelp.activeSignature = 0;
                signatureHelp.activeParameter = activeArg;
                return signatureHelp;
            }
        },
        '[',';'
    );
    context.subscriptions.push(signatureProvider);
    const foldingProvider = vscode.languages.registerFoldingRangeProvider(
        'bdscript',
        {
            provideFoldingRanges(document) {
                const ranges = [];
                const stack = [];
                const blockPairs = {
                    '$if':'$endif',
                    '$async':'$endasync',
                    '$try':'$endtry'
                };
                const midBlock = {
                    '$if':['$elseif', '$else'],
                    '$try':['$catch']
                };
                const advanced = vscode.workspace.getConfiguration('bdscript').get('enableFeaturesForAdvancedUsers');
                for(let i = 0; i < document.lineCount; i++) {
                    const line = document.lineAt(i).text;
                    const match = advanced
                        ?line.match(/(?:\$\$c\[\]|%\{DOL\}%|\$)[a-zA-Z_]+/g)
                        :line.match(/\$[a-zA-Z_]+/g);
                    if(!match) continue;
                    match.forEach(funcName => {
                        const n = funcName.replace(/^\$\$c\[\]|^%\{DOL\}%/, '$');
                        if(n in blockPairs) {
                            stack.push({name:n, line:i});
                        } else if(stack.length) {
                            const top = stack[stack.length - 1];
                            const mids = midBlock[top.name] || [];
                            if(mids.includes(n)) {
                                ranges.push(new vscode.FoldingRange(top.line, i - 1));
                                stack[stack.length - 1] = {name:top.name, line:i};
                            } else if(blockPairs[top.name] === n) {
                                ranges.push(new vscode.FoldingRange(top.line, i - 1));
                                stack.pop();
                            }
                        }
                    });
                }
                return ranges;
            }
        }
    );
    context.subscriptions.push(foldingProvider);
    const diagnosticsCollection = vscode.languages.createDiagnosticCollection('bdscript');
    context.subscriptions.push(diagnosticsCollection);
    vscode.workspace.onDidChangeTextDocument(event => {
        cachedColors.delete(event.document);
        const existing = diagnosticDebounceMap.get(event.document);
        if(existing) clearTimeout(existing);
        diagnosticDebounceMap.set(event.document, setTimeout(() => {
            bdscriptValidate(event.document, diagnosticsCollection);
            diagnosticDebounceMap.delete(event.document);
        }, 300));
    });
    vscode.workspace.onDidOpenTextDocument(document => {
        bdscriptValidate(document, diagnosticsCollection);
    });
    vscode.workspace.onDidCloseTextDocument(document => {
        diagnosticsCollection.delete(document.uri);
    });
    vscode.workspace.textDocuments.forEach(documents => {
        bdscriptValidate(documents, diagnosticsCollection);
    });
    vscode.workspace.onDidChangeConfiguration(event => {
        if(event.affectsConfiguration("bdscript.changeCodeHighlight")) {
            const newConfig = vscode.workspace.getConfiguration("bdscript");
            const newCodeHighlight = newConfig.get("changeCodeHighlight");
            updateCodeHighlight(newCodeHighlight);
        }
    });
}
/*
    Porzucone Pomysły/Funkcje
        Semantic Highlight - lagowało jak cholera
        Markdown Highlight - wystarczy że dodałem numberHighlight który i tak będzie trudny do zrozumienia dla osób po lobotomii
        JSON Highlight - ten sam powód jak Markdown Highlight
*/
export function deactivate() {}
