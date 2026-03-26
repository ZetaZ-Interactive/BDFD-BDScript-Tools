import functionsList from '../../assets/resources/functionList.js';
import {
    parseFunctions
} from '../completion/functions.js';
export const functions = parseFunctions(functionsList);
export const permissionList = [
    'addreactions','admin','attachfiles','ban','changenicknames',
    'connect','createinstantinvite','createprivatethreads','createpublicthreads',
    'embedlinks','externalemojis','externalstickers','kick','managechannels',
    'manageemojis','manageevents','managemessages','managenicknames','manageroles',
    'manageserver','managethreads','managewebhooks','mentioneveryone','moderatemembers',
    'movemembers','priorityspeaker','readmessagehistory','readmessages','requesttospeak',
    'sendmessages','sendmessagesinthreads','sendvoicemessages','slashcommands','speak',
    'stream','tts','usesoundboard','usevad','viewauditlog','viewguildinsights',
    'voicedeafen','voicemute'
]
