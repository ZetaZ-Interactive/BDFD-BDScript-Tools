import * as vscode from 'vscode';
import {
    docs
} from '../shared/sharedFunctions.js';
const cachedVariables = new WeakMap();
const cachedIDs = new WeakMap();
export function parseVariables(document) {
    if (cachedVariables.has(document)) return cachedVariables.get(document); // (?:\$\$c\[\]|%\{DOL\}%|\$) || (?:\$)
    const advanced = vscode.workspace.getConfiguration('bdscript').get('enableFeaturesForAdvancedUsers');
    const prefix = advanced?'(?:\\$\\$c\\[\\]|%\\{DOL\\}%|\\$)':'(?:\\$)';
    const completionItemData = [
        {
            regex: new RegExp(`${prefix}(?:set|get)(?:User|Channel|Server)?Var\\[([^\\];]+)`, 'g'),
            type: 'appVar',
            detail: 'App Variable',
            description: '**App Variable** used by functions like `$setVar[]` or `$getVar[]`',
            kind: vscode.CompletionItemKind.Variable
        },
        {
            regex: new RegExp(`${prefix}var\\[([^\\];]+);([^\\]]*)\\]`, 'g'),
            type: 'tempVar',
            detail: 'Temporary Variable',
            description: '**Temporary Variable** used by `$var[]`',
            kind: vscode.CompletionItemKind.Variable
        },
        {
            regex: new RegExp(`${prefix}async\\[([^\\]]+)\\]`, 'g'),
            type: 'async',
            detail: 'Async Scope',
            description: '**Async Scope** used by `$async[]` and `$await[]`',
            kind: vscode.CompletionItemKind.Module
        },
        {
            regex: new RegExp(`${prefix}(?:addActionRow)\\[([^\\];]+)`, 'g'),
            type: 'actionRow',
            detail: 'Action Row ID',
            description: '**Action Row ID** used by `Components v2` functions',
            kind: vscode.CompletionItemKind.Field
        },
        {
            regex: new RegExp(`${prefix}(?:addSection)\\[([^\\];]+)`, 'g'),
            type: 'section',
            detail: 'Section ID',
            description: '**Section ID** used by `Components v2` functions',
            kind: vscode.CompletionItemKind.Field
        },
        {
            regex: new RegExp(`${prefix}(?:addContainer)\\[([^\\];]+)`, 'g'),
            type: 'container',
            detail: 'Container ID',
            description: '**Container ID** used by `Components v2` functions',
            kind: vscode.CompletionItemKind.Field
        },
        {
            regex: new RegExp(`${prefix}(?:addMediaGallery)\\[([^\\];]+)`, 'g'),
            type: 'mediaGallery',
            detail: 'Gallery ID',
            description: '**Gallery ID** used by `Components v2` functions',
            kind: vscode.CompletionItemKind.Field
        },
        {
            regex: new RegExp(`${prefix}(?:addStringSelect)\\[([^\\];]+)`, 'g'),
            type: 'stringSelectMenu',
            detail: 'String Select ID',
            description: '**String Select ID** used by `$addStringSelect[]` and `$addStringSelectOption[]`',
            kind: vscode.CompletionItemKind.Struct
        }
    ];
    const discardIfMatch = /[^a-zA-Z0-9_\.\(\)]/;
    const variables = new Map();
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;
        completionItemData.forEach(completion => {
            completion.regex.lastIndex = 0;
            let match;
            while ((match = completion.regex.exec(line)) !== null) {
                const varName = match[1];
                if (!varName) continue;
                if (discardIfMatch.test(varName) || varName.length < 1) continue;
                const completionKey = `${completion.type}:${varName}`;
                if (!variables.has(completionKey)) {
                    const mkd = new vscode.MarkdownString();
                    mkd.isTrusted = true;
                    mkd.appendMarkdown(completion.description)
                    variables.set(completionKey, {
                        name: varName,
                        detail: completion.detail,
                        description: mkd,
                        kind: completion.kind
                    });
                }
            }
        });
        /*
            jebać jsona
        */
        const jsonStartRegex = new RegExp(`${prefix}(?:json|jsonSet|jsonSetString|jsonUnset|jsonExists|jsonArray|jsonArrayCount|jsonArrayIndex|jsonArrayAppend|jsonArrayPop|jsonArrayShift|jsonArrayUnshift|jsonArraySort|jsonArrayReverse|jsonJoinArray)\\[`, 'g');
        let jsonMatch;
        while ((jsonMatch = jsonStartRegex.exec(line)) !== null) {
            const matchText = jsonMatch[0];
            const funcName = matchText.slice(1, matchText.length - 1);
            let iii = jsonMatch.index + matchText.length;
            let depth = 1;
            let key = '';
            const keys = [];
            while (iii < line.length && depth > 0) {
                const char = line[iii];
                if (char === '[') depth++;
                if (char === ']') depth--;
                if (char === ';' && depth === 1) {
                    keys.push(key.trim());
                    key = '';
                } else if (depth > 0) {
                    key += char;
                }
                iii++;
            }
            if (key) keys.push(key.trim());
            const ignoreLast = /(jsonSet|jsonSetString|jsonArrayIndex|jsonArrayAppend|jsonArrayUnshift|jsonJoinArray)/;
            if (ignoreLast.test(funcName) && keys.length > 0) {
                keys.pop();
            }
            keys.forEach(jsonKey => {
                if (!jsonKey || discardIfMatch.test(jsonKey) || jsonKey.length < 2) return;
                const completionKey = `jsonKey:${jsonKey}`;
                if (!variables.has(completionKey)) {
                    const mkd = new vscode.MarkdownString();
                    mkd.isTrusted = true;
                    mkd.appendMarkdown('**JSON Key** used by JSON functions like `$json[]` or `$jsonSet[]`');
                    variables.set(completionKey, {
                        name: jsonKey,
                        detail: 'JSON Key',
                        description: mkd,
                        kind: vscode.CompletionItemKind.Property
                    });
                }
            });
            jsonStartRegex.lastIndex = iii;
        }
    }
    const parsedVariables = Array.from(variables.values());
    cachedVariables.set(document, parsedVariables)
    return parsedVariables;
}
export function parseIDs(document) {
    if(cachedIDs.has(document)) return cachedIDs.get(document);
    const advanced = vscode.workspace.getConfiguration('bdscript').get('enableFeaturesForAdvancedUsers');
    const prefix = advanced?'(?:\\$\\$c\\[\\]|%\\{DOL\\}%|\\$)':'(?:\\$)';
    const IDsData = [
        {
            regex: new RegExp(`${prefix}async\\[([^\\]]+)\\]`, 'g'),
            type: 'async',
            label: 'Async Scope'
        },
        {
            regex: new RegExp(`${prefix}(?:newSelectMenu)\\[([^\\];]+)`, 'g'),
            type: 'interaction',
            label: 'Interaction'
        },
        {
            regex: new RegExp(`${prefix}(?:addButton)\\[(?:yes|no|true|false);([^\\];]+)`, 'g'),
            type: 'interaction',
            label: 'Interaction',
            addDepth: true
        },
        {
            regex: new RegExp(`${prefix}(?:addButtonCV2|addStringSelect|addChannelSelect|addMentionableSelect|addRoleSelect|addUserSelect)\\[([^\\];]+)`, 'g'),
            type: 'interactionComponent',
            label: 'Interaction Component'
        },
        {
            regex: new RegExp(`${prefix}(?:addActionRow|addSection|addContainer|addMediaGallery)\\[([^\\];]+)`, 'g'),
            type: 'messageComponent',
            label: 'Message Component'
        },
        {
            regex: new RegExp(`${prefix}(?:addTextInput)\\[([^\\];]+)`, 'g'),
            type: 'modalInput',
            label: 'Modal Input'
        }
    ];
    const discardIfMatch = /[^a-zA-Z0-9_\.\(\)]/;
    const ids = new Map();
    for(let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;
        IDsData.forEach(id => {
            id.regex.lastIndex = 0;
            let match;
            while((match = id.regex.exec(line)) !== null) {
                const idName = match[1];
                if(!idName || discardIfMatch.test(idName)) continue;
                const idKey = `${id.type}:${idName}`;
                const bracketPos = match.index + match[0].length - match[1].length - 1;
                let depth = id?.addDepth?1:0;
                let end = bracketPos;
                while(end < line.length) {
                    if(line[end] === '[') depth++;
                    if(line[end] === ']') depth--;
                    end++;
                    if(depth === 0) break;
                }
                const range = new vscode.Range(i, match.index, i, end);
                if(!ids.has(idKey)) {
                    ids.set(idKey, {name:idName, label:id.label, ranges:[range]});
                } else {
                    ids.get(idKey).ranges.push(range);
                }
            }
        });
    }
    const parsedIDs = Array.from(ids.values());
    cachedIDs.set(document, parsedIDs);
    return parsedIDs;
}
export function parseFunctions(functions) {
    const seenNames = new Set();
    return functions.map(func => {
        const match = func.tag.match(/^(\$([a-zA-Z_][a-zA-Z0-9_]*))/);
        const tagStart = match?match[1]:func.tag;
        const name = match?match[2]:func.tag;
        const parsedFunctions = {
            name:name,
            tagStart:tagStart,
            fullTag:func.tag,
            description:func.shortDescription,
            arguments:func.arguments||[],
            isDeprecated:func.deprecated||false,
            deprecatedFor:func.deprecatedFor?`$${func.deprecatedFor}[]`:undefined,
            isPremium:func.premium||false,
            isDangerous:func.dangerous||false,
            isExperimental:func.experimental||false,
            beWise:func.beWise||false,
            kind:func.kind||undefined
        }
        const isCopy = seenNames.has(name);
        seenNames.add(name);
        parsedFunctions.hoverDocs = docs(parsedFunctions, true, isCopy, false);
        parsedFunctions.completionDocs = docs(parsedFunctions, false, isCopy, false);
        parsedFunctions.signatureDocs = docs(parsedFunctions, false, isCopy, true);
        return parsedFunctions;
    });
}
export function buildFunctionSnippet(func, empty) {
    return !func.arguments.length ? func.name : func.arguments.map((arg, i) => `\${${i+1}:${empty?'':arg.name}}`).join(';');
}
vscode.workspace.onDidChangeTextDocument(event => {
    cachedVariables.delete(event.document);
    cachedIDs.delete(event.document);
});
