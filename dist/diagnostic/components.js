import * as vscode from 'vscode';
import {
    parseVariables
} from '../completion/functions.js';
import {
    getCommentFlags
} from '../shared/sharedFunctions.js';
/*
    pierdolnik.pdf
*/
export function validateComponents(document, documentText, diagnostics, parsedIDs, documentCommentFlags) {
    const advanced = vscode.workspace.getConfiguration('bdscript').get('enableFeaturesForAdvancedUsers');
    const prefix = advanced?'(?:\\$\\$c\\[\\]|%\\{DOL\\}%|\\$)':'(?:\\$)';
    const funcRegex = new RegExp(`^${prefix}[a-zA-Z_][a-zA-Z0-9_]*`);
    const disableInfo = documentCommentFlags.includes("$bdsDiagnosticInformationDisable");
    function extractArgs(text, i, rawLength) {
        const bracketStart = i + rawLength;
        if(text[bracketStart] !== '[') return null;
        let depth = 0, ii = bracketStart, fullCall = '';
        while(ii < text.length) {
            const char = text[ii];
            if(char === '[') depth++;
            if(char === ']') depth--;
            fullCall += char;
            ii++;
            if(depth === 0) break;
        }
        if(depth !== 0) return null;
        const argsValue = fullCall.slice(1, -1);
        const args = [];
        let current = '', argDepth = 0;
        for(let j = 0; j < argsValue.length; j++) {
            const char = argsValue[j];
            if(char === '[') argDepth++;
            if(char === ']') argDepth--;
            if(char === ';' && argDepth === 0) {
                args.push(current.trim());
                current = '';
            }
            else current += char;
        }
        args.push(current.trim());
        return {
            args,
            end: ii
        };
    }
    function pushComponentDiagnostics(diagnostics, document, range, message, severity) {
        const flags = getCommentFlags(document.lineAt(range.start.line).text);
        if(flags.includes("$bdsDiagnosticLineDisable")) return;
        if(disableInfo && severity === vscode.DiagnosticSeverity.Information) return;
        diagnostics.push(new vscode.Diagnostic(range, message, severity));
    }
    const cv2ChildMap = {
        '$addSection':{parents:['container'],argNum:1,childType:'section'},
        '$addActionRow':{parents:['container'],argNum:1,childType:'actionRow'},
        '$addMediaGallery':{parents:['container'],argNum:1,childType:'mediaGallery'},
        '$addTextDisplay':{parents:['section','container'],argNum:1,childType:'textDisplay'},
        '$addSeparator':{parents:['container'],argNum:2,childType:'separator'},
        '$addMediaGalleryItem':{parents:['mediaGallery'],argNum:3,childType:'galleryItem'},
        '$addRoleSelect':{parents:['actionRow'],argNum:5,childType:'select'},
        '$addUserSelect':{parents:['actionRow'],argNum:5,childType:'select'},
        '$addThumbnail':{parents:['section'],argNum:3,childType:'accessory'},
        '$addStringSelect':{parents:['actionRow'],argNum:5,childType:'select'},
        '$addChannelSelect':{parents:['actionRow'],argNum:5,childType:'select'},
        '$addMentionableSelect':{parents:['actionRow'],argNum:5,childType:'select'},
        '$addButtonCV2':{parents:['actionRow','section'],argNum:5,childType:'button'},
        '$addStringSelectOption':{parents:['stringSelect'],argNum:5,childType:'stringSelectOption'}
    };
    const actionRow = range => ({buttons:[],selects:[],range});
    const section = range => ({textDisplays:[],accessories:[],range});
    const container = range => ({actionRows:[],textDisplays:[],sections:[],mediaGalleries:[],separators:[],range});
    const mediaGallery = range => ({items:[],range});
    const stringSelect = range => ({options:[],range});
    const cv2Containers = {
        actionRow: new Map(),
        section: new Map(),
        container: new Map(),
        mediaGallery: new Map(),
        stringSelect: new Map(),
    };
    const detailToContainer = {
        'Action Row ID':{type:'actionRow',make:actionRow},
        'Section ID':{type:'section',make:section},
        'Container ID':{type:'container',make:container},
        'Gallery ID':{type:'mediaGallery',make:mediaGallery},
        'String Select ID':{type:'stringSelect',make:stringSelect}
    };
    const cv2ParsedVars = parseVariables(document);
    cv2ParsedVars.forEach(v => {
        const mapping = detailToContainer[v.detail];
        if(!mapping) return;
        const map = cv2Containers[mapping.type];
        if(map.has(v.name)) return;
        const idEntry = parsedIDs.find(id => id.name === v.name);
        const range = idEntry?.ranges?.[0] ?? new vscode.Range(0, 0, 0, 0);
        map.set(v.name, mapping.make(range));
    });
    const cv1Funcs = [
        '$author','$authorIcon','$title','$description',
        '$color','$footer','$footerIcon','$thumbnail',
        '$addTimestamp'
    ];
    const cv2Funcs = [
        '$addContainer','$addActionRow','$addSection',
        '$addMediaGallery','$addStringSelect','$addStringSelectOption',
        '$addButtonCV2','$addTextDisplay','$addThumbnail',
        '$addMediaGalleryItem','$addSeparator','$addRoleSelect',
        '$addUserSelect','$addChannelSelect','$addMentionableSelect'
    ];
    const cv1Ranges = [];
    const cv2Ranges = [];
    for(let i = 0; i < documentText.length; i++) {
        if(documentText[i] !== '$' && !documentText.slice(i).match(/^(?:\$\$c\[\]|%\{DOL\}%)/)) continue;
        const nameMatch = documentText.slice(i).match(funcRegex);
        if(!nameMatch) continue;
        const rawLength = nameMatch[0].length;
        const funcName = '$' + nameMatch[0].replace(/^\$\$c\[\]|^%\{DOL\}%|^\$/, '');
        const startPos = document.positionAt(i);
        const endPos = document.positionAt(i + rawLength);
        const range = new vscode.Range(startPos, endPos);
        if(cv1Funcs.includes(funcName)) cv1Ranges.push(range);
        else if(cv2Funcs.includes(funcName)) cv2Ranges.push(range);
    }
    if(cv1Ranges.length > 0 && cv2Ranges.length > 0) {
        [...cv1Ranges, ...cv2Ranges].forEach(range => {
            pushComponentDiagnostics(diagnostics, document, range,
                `Expected only one type of Message Components`,
                vscode.DiagnosticSeverity.Error
            );
        });
    }
    for(let i = 0; i < documentText.length; i++) {
        if(documentText[i] !== '$' && !documentText.slice(i).match(/^(?:\$\$c\[\]|%\{DOL\}%)/)) continue;
        const nameMatch = documentText.slice(i).match(funcRegex);
        if(!nameMatch) continue;
        const rawLength = nameMatch[0].length;
        const funcName = '$' + nameMatch[0].replace(/^\$\$c\[\]|^%\{DOL\}%|^\$/, '');
        const childDef = cv2ChildMap[funcName];
        if(!childDef) continue;
        const parsed = extractArgs(documentText, i, rawLength);
        if(!parsed) continue;
        const {args, end} = parsed;
        const parentId = args[childDef.argNum]?.trim();
        if(!parentId) continue;
        const range = new vscode.Range(document.positionAt(i), document.positionAt(end));
        childDef.parents.forEach(parentType => {
            const parentMap = cv2Containers[parentType];
            if(!parentMap.has(parentId)) return;
            const entry = parentMap.get(parentId);
            switch(childDef.childType) {
                case 'button':
                    if(parentType === 'actionRow') entry.buttons.push(range);
                    else if(parentType === 'section') entry.accessories.push({type:'button',range});
                    break;
                case 'select':
                    entry.selects.push(range);
                    break;
                case 'textDisplay':
                    entry.textDisplays.push(range);
                    break;
                case 'accessory':
                    entry.accessories.push({type:'thumbnail',range});
                    break;
                case 'actionRow':
                    entry.actionRows.push(range);
                    break;
                case 'section':
                    entry.sections.push(range);
                    break;
                case 'mediaGallery':
                    entry.mediaGalleries.push(range);
                    break;
                case 'separator':
                    entry.separators.push(range);
                    break;
                case 'galleryItem':
                    entry.items.push(range);
                    break;
                case 'stringSelectOption': 
                entry.options.push(range);
                break;
            }
        });
    }
    cv2Containers.actionRow.forEach((entry, id) => {
        const {buttons, selects, range} = entry;
        const totalChildren = buttons.length + selects.length;
        const lineText = document.lineAt(range.start.line).text;
        const containsEscape = lineText.includes('$$c[]') || lineText.includes('%{DOL}%');
        if(totalChildren === 0) {
            pushComponentDiagnostics(diagnostics, document, range,
                `Action Row '${id}' expected at least 1 Button or Select Menu${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Warning
            );
            return;
        }
        if(buttons.length > 0 && selects.length > 0) {
            [...buttons, ...selects].forEach(r => pushComponentDiagnostics(diagnostics, document, r,
                `Action Row '${id}' expected Buttons or a Select Menu but not both${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
            return;
        }
        if(selects.length > 1) {
            selects.forEach(range => pushComponentDiagnostics(diagnostics, document, range,
                `Action Row '${id}' expected up to 1 Select Menu, got ${selects.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Warning
            ));
        }
        if(buttons.length > 5) {
            buttons.forEach(range => pushComponentDiagnostics(diagnostics, document, range,
                `Action Row '${id}' expected up to 5 Buttons, got ${buttons.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        }
    });
    cv2Containers.section.forEach((entry, id) => {
        const {textDisplays, accessories, range} = entry;
        const lineText = document.lineAt(range.start.line).text;
        const containsEscape = lineText.includes('$$c[]') || lineText.includes('%{DOL}%');
        if(textDisplays.length === 0) {
            pushComponentDiagnostics(diagnostics, document, range,
                `Section '${id}' expected at least 1 Text Display${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Warning
            );
        } else if(textDisplays.length > 3) {
            textDisplays.forEach(range => pushComponentDiagnostics(diagnostics, document, range,
                `Section '${id}' expected up to 3 Text Displays, got ${textDisplays.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        }
        const buttons = accessories.filter(arg => arg.type === 'button');
        const thumbnails = accessories.filter(arg => arg.type === 'thumbnail');
        if(accessories.length === 0) {
            pushComponentDiagnostics(diagnostics, document, range,
                `Section '${id}' expected at least 1 Button or Thumbnail${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Warning
            );
        } else if(buttons.length > 0 && thumbnails.length > 0) {
            accessories.forEach(arg => pushComponentDiagnostics(diagnostics, document, arg.range,
                `Section '${id}' expected Button or Thumbnail but not both${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        } else if(buttons.length > 1) {
            buttons.forEach(arg => pushComponentDiagnostics(diagnostics, document, arg.range,
                `Section '${id}' expected up to 1 Button, got ${buttons.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        } else if(thumbnails.length > 1) {
            thumbnails.forEach(arg => pushComponentDiagnostics(diagnostics, document, arg.range,
                `Section '${id}' expected up to 1 Thumbnail, got ${thumbnails.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        }
    });
    cv2Containers.container.forEach((entry, id) => {
        const {actionRows, textDisplays, sections, mediaGalleries, separators, range} = entry;
        const totalChildren = actionRows.length + textDisplays.length + sections.length + mediaGalleries.length + separators.length;
        const lineText = document.lineAt(range.start.line).text;
        const containsEscape = lineText.includes('$$c[]') || lineText.includes('%{DOL}%');
        if(totalChildren === 0) {
            pushComponentDiagnostics(diagnostics, document, range,
                `Container '${id}' expected at least 1 Child Component${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Warning
            );
        }
    });
    cv2Containers.mediaGallery.forEach((entry, id) => {
        const {items, range} = entry;
        const lineText = document.lineAt(range.start.line).text;
        const containsEscape = lineText.includes('$$c[]') || lineText.includes('%{DOL}%');
        if(items.length === 0) {
            pushComponentDiagnostics(diagnostics, document, range,
                `Media Gallery '${id}' expected at least 1 Gallery Item${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Warning
            );
        } else if(items.length > 10) {
            items.forEach(r => pushComponentDiagnostics(diagnostics, document, r,
                `Media Gallery '${id}' expected up to 10 Gallery Items, got ${items.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        }
    });
    cv2Containers.stringSelect.forEach((entry, id) => {
        const {options, range} = entry;
        const lineText = document.lineAt(range.start.line).text;
        const containsEscape = lineText.includes('$$c[]') || lineText.includes('%{DOL}%');
        if(options.length === 0) {
            pushComponentDiagnostics(diagnostics, document, range,
                `String Select '${id}' expected at least 1 Option${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            );
        } else if(options.length > 25) {
            options.forEach(range => pushComponentDiagnostics(diagnostics, document, range,
                `String Select '${id}' expected up to 25 Options, got ${options.length}${containsEscape?"\n(This may be ignored if you know what you're doing)":''}`,
                containsEscape?vscode.DiagnosticSeverity.Information:vscode.DiagnosticSeverity.Error
            ));
        }
    });
}
