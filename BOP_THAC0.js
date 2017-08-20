//=============================================================================
// BodkinsOdds' Plugins - THAC0
// BOP_THAC0.js
//=============================================================================
var Imported = Imported || {};
Imported.BOP_THAC0 = "0.0.1";

/*:
 * @plugindesc Plugin to implement AD&D style to hit rolls using low AC and THAC0.
 * @author BodkinsOdds
 * @help THAC0 - 1d20 + Modifiers = Lowest AC Hit
 *
 * Rating      THAC0 Formula
 * Strong      20 - (level - 1)
 * Average     20 - ⌊(level - 1) / 3⌋ * 2
 * Weak        20 - ⌊(level - 1) / 2⌋
 * Feeble      20 - ⌊(level - 1) / 3⌋
 *
 *                             THAC0 per level
 * Rating   1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
 * Strong  20 19 18 17 16 15 14 13 12 11 10  9  8  7  6  5  4  3  2  1
 * Average 20 20 20 18 18 18 16 16 16 14 14 14 12 12 12 10 10 10  8  8
 * Weak    20 20 19 19 18 18 17 17 16 16 15 15 14 14 13 13 12 12 11 11
 * Feeble  20 20 20 19 19 19 18 18 18 17 17 17 16 16 16 15 15 15 14 14
 *
 * To select which formula to use add <Attack Rating: %name%> to that
 * class's note where %name% is the name of the formula you wish to use.
 *
 * To set the AC of an armor add <AC: %number%> where %number is the
 * desired AC. If this armor is in the body slot then the AC will be the
 * actor's base AC. Otherwise it will be subtracted from the actor's base
 * AC.
 *
 * Add <THAC0: %number%> or AC: %number%> to an enemy's notetage to set
 * there THAC0 or AC to %number%, respectively.
 *
 * TODO: Make the THAC0 formulas into plugin parameters.
 * TODO: Make unarmored AC into a plugin parameter.
 * TODO: Make default enemy THAC0 & AC into plugin parameters.
 * TODO: Add hook for stat modifiers for actor AC.
 * MAYBE: Add support for 3.x style BAB and AC.
 */
 
(function() {
    "use strict";
    let thac0 = {};
    thac0["strong"] = function(level) { return 20 - (level - 1); };
    thac0["average"] = function(level) { return 20 - Math.floor((level - 1) / 3) * 2; };
    thac0["weak"] = function(level) { return 20 - Math.floor((level - 1) / 2); };
    thac0["feeble"] = function(level) { return 20 - Math.floor((level - 1) / 3); };

    function processAttackRatingNotetags(classes) {
        const expression = /<\s*Attack\s*Rating\s*:\s*(strong|average|weak|feeble)\s*>/i;
        // Why are these arrays 1 based? This caused me hours of grief!
        for (let i = 1, length = classes.length; i < length; i++) {
            let thisClass = classes[i];
            let match = thisClass.note.match(expression);
            thisClass.thac0Formula = match ? thac0[match[1].toLowerCase()] : thac0["strong"];
        }
    }

    function processArmorNotetags(armors) {
        const expression = /<\s*AC\s*:\s*(\d+)\s*>/i;
        for (let i = 1, length = armors.length; i < length; i++) {
            let armor = armors[i];
            let match = armor.note.match(expression);
            armor.ac = match ? Number(match[1]) : 0;
        }
    }

    function processEnemyNotetags(enemies) {
        const thac0Expr = /<\s*THAC0\s*:\s*(\d+)\s*>/i;
        const acExpr = /<\s*AC\s*:\s*(\d+)\s*>/i;
        for (let i = 1, length = enemies.length; i < length; i++) {
            let enemy = enemies[i];
            let match = enemy.note.match(thac0Expr);
            enemy.thac0 = match ? Number(match[1]) : 20;
            match = enemy.note.match(acExpr);
            enemy.ac = match ? Number(match[1]) : 10;
        }
    };

    let OldIsDatabaseLoaded = DataManager.isDatabaseLoaded;
    let processed = false;
    DataManager.isDatabaseLoaded = function () {
        if (!OldIsDatabaseLoaded.call(this)) { return false; }
        if (!processed) {
            processAttackRatingNotetags($dataClasses);
            processArmorNotetags($dataArmors);
            processEnemyNotetags($dataEnemies);
            processed = true;
        }
        return true;
    };

    // I couldn't find a cleaner way to add a computed property to a type I don't own.
    // If anyone has one, please let me know.
    Object.defineProperty(Game_Actor.prototype, "thac0", { 
        get: function() {
            return this.currentClass().thac0Formula(this.level);
        }
    });

    // I'll add ability modifiers in a different plugin.
    Object.defineProperty(Game_Actor.prototype, "ac", {
        get: function() {
            let ac = 10;
            let bonus = 0;
            for (const armor of this.armors()) {
                // If armor is in the body slot.
                if (armor.etypeId === 4) {
                    ac = armor.ac;
                } else {
                    bonus += armor.ac;
                }
            }
            return ac - bonus;
        }
    });
})();
