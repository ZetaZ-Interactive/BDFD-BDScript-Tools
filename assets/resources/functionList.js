/*
    głupie? głupie
    działa? działa
    jakiś problem?
*/
const beWise = /\$reset(Channel|Server|User)Var(?=\[|\b)/;
const keywords = /\$(if|elseif|else|endif|try|catch|error|endtry|async|endasync|await|stop|c|var)(?=\[|\b)/;
const operators = /\$(or|and)(?=\[|\b)/;
const constants = /\$(authorID|botOwnerID|botID|messageID|customID|serverOwner)(?=\b)(?!\[)/;
const events = /\$(awaitFunc|awaitReactions)(?=\[|\b)/
import functions from "./function_list.json" with {type:"json"};
functions.forEach(func => {
    if(func.tag.includes("$eval[BDScript source code]")) func.dangerous = true;
    if(func.tag.includes("$alternativeParsing")) {
        func.dangerous = true;
        func.experimental = true;
        func.shortDescription = "Changes the way how triggers are read."
    }
    if(beWise.test(func.tag)) func.beWise = true;
    if(keywords.test(func.tag)) func.kind = 13;
    if(operators.test(func.tag)) func.kind = 23;
    if(constants.test(func.tag)) func.kind = 20;
    if(events.test(func.tag)) func.kind = 22;
    if(func.tag.includes("$awaitReactions[\u003cCommand name;Reaction\u003e;...]")) func.arguments = [{"name":"Command name","description":"Awaited reaction command name","type":"String","required":true,"repeatable":true},{"name":"Reaction","type":"Emoji","required":true,"repeatable":true}];
    if(func.tag.includes("$checkContains[Text;...]")) {
        func.tag = "$checkContains[Text;Phrases;...]";
        func.arguments = [{"name":"Text","type":"String","required":true,"empty":true},{"name":"Phrases","type":"String","required":true,"empty":true,"repeatable":true}];
    }
    if(func.tag.includes("$editChannelPerms[Channel ID;User ID/RoleID;Permission;...]")) {
        func.arguments = [{"name":"Channel ID","type":"Snowflake","required":true},{"name":"User ID/RoleID","type":"Snowflake","required":true,"empty":true},{"name":"Permission","description":"Permission have to have a +, -, or / in front of it.","type":"Permission | String","required":true,"repeatable":true}]
    }
});
export default functions;
