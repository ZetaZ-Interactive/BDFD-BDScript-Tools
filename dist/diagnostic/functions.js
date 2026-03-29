import * as vscode from 'vscode';
import {
    parseVariables,
    parseIDs
} from '../completion/functions.js';
import {
    getCommentFlags,
    getDocumentFlags
} from '../shared/sharedFunctions.js';
import {
    functions,
    permissionList
} from '../shared/sharedData.js';
import {
    validateComponents
} from './components.js';
const varLabelMap = {
    '$var':{varLabel:['Temporary Variable'],varKind:vscode.CompletionItemKind.Variable,argNum:0},
    '$await':{varLabel:['Async Scope'],varKind:vscode.CompletionItemKind.Module,argNum:0},
    '$addSection':{varLabel:['Container ID'],varKind:vscode.CompletionItemKind.Field,argNum:1},
    '$addActionRow':{varLabel:['Container ID'],varKind:vscode.CompletionItemKind.Field,argNum:1},
    '$addMediaGallery':{varLabel:['Container ID'],varKind:vscode.CompletionItemKind.Field,argNum:1},
    '$addTextDisplay':{varLabel:['Container ID','Section ID'],varKind:vscode.CompletionItemKind.Field,argNum:1},
    '$addSeparator':{varLabel:['Container ID'],varKind:vscode.CompletionItemKind.Field,argNum:2},
    '$addMediaGalleryItem':{varLabel:['Gallery ID'],varKind:vscode.CompletionItemKind.Field,argNum:3},
    '$addThumbnail':{varLabel:['Section ID'],varKind:vscode.CompletionItemKind.Field,argNum:4},
    '$addButtonCV2':{varLabel:['Action Row ID','Section ID'],varKind:vscode.CompletionItemKind.Field,argNum:5},
    '$addRoleSelect':{varLabel:['Action Row ID'],varKind:vscode.CompletionItemKind.Field,argNum:5},
    '$addUserSelect':{varLabel:['Action Row ID'],varKind:vscode.CompletionItemKind.Field,argNum:5},
    '$addStringSelect':{varLabel:['Action Row ID'],varKind:vscode.CompletionItemKind.Field,argNum:5},
    '$addStringSelectOption':{varLabel:['String Select ID'],varKind:vscode.CompletionItemKind.Struct,argNum:5},
    '$addChannelSelect':{varLabel:['Action Row ID'],varKind:vscode.CompletionItemKind.Field,argNum:5},
    '$addMentionableSelect':{varLabel:['Action Row ID'],varKind:vscode.CompletionItemKind.Field,argNum:5}
};
/*
    spaghetti
    
*/
export function bdscriptValidate(document, collection) {
    if(document.languageId !== 'bdscript') return;
    const documentText = document.getText();
    const documentCommentFlags = getDocumentFlags(document);
    const disableInfo = documentCommentFlags.includes("$bdsDiagnosticInformationDisable");
    if(documentCommentFlags.includes("$bdsDiagnosticDisable")) {
        collection.set(document.uri, []);
        return;
    }
    const advanced = vscode.workspace.getConfiguration('bdscript').get('enableFeaturesForAdvancedUsers');
    const parsedVariables = parseVariables(document);
    const parsedIDs = parseIDs(document);
    const diagnostics = [];
    const blockDiagnostics = [];
        const blockPairs = {
        '$if':'$endif',
        '$async':'$endasync',
        '$try':'$endtry'
    };
    for(let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
        const lineText = document.lineAt(lineNumber).text;
        const match = lineText.match(/\$[a-zA-Z_]+/g);
        if(!match) continue;
        match.forEach(funcName => {
            if(funcName in blockPairs) {
                blockDiagnostics.push({name:funcName, line:lineNumber, char:lineText.indexOf(funcName)});
            } else if(Object.values(blockPairs).includes(funcName)) {
                const expectedStart = Object.keys(blockPairs).find(key => blockPairs[key] === funcName);
                if(!(!blockDiagnostics.length || blockDiagnostics[blockDiagnostics.length - 1].name !== expectedStart)) blockDiagnostics.pop();
            }
        });
    }
    blockDiagnostics.forEach(block => {
        const lineCommentFlags = getCommentFlags(document.lineAt(block.line).text);
                if(lineCommentFlags.includes("$bdsDiagnosticLineDisable")) return;
        diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(block.line, block.char, block.line, block.char + block.name.length),
            `${block.name} not closed with ${blockPairs[block.name]}`,
            vscode.DiagnosticSeverity.Error
        ));
    });
    const varDefs = new Map();
    const varReads = new Map();
    for(let i = 0; i < documentText.length; i++) {
        if(documentText[i] !== '$' && !(advanced && documentText[i] === '%')) continue;
        const varRegex = advanced
            ?/^(?:\$\$c\[\]|%\{DOL\}%|\$)var/
            :/^\$var/;
        const nameMatch = documentText.slice(i).match(varRegex);
        if(!nameMatch) continue;
        const bracketStart = i + nameMatch[0].length;
        if(documentText[bracketStart] !== '[') continue;
        let depth = 0, ii = bracketStart, fullCall = '';
        while(ii < documentText.length) {
            const char = documentText[ii];
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
                args.push(current.trim()); current = '';
            }
            else current += char;
        }
        args.push(current.trim());
        const varName = args[0];
        if(!varName) continue;
        if(args.length >= 2) {
            if(!varDefs.has(varName)) varDefs.set(varName, []);
            varDefs.get(varName).push(new vscode.Range(
                document.positionAt(i),
                document.positionAt(ii)
            ));
        } else {
            if(!varReads.has(varName)) varReads.set(varName, []);
            varReads.get(varName).push({line: document.positionAt(i).line, range: new vscode.Range(document.positionAt(i), document.positionAt(ii))});
        }
    }
    varDefs.forEach((ranges, name) => {
        if(!varReads.has(name)) {
            ranges.forEach(range => {
                const lineCommentFlags = getCommentFlags(document.lineAt(range.start.line).text);
                if(lineCommentFlags.includes("$bdsDiagnosticLineDisable")) return;
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Temporary Variable '${name}' is defined but never retrieved`,
                    vscode.DiagnosticSeverity.Hint
                );
                diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
                diagnostics.push(diagnostic);
            });
        }
    });
    varReads.forEach((reads, name) => {
        const defRanges = varDefs.get(name);
        reads.forEach(({line, range}) => {
            const lineCommentFlags = getCommentFlags(document.lineAt(line).text);
            if(lineCommentFlags.includes("$bdsDiagnosticLineDisable")) return;
            if(defRanges) {
                const definedBeforeRead = defRanges.some(defRange => defRange.start.line < line);
                if(!definedBeforeRead) {
                    const lineText = document.lineAt(line).text;
                    const containsEscape = lineText.includes('$$c[]') || lineText.includes('%{DOL}%');
                    if(!(disableInfo && containsEscape)) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `$var - Temporary Variable '${name}' is retrieved before being defined${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                            containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Warning
                        ));
                    }
                }
            }
        });
    });
    const asyncDefs = new Map();
    const asyncReads = [];
    for (let i = 0; i < documentText.length; i++) {
        if (documentText[i] !== '$') continue;
        const slice = documentText.slice(i);
        const isAsync = slice.startsWith('$async[');
        const isAwait = slice.startsWith('$await[');
        if (!isAsync && !isAwait) continue;
        const bracketStart = i + 6;
        if (documentText[bracketStart] !== '[') continue;
        let depth = 0, ii = bracketStart, fullCall = '';
        while (ii < documentText.length) {
            const char = documentText[ii];
            if (char === '[') depth++;
            if (char === ']') depth--;
            fullCall += char;
            ii++;
            if (depth === 0) break;
        }
        if (depth !== 0) continue;
        const firstArg = fullCall.slice(1, -1).split(';')[0].trim();
        if (!firstArg) continue;
        const startPosition = document.positionAt(i);
        const endPosition = document.positionAt(ii);
        const range = new vscode.Range(startPosition, endPosition);
        const lineCommentFlags = getCommentFlags(document.lineAt(startPosition.line).text);
        if (lineCommentFlags.includes("$bdsDiagnosticLineDisable")) continue;
        if (isAsync) {
            asyncDefs.set(firstArg, startPosition.line);
        } else {
            asyncReads.push({name:firstArg,line:startPosition.line,range});
        }
    }
    asyncReads.forEach(({ name, line, range }) => {
        const defLine = asyncDefs.get(name);
        if(defLine !== undefined && line < defLine) {
            const lineText = document.lineAt(line).text;
            const containsEscape = lineText.includes('$$c[]') || lineText.includes('%{DOL}%');
            if(!(disableInfo && containsEscape)) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `$await - Async Scope '${name}' is awaited before being defined${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                    containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    });
    parsedIDs.forEach(id => {
        if(id.ranges.length > 1) {
            id.ranges.forEach(range => {
                const lineText = document.lineAt(range.start.line).text;
                const containsEscape = lineText.includes('$$c[]') || lineText.includes('%{DOL}%');
                const severity = containsEscape
                    ?vscode.DiagnosticSeverity.Information
                    :id.label.includes('Async')
                        ?vscode.DiagnosticSeverity.Error
                        :vscode.DiagnosticSeverity.Warning;
                if (!(disableInfo && containsEscape)) {
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `${id.label} with name '${id.name}' already exists!${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                        severity
                    ));
                }
            });
        }
    });
    if(!documentCommentFlags.includes('$bdsDiagnosticComponentDisable')) {
        validateComponents(document, documentText, diagnostics, parsedIDs, documentCommentFlags);
    }
    for(let i = 0; i < documentText.length; i++) {
        if(documentText[i] !== '$' && documentText.slice(i, i + 7) !== '%{DOL}%') continue;
        const nameMatch = documentText.slice(i).match(advanced?/^(?:\$\$c\[\]|%\{DOL\}%|\$)[a-zA-Z_][a-zA-Z0-9_]*/:/^\$[a-zA-Z_][a-zA-Z0-9_]*/);
        if(!nameMatch) continue
        const funcName = nameMatch[0];
        const normalizedFuncName = funcName.replace(/^\$\$c\[\]|^%\{DOL\}%/, '$');
        const bracketStart = i + funcName.length;
        const hasBracket = documentText[bracketStart] === '[';
        const func = (hasBracket?functions.find(func => func.tagStart === normalizedFuncName && func.arguments.length > 0):null) || functions.find(func => func.tagStart === normalizedFuncName);
        if(!func) {
            const startPosition = document.positionAt(i);
            const endPosition = document.positionAt(i + funcName.length);
            const range = new vscode.Range(startPosition, endPosition);
            const lineCommentFlags = getCommentFlags(document.lineAt(startPosition.line).text);
            if(lineCommentFlags.includes("$bdsDiagnosticLineDisable") || funcName.includes('$bds')) continue;
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Unknown function ${funcName}`,
                vscode.DiagnosticSeverity.Warning
            ));
            continue;
        }
        if(func.isDeprecated && !documentCommentFlags.includes("$bdsDiagnosticDeprecatedDisable")) {
            const startPosition = document.positionAt(i);
            const endPosition = document.positionAt(i + funcName.length);
            const range = new vscode.Range(startPosition, endPosition);
            const lineCommentFlags = getCommentFlags(document.lineAt(startPosition.line).text);
            if(!lineCommentFlags.includes("$bdsDiagnosticLineDisable")) {
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `${func.tagStart} is deprecated, use ${func.deprecatedFor} instead`,
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.tags = [vscode.DiagnosticTag.Deprecated];
                diagnostics.push(diagnostic);
            }
        }
        if(documentText[bracketStart] !== '[') {
            if(func.arguments.length > 0) {
                const startPosition = document.positionAt(i);
                const endPosition = document.positionAt(i + funcName.length);
                const range = new vscode.Range(startPosition, endPosition);
                const lineCommentFlags = getCommentFlags(document.lineAt(startPosition.line).text);
                if(lineCommentFlags.includes("$bdsDiagnosticLineDisable")) continue;
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Function ${funcName} expects arguments!`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
            continue;
        }
        let depth = 0;
        let ii = bracketStart;
        let fullCall = '';
        while(ii < documentText.length) {
            const char = documentText[ii];
            if(char === '[') depth++;
            if(char === ']') depth--;
            fullCall += char;
            ii++;
            if(depth === 0) break;
        }
        if(depth !== 0) {
            const startPosition = document.positionAt(i);
            const lineCommentFlags = getCommentFlags(document.lineAt(startPosition.line).text);
            if (!lineCommentFlags.includes("$bdsDiagnosticLineDisable")) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(startPosition, document.positionAt(i + funcName.length + 1)),
                    `Expected ']' at the end of ${funcName}`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
            continue;
        }
        const argsValue = fullCall.slice(1, -1);
        const args = [];
        let current = ' ';
        let argDepth = 0;
        for(let j = 0; j < argsValue.length; j++) {
            const char = argsValue[j];
            if(char === '[') argDepth++;
            if(char === ']') argDepth--;
            if(char === ';' && argDepth === 0) {
                args.push(current.trim());
                current = ' ';
            } else {
                current += char;
            }
        }
        if(current.length > 0 || argsValue.endsWith(';')) {
            args.push(current.trim());
        }
        const startPosition = document.positionAt(i);
        const endPosition = document.positionAt(ii);
        const lineCommentFlags = getCommentFlags(document.lineAt(startPosition.line).text);
        if(lineCommentFlags.includes("$bdsDiagnosticLineDisable")) {
            i = ii - 1;
            continue;
        }
        const range = new vscode.Range(startPosition, endPosition);
        const containsEscape = args.some(arg => arg.includes('\\'));
        if((args.length > func.arguments.length) && !func.arguments.some(arg => arg.repeatable) && !(disableInfo && containsEscape) && funcName !== '$c') {
            diagnostics.push(new vscode.Diagnostic(
                range,
                `${func.tagStart} - Too many arguments, expected up to ${func.arguments.length}, got ${args.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        }
        const requiredArgsCount = func.arguments.filter(arg => arg.required).length;
        if((args.length < requiredArgsCount) && !(disableInfo && containsEscape)) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                `${func.tagStart} - Expected at least ${requiredArgsCount} arguments, got ${args.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        }
        const lastArg = func.arguments[func.arguments.length - 1];
        args.forEach((argumentValue, index) => {
            let arg;
            if(index < func.arguments.length) {
                arg = func.arguments[index];
            } else if(!!lastArg.repeatable) {
                arg = lastArg;
            } else {
                return;
            }
            const errorMessage =
            documentCommentFlags.includes("$bdsDiagnosticUseArguments")
                ?"argument '"+arg.name+"'"
                :"position "+(index+1);
            const argValue = argumentValue?.trim();
            const {varLabel = null, varKind, argNum} = varLabelMap[func.tagStart] ?? {};
            if(varLabel && index === argNum) {
                const varName = args[argNum]?.trim();
                const availableVars = parsedVariables
                    .filter(variable => variable.kind === varKind && varLabel.includes(variable.detail))
                    .map(variable => variable.name);
                if(!availableVars.includes(varName) && !functions.some(func => argValue?.includes(func.tagStart))) {
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `${func.tagStart} - Failed to find ${varLabel.join(' / ')} named '${varName}'!`,
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }
            const argIncludesFunc = functions.some(func => argValue.includes(func.tagStart));
            const isShort = (argValue.length>1);
            const isArgString = arg.type.includes('String');
            const isValidDuration = isShort
                ?/^-?\d+[smhdw]$/.test(argValue) || /^-?\d+$/.test(argValue)
                :/^-?\d+$/.test(argValue);
            const isValidHowMany = isShort
                ?/^[<>]?\d+$/.test(argValue) || /^\d+[<>]?$/.test(argValue)
                :/^-?\d+$/.test(argValue) || ['<', '>'].includes(argValue);
            if(arg.required && (argValue === undefined || argValue === "") && !arg.empty) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected valid value in ${errorMessage}, got empty value`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
            if(arg.type.includes('Enum') && (argValue !== "") && !arg.enumData.includes(argValue) && !argIncludesFunc) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected valid enum value in ${errorMessage}, got '${argValue}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            if((arg.type.includes('Bool') && !isArgString) && (argValue !== "") && !['true','false','yes','no'].includes(argValue) && !argIncludesFunc) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected boolean in ${errorMessage}, got '${argValue}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            if((arg.type.includes('Integer') && !arg.type.includes('Float') && !isArgString) && (argValue !== "") && !/^-?\d+$/.test(argValue) && !argIncludesFunc) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected integer in ${errorMessage}, got '${argValue}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            if((arg.type.includes('Float') && !isArgString) && (argValue !== "") && !/^-?\d+(\.\d+)?$/.test(argValue) && !argIncludesFunc) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected float/decimal in ${errorMessage}, got '${argValue}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            if((arg.type.includes('HowMany') && !isArgString) && (argValue !== "") && !isValidHowMany && !argIncludesFunc) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected how many in ${errorMessage}, got '${argValue}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            if((arg.type.includes('Duration') && !isArgString) && (argValue !== "") && !isValidDuration && !argIncludesFunc) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected duration in ${errorMessage}, got '${argValue}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            if((arg.type.includes('Snowflake') && !isArgString) && (argValue !== "") && !/^-?\d+$/.test(argValue) && !argIncludesFunc && !(arg.name.includes('+/-') && /^[\-\+]\d+$/.test(argValue))) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected snowflake in ${errorMessage}, got '${argValue}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            if(arg.type.includes('Permission') && (argValue !== "") && !argIncludesFunc && !(arg.type.includes('String')?(/^[+\-\/]/.test(argValue) && permissionList.includes(argValue.slice(1).toLowerCase())):permissionList.includes(argValue.toLowerCase()))) {
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${func.tagStart} - Expected permission in ${errorMessage}, got '${argValue}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        });
        if(documentCommentFlags.includes("$bdsDiagnosticIgnoreNests]")) i = ii - 1;
    }
    collection.set(document.uri, diagnostics);
}
