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

export const recipes: Partial<Recipe>[] = [
    {
      "name" : "Victoria Sponge",
      "prepTime" : "PT30M",
      "cookTime" : "PT30M",
      "recipeYield" : "Makes 12 slices",
      "description" : "This simplest of sponge cake recipes has a fresh berry and whipped cream filling that takes the classic Victoria sponge to new heights.",
      "recipeIngredient" : [
        "25g/8oz butter or margarine, softened at room temperature",
        "225g/8oz caster sugar",
        "4 medium eggs",
        "2 tsp vanilla extract",
        "225g/8oz self raising flour",
        "milk, to loosen"
      ],
      "recipeInstructions" : [
        "Preheat the oven to 180C/350F/Gas 4.",
        "Grease and line 2 x 18cm/7in cake tins with baking paper.",
        "Cream the butter and the sugar together in a bowl until pale and fluffy.",
        "Beat in the eggs, a little at a time, and stir in the vanilla extract.",
        "Fold in the flour using a large metal spoon, adding a little extra milk if necessary, to create a batter with a soft dropping consistency.",
        "Divide the mixture between the cake tins and gently spread out with a spatula.",
        "Bake for 20-25 minutes, or until golden-brown on top and a skewer inserted into the middle comes out clean.",
        "Remove from the oven and set aside for 5 minutes, then remove from the tin and peel off the paper. Place onto a wire rack.",
        "Sandwich the cakes together with jam, lemon curd or whipped cream and berries or just enjoy on its own."
      ]
    }
  ];

export const recipeFromName = (name: string) =>
    recipes.find(recipe => recipe.name.toLowerCase() === name.toLowerCase());

/*

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
*/