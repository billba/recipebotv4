import lcs = require('longest-common-substring');
import { convertIngredient } from "./weightsAndMeasures";
import { recipesRaw } from './recipes';

export interface Recipe {
    name: string,
    description: string,
    cookTime: string,
    cookingMethod: string;
    nutrition: NutritionInformation,
    prepTime: string,
    recipeCategory: string,
    recipeCuisine: string,
    recipeIngredient: string[],
    recipeInstructions: string[],
    recipeYield: string,
    suitableForDiet: string,
    totalTime: string
}

export interface NutritionInformation {
    calories: number,
    carbohydrateContent: number,
    cholesterolContent: number,
    fatContent: number,
    fiberContent: number,
    proteinContent: number,
    saturatedFatContent: number,
    servingSize: string,
    sodiumContent: number,
    sugarContent: number,
    transFatContent: number,
    unsaturatedFatContent: number
}


const chooseRecipe: Handler<R & IRegExpMatch> = match => {
    const name = match.groups[1];
    const recipe = recipeFromName(name);
    if (recipe) {
        match.store.dispatch<RecipeAction>({ type: 'Set_Recipe', recipe });

        return Observable.from([
            `Great, let's make ${name} which ${recipe.recipeYield.toLowerCase()}!`,
            "Here are the ingredients:",
            ... recipe.recipeIngredient,
            "Let me know when you're ready to go."
        ])
        .zip(Observable.timer(0, 1000), x => x) // Right now we're having trouble introducing delays
        .do(ingredient => match.reply(ingredient))
        .count();
    } else {
        return match.replyAsync(`Sorry, I don't know how to make ${name}. Maybe one day you can teach me.`);
    }
}

const queryQuantity: Handler<R & IRegExpMatch> = match => {
    const ingredientQuery = match.groups[1].split('');

    const ingredient = match.data.userInConversation.recipe.recipeIngredient
        .map<[string, number]>(i => [i, lcs(i.split(''), ingredientQuery).length])
        .reduce((prev, curr) => prev[1] > curr[1] ? prev : curr)
        [0];

    match.reply(ingredient);
}

const nextInstruction: Handler<R & IRegExpMatch> = match => {
    const nextInstruction = match.data.userInConversation.lastInstructionSent + 1;
    if (nextInstruction < match.data.userInConversation.recipe.recipeInstructions.length)
        sayInstruction({
            ... match,
            instruction: nextInstruction
        });
    else
        match.reply("That's it!");
}

const previousInstruction: Handler<R & IRegExpMatch> = match => {
    const prevInstruction = match.data.userInConversation.lastInstructionSent - 1;
    if (prevInstruction >= 0)
        sayInstruction({
            ... match,
            instruction: prevInstruction 
        });
    else
        match.reply("We're at the beginning.");
}

const sayInstruction: Handler<R & { instruction: number }> = match => {
    match.reply(match.data.userInConversation.recipe.recipeInstructions[match.instruction]);
    if (match.data.userInConversation.recipe.recipeInstructions.length === match.instruction + 1)
        match.reply("That's it!");
    store.dispatch<RecipeAction>({ type: 'Set_Instruction', instruction: match.instruction });
}

// const globalDefaultRule = defaultRule(reply("I can't understand you. It's you, not me. Get it together and try again."));

const recipeFromName = (name: string) =>
    recipes.find(recipe => recipe.name.toLowerCase() === name.toLowerCase());

const filters: {
    [index: string]: Predicate<R>
} = {
    noRecipe: match => !match.data.userInConversation.recipe,
    noInstructionsSent: match => match.data.userInConversation.lastInstructionSent === undefined,
}

// RegExp

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

// LUIS

import { LuisModel, LuisEntity } from 'prague';

const luis = new LuisModel('id', 'key', .5);

const recipeRule = first<R>(

    // Prompts
    prompts,

    // For testing Prompts
    re<R>(intents.askQuestion, match => {
        prompts.setPrompt(match, 'Favorite_Color');
        match.reply("What is your favorite color?");
    }),
    re<R>(intents.askYorNQuestion, match => {
        prompts.setPrompt(match, 'Like_Cheese');
        match.reply(createConfirm("Do you like cheese?"));
    }),
    re<R>(intents.askChoiceQuestion, match => {
        prompts.setPrompt(match, 'Favorite_Cheese');
        match.reply(createChoice("What is your favorite cheese?", cheeses));
    }),

    // For testing LUIS

    luis.best<R>({
        'singASong': match =>
            match.reply(`Let's sing ${match.entityValues('song')[0]}`),
        'findSomething': match =>
            match.reply(`Okay let's find a ${match.entityValues('what')[0]} in ${match.entityValues('where')[0]}`)
    }),

    // If there is no recipe, we have to pick one
    rule<R>(filters.noRecipe, first<R>(
        re<R>(intents.chooseRecipe, chooseRecipe),
        re<R>([intents.queryQuantity, intents.instructions.start, intents.instructions.restart], reply("First please choose a recipe")),
        re<R>(intents.all, chooseRecipe)
    )),

    // Now that we have a recipe, these can happen at any time
    re<R>(intents.queryQuantity, queryQuantity), // TODO: conversions go here

    // If we haven't started listing instructions, wait for the user to tell us to start
    rule<R>(filters.noInstructionsSent,
        re<R>([intents.instructions.start, intents.instructions.next], match => sayInstruction({ ... match, instruction: 0 }))
    ),

    // We are listing instructions. Let the user navigate among them.
    first<R>(
        re<R>(intents.instructions.next, nextInstruction),
        re<R>(intents.instructions.repeat, match => sayInstruction({ ... match, instruction: match.data.userInConversation.lastInstructionSent })),
        re<R>(intents.instructions.previous, previousInstruction),
        re<R>(intents.instructions.restart, match => sayInstruction({ ... match, instruction: 0 })),
    ),

    reply("Honestly I have no idea what you're talking about.")
);

recipeBotChat.run({
    message: recipeRule
});
