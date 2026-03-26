const functionRegex = /^(?:\$\$c\[\]|%\{DOL\}%)?\$[a-zA-Z_][a-zA-Z0-9_]*/;
const functionNormalize = /^\$\$c\[\]|^%\{DOL\}%/;
export function getActiveFunc(textBeforeCursor, advanced = false) {
    const funcRegex = advanced?functionRegex:/^\$[a-zA-Z_][a-zA-Z0-9_]*/;
    let nest = [];
    let i = 0;
    while(i < textBeforeCursor.length) {
        const curChar = textBeforeCursor[i];
        if(curChar === '$') {
            const match = textBeforeCursor.slice(i).match(funcRegex);
            if (match) {
                nest.push({ funcName: match[0].replace(functionNormalize, ''), bracketIndex: null });
                i += match[0].length;
                continue;
            }
        }
        if(curChar === '[') {
            for (let ii = nest.length - 1; ii >= 0; ii--) {
                if (nest[ii].bracketIndex === null) {
                    nest[ii].bracketIndex = i;
                    break;
                }
            }
        }
        if(curChar === ']') {
            for (let ii = nest.length - 1; ii >= 0; ii--) {
                if (nest[ii].bracketIndex !== null) {
                    nest.splice(ii, 1);
                    break;
                }
            }
        }
        i++;
    }
    for(let i = nest.length - 1; i >= 0; i--) {
        if(nest[i].bracketIndex !== null) return nest[i];
    }
    return null;
}
export function curArg(text) {
    let arg = 0;
    let depth = 0;
    for(const curChar of text) {
        if(curChar === '[') depth++;
        else if(curChar === ']') depth--;
        else if(curChar === ';' && depth === 1) arg++;
    }
    return arg;
}
