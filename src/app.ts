import { Bot, ConsoleLogger, MemoryStorage, BotStateManager } from 'botbuilder';
import { BotFrameworkConnector } from 'botbuilder-services';
import { first, ifMatch, ifMessage, ActivityRouter, simpleRouter } from 'botbuilder-router';
import * as restify from "restify";

// Create server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create connector and listen to our servers '/api/messages' route.
const connector = new BotFrameworkConnector(process.env.MICROSOFT_APP_ID, process.env.MICROSOFT_APP_PASSWORD);
server.post('/api/messages', <any>connector.listen());

import lcs = require('longest-common-substring');
import { convertIngredient } from "./weightsAndMeasures";
// import { Recipe } from './recipe';
import { recipes } from './recipes';

declare global {
    interface ConversationState {
        recipe: Partial<Recipe>,
        lastInstructionSent: number,
        promptKey: string
}

const activityRouter = new ActivityRouter(first(
    ifMessage(context => {
        let count = context.state.conversation.count || 1;
        context.say(`${count}: You said "${context.request.text}"`);
        context.state.conversation.count = count + 1;
    }),
    // For non-message activities just echo back the activities type.
    context => { context.say(`[${context.request.type}]`); }
));

// Initialize bot by passing it a connector
// - Add a logger to monitor bot.
// - Add storage so that we can track conversation & user state.
// - Add a receiver to process incoming activities.
const bot = new Bot(connector)
    .use(new ConsoleLogger())
    .use(new MemoryStorage())
    .use(new BotStateManager())
    .onReceive((context) => activityRouter.receive(context));

