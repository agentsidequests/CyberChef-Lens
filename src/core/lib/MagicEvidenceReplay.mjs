import Recipe from "../Recipe.mjs";
import Dish from "../Dish.mjs";
import {isWorkerEnvironment} from "../Utils.mjs";

/**
 * Load native operation modules without executing input or charging module
 * initialization to the subsequent cooperative payload-evidence budget.
 * Startup has no hard deadline; callers must not call it a bounded wall time.
 *
 * @param {Object[][]} configs
 * @returns {Promise<void>}
 */
export async function prepareMagicRecipes(configs) {
    if (isWorkerEnvironment()) self.loadRequiredModules(configs.flat());
    await new Recipe([]).execute(new Dish());
}

/**
 * Replay one native recipe on complete input, preserving execution failure as
 * an error rather than mistaking the recipe's error message for decoded data.
 *
 * @author SamuelNotes
 * @license Apache-2.0
 * @param {Object[]} config
 * @param {ArrayBuffer|ArrayBufferView} input
 * @returns {Promise<ArrayBuffer>}
 */
export async function replayMagicRecipe(config, input) {
    const buffer = input instanceof ArrayBuffer ? input :
        new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice().buffer;
    if (!config.length) return buffer;
    if (isWorkerEnvironment()) self.loadRequiredModules(config);
    const dish = new Dish();
    dish.set(buffer, Dish.ARRAY_BUFFER);
    const recipe = new Recipe(config);
    await recipe.execute(dish);
    if (recipe.lastRunOp !== recipe.opList[recipe.opList.length - 1]) {
        throw new Error("Candidate recipe did not complete");
    }
    return dish.get(Dish.ARRAY_BUFFER);
}
