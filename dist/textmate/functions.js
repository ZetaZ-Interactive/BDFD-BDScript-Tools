import * as vscode from 'vscode';
import {
    functions
} from '../shared/sharedData.js';
function convertStyle(style) {
    switch(style) {
        case 1:
            return 'bold';
        case 2:
            return 'italic';
        case 3:
            return 'bold italic';
        default:
            return '';
    }
}
function decimalArgbToHexadecimalRgb(color) {
    return "#" + (color & 0xFFFFFF).toString(16).padStart(6, "0");
}
function getHighlight(highlightRule) {
    const highlight = {};
    ['defaultTextHighlight', 'numberHighlight', 'fallbackHighlight', 'semicolonHighlight'].forEach(key => {
        if(highlightRule[key]) {
            highlight[key] = {
                color: decimalArgbToHexadecimalRgb(highlightRule[key]?.color),
                fontStyle: convertStyle(highlightRule[key].style)
            };
        }
    });
    if(highlightRule.functionsHighlights) {
        for (const func in highlightRule.functionsHighlights) {
            const f = highlightRule.functionsHighlights[func];
            highlight[func] = {
                color: decimalArgbToHexadecimalRgb(f?.color),
                fontStyle: convertStyle(f.style)
            };
        }
    }
    return highlight;
}
function createFunctionRules(functions, highlightRules) {
    const functionHighlightRules = functions.map(func => ({
        scope: `functionsHighlights.${func.tagStart}.bdscript`,
        settings: {
            foreground: highlightRules?.[func.tagStart]?.color || highlightRules?.fallbackHighlight?.color || '#73faff',
            fontStyle: highlightRules?.[func.tagStart]?.fontStyle || highlightRules?.fallbackHighlight?.fontStyle || ''
        }
    }));
    return functionHighlightRules;
}
function createTextMateRules(codeHighlight) {
    const highlightRules = getHighlight(codeHighlight);
    const functionTextMateRules = createFunctionRules(functions, highlightRules);
    const defaultTextMateRules = [
        {
            "scope": "commentFallback.bdscript",
            "settings": {
                "foreground": `${highlightRules?.$c?.color || highlightRules?.fallbackHighlight?.color || '#ffff80'}`,
                "fontStyle": `${highlightRules?.$c?.fontStyle || highlightRules?.fallbackHighlight?.fontStyle || ''}`
            }
        },
        {
            "scope": "semicolonHighlight.bdscript",
            "settings": {
                "foreground": `${highlightRules?.semicolonHighlight?.color || '#ff484b'}`,
                "fontStyle": `${highlightRules?.semicolonHighlight?.fontStyle || ''}`
            }
        },
        {
            "scope": "numberHighlight.bdscript",
            "settings": {
                "foreground": `${highlightRules?.numberHighlight?.color || '#d19a66'}`, //#d19a66 // 4291926630
                "fontStyle": `${highlightRules?.numberHighlight?.fontStyle || ''}`
            }
        },
        {
            "scope": "defaultTextHighlight.bdscript",
            "settings": {
                "foreground": `${highlightRules?.defaultTextHighlight?.color || '#9be569'}`,
                "fontStyle": `${highlightRules?.defaultTextHighlight?.fontStyle || ''}`
            }
        }
    ];
    const textMateRules = [
        ...functionTextMateRules,
        ...defaultTextMateRules
    ];
    return textMateRules;
}
export async function updateCodeHighlight(codeHighlight) {
    const extensionTextMateRules = createTextMateRules(codeHighlight);
    const config = vscode.workspace.getConfiguration('editor');
    const existingRules = config.get('tokenColorCustomizations.textMateRules') || [];
    const filteredRules = existingRules.filter(textMateRule => !textMateRule.scope.includes('.bdscript'));
    const textMateRules = [...filteredRules, ...extensionTextMateRules];
    try {
        await config.update(
            'tokenColorCustomizations',
            {
                textMateRules: textMateRules
            },
            vscode.ConfigurationTarget.Global
        );
    } catch {}
}
