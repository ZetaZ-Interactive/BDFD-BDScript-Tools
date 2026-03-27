import * as vscode from 'vscode';
const cachedDocumentFlags = new WeakMap();
export function getCommentFlags(text) {
    const regex = /\$c\[([^\]]+)\]/g;
    const flags = [];
    let match;
    while ((match = regex.exec(text))) {
        flags.push(...match[1].split(';').map(f => f.trim()).filter(Boolean));
    }
    return flags;
}
export function getDocumentFlags(document) {
    if(cachedDocumentFlags.has(document)) return cachedDocumentFlags.get(document);
    const flags = getCommentFlags(document.getText());
    cachedDocumentFlags.set(document, flags);
    return flags;
}
export function docs(func, addTag, isCopy, isSignature) {
    const mkd = new vscode.MarkdownString();
    mkd.isTrusted = true;
    let docs = addTag?`**${func.fullTag}**\n\n${func.description}\n`:`${func.description}\n`;
    const functionTags = [];
    func.isDeprecated&&functionTags.push('⌛`Deprecated`');
    func.deprecatedFor&&functionTags.push(`Use \`${func.deprecatedFor}\` instead`);
    func.isPremium&&functionTags.push('💰 `Premium`');
    func.isDangerous&&functionTags.push('❗ `Dangerous`');
    func.isExperimental&&functionTags.push('📢 `Experiment`');
    func.beWise&&functionTags.push('🧙‍♂️ `Use this wisely!`');
    docs += functionTags.length?'\n'+functionTags.join('\n\n')+'\n':'';
    if (func.arguments.length && !isSignature) {
        docs += '\n**Arguments:**\n\n';
        func.arguments.forEach(arg => {
            const argumentType = argType(arg);
            const required = isRequired(arg);
            const emptiable = isEmptiable(arg);
            const repeatable = isRepeatable(arg);
            const desc = arg.description?`\n\n${arg.description}\n`:'';
            const enumVals = enumValues(arg);
            docs += `- \`${arg.name}\`: ${argumentType} ${required}${emptiable}${repeatable}${desc}${enumVals}\n`;
        });
    }
    docs += `\n[BDScript Reference](https://wiki.botdesignerdiscord.com/${func.isPremium?'premium':'bdscript'}/${func.name}${isCopy?'Complex':''}.html)`;
    mkd.appendMarkdown(docs);
    return mkd;
}
export function argType(arg) {
    return 'Type: ' + arg.type;
}
export function isRequired(arg) {
    return (arg.required?'(required)':'(optional)');
}
export function isEmptiable(arg) {
    return arg.empty?' (emptiable)':'';
}
export function isRepeatable(arg) {
    return arg.repeatable?' (repeatable)':'';
}
export function enumValues(arg) {
    return arg.enumData?`\n[${arg.enumData.join(', ')}]`:'';
}
vscode.workspace.onDidChangeTextDocument(event => {
    cachedDocumentFlags.delete(event.document);
});
