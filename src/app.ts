import { Bot, ConsoleLogger, MemoryStorage, BotStateManager } from 'botbuilder';
import { BotFrameworkConnector } from 'botbuilder-services';
import { NamedCallback, Predicate, RouterOrHandler, first, ifMatch, ifRegExp, ifMessage, ActivityRouter, simpleRouter } from 'botbuilder-router';
import { Prompts } from 'botbuilder-prompts';
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
import { Recipe, recipes, recipeFromName } from './recipe';

declare global {
    interface ConversationState {
        recipe: Partial<Recipe>,
        lastInstructionSent: number,
    }
}

const filters = {
    noRecipe: (context: BotContext) => !context.state.conversation.recipe,
    noInstructionsSent: (context: BotContext) => context.state.conversation.lastInstructionSent === undefined,
}

const intents = {
    instructions: {
        start: /(Let's start|Start|Let's Go|Go|I'm ready|Ready|OK|Okay)\.*/i,
        next: /(Next|What's next|next up|OK|okay|Go|Continue)/i,
        previous: /(go back|back up|previous)/i,
        repeat: /(what's that again|huh|say that again|please repeat that|repeat that|repeat)/i,
        restart: /(start over|start again|restart)/i
    },
    chooseRecipe: /I want to make (?:|a|some)*\s*(.+)/i,
    queryQuantity: /how (?:many|much) (.+)/i,
    askQuestion: /ask/i,
    askYorNQuestion: /yorn/i,
    askChoiceQuestion: /choice/i,
    all: /(.*)/i
}

const chooseRecipe = (context: BotContext, name: string) => {
    const recipe = recipeFromName(name);
    if (recipe) {
        context.state.conversation.recipe = recipe;

        [
            `Great, let's make ${name} which ${recipe.recipeYield.toLowerCase()}!`,
            "Here are the ingredients:",
            ... recipe.recipeIngredient,
            "Let me know when you're ready to go.",
        ].forEach((text) =>
            context.say(text).delay(1000)
        );
    } else {
        return context.say(`Sorry, I don't know how to make ${name}. Maybe one day you can teach me.`);
    }
}

const queryQuantity = (context: BotContext) => {
    const ingredientQuery =  context.getEntity('string', 0).split('');

    const ingredient = context.state.conversation.recipe.recipeIngredient
        .map<[string, number]>(i => [i, lcs(i.split(''), ingredientQuery).length])
        .reduce((prev, curr) => prev[1] >= curr[1] ? prev : curr)
        [0];

    context.say(ingredient);
}

const nextInstruction = (context: BotContext) => {
    const nextInstruction = context.state.conversation.lastInstructionSent + 1;
    if (nextInstruction < context.state.conversation.recipe.recipeInstructions.length)
        sayInstruction(context, nextInstruction);
    else
        context.say("That's it!");
}

const previousInstruction = (context: BotContext) => {
    const prevInstruction = context.state.conversation.lastInstructionSent - 1;
    if (prevInstruction >= 0)
        sayInstruction(context, prevInstruction); 
    else
        context.say("We're at the beginning.");
}

const sayInstruction = (context: BotContext, instruction: number) => {
    context.say(context.state.conversation.recipe.recipeInstructions[instruction]);
    if (context.state.conversation.recipe.recipeInstructions.length === instruction + 1)
        context.say("That's it!");
    context.state.conversation.lastInstructionSent = instruction;
}

const ifRegExps = (regexps: RegExp[], routerOrHandler: RouterOrHandler<BotContext>) =>
    first(
        ... regexps.map(regexp => ifRegExp(regexp, routerOrHandler))
    );

const activityRouter = new ActivityRouter(first(
    ifMessage(first(
        // If there is no recipe, we have to pick one
        ifMatch(filters.noRecipe, first(
            ifRegExp(intents.chooseRecipe, context => {
                chooseRecipe(context, context.getEntity('string', 0));
            }),
            ifRegExps([intents.queryQuantity, intents.instructions.start, intents.instructions.restart], context => {
                context.say("First please choose a recipe");
            }),
            context => {
                chooseRecipe(context, context.request.text);
            }
        )),

        // Now that we have a recipe, these can happen at any time
        ifRegExp(intents.queryQuantity, context => {
            queryQuantity(context);
        }), // TODO: conversions go here
    
        // If we haven't started listing instructions, wait for the user to tell us to start
        ifMatch(filters.noInstructionsSent, first(
            ifRegExps([intents.instructions.start, intents.instructions.next], context => {
                sayInstruction(context, 0);
            })
        ), first(
            ifRegExp(intents.instructions.next, nextInstruction),
            ifRegExp(intents.instructions.repeat, context => {
                sayInstruction(context, context.state.conversation.lastInstructionSent);
            }),
            ifRegExp(intents.instructions.previous, previousInstruction),
            ifRegExp(intents.instructions.restart, context => {
                sayInstruction(context, 0);
            }),
        )),

        context => { context.say("Honestly I have no idea what you're talking about."); }
    )),
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

