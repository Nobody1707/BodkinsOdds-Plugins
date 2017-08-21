//=============================================================================
// BodkinsOdds' Plugins - THAC0
// BOP_THAC0.js
//=============================================================================
var Imported = Imported || {};
Imported.BOP_THAC0 = "0.1.2";

/*:
 * @plugindesc Plugin to implement AD&D style to hit rolls using low AC and THAC0.
 * @author BodkinsOdds
 *
 * @param Body Armor Sets Base AC
 * @desc Sets whether armor in the body slot sets AC or
 * adds to it.
 * @default true
 *
 * @param Use THAC0
 * @desc Sets whether the game uses THAC0 or BAB.
 * @default true
 *
 * @param Unarmored AC
 * @desc AC to use when no armor is equipped.
 * @default 10
 *
 * @param Default Foe To Hit
 * @desc To Hit to use when not specified.
 * @default 20
 *
 * @param Default Foe AC
 * @desc AC to use when not specified.
 * @default 10
 *
 * @param Default Attack Rating
 * @desc Which attack rating to use when not specified.
 * @default strong
 *
 * @param Strong BAB Formula
 * @desc Formula for strong attack rating.
 * Variables: level
 * @default level - 1
 *
 * @param Average BAB Formula
 * @desc Formula for average attack rating.
 * Variables: level
 * @default Math.floor((level - 1) / 3) * 2
 *
 * @param Weak BAB Formula
 * @desc Formula for weak attack rating.
 * Variables: level
 * @default Math.floor((level - 1) / 2)
 *
 * @param Feeble BAB Formula
 * @desc Formula for feeble attack rating.
 * Variables: level
 * @default Math.floor((level - 1) / 3)
 *
 * @help THAC0 - 1d20 + Modifiers = Lowest AC Hit
 * THAC0 = 20 - BAB
 *
 * An actor or enemy's BAB or THAC0 is stored in its .toHit property.
 * Its AC is likewise stored in its .ac property.
 *
 *                        Default THAC0 per level
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
 * desired AC.
 *
 * Add <To Hit: %number%> or <AC: %number%> to an enemy's notes to set
 * their .toHit or .ac to %number%, respectively.
 *
 * TODO: Add hook for stat modifiers for actor AC.
 * TODO: Add custom to-hit calculation into the combat engine.
 * TODO: Clean up help section.
 */

(function() {
 "use strict";
 function boolFrom(parameter, defaultValue) {
     const string = String(parameter);
     const boolExpr = /\s*(true|false)\s*/i
     const match = string.match(boolExpr);
     return match ? match[1].toLowerCase() === "true" : defaultValue;
 }
 
 function numberFrom(parameter, defaultValue) {
     const string = String(parameter);
     const numberExpr = /\s*([+-]?\d+)\s*/
     const match = string.match(numberExpr);
     return match ? Number(match[1]) : defaultValue;
 }
 
 let parameters = PluginManager.parameters("BOP_THAC0");
 let settings = {};
 settings.isBodyBaseAc = boolFrom(parameters["Body Armor Sets Base AC"], true);
 settings.useThac0 = boolFrom(parameters["Use THAC0"], true);
 settings.unarmoredAc = numberFrom(parameters["Unarmored AC"], 10);
 settings.defaultFoeAc = numberFrom(parameters["Default Foe AC"], 10);
 settings.defaultFoeToHit = numberFrom(parameters["Default Foe To Hit"], settings.useThac0 ? 20 : 0);
 settings.defaultAttackRating = String(parameters["Default Attack Rating"]);
 settings.strongFormula = String(parameters["Strong BAB Formula"]);
 settings.averageFormula = String(parameters["Average BAB Formula"]);
 settings.weakFormula = String(parameters["Weak BAB Formula"]);
 settings.feebleFormula = String(parameters["Feeble BAB Formula"]);
 
 let bab = {};
 // Expression interpolation did not work for this. Any help here would be nice.
 bab["strong"] = Function("level", "return " + settings.strongFormula + ";");
 bab["average"] = Function("level", "return " + settings.averageFormula + ";");
 bab["weak"] = Function("level", "return " + settings.weakFormula + ";");
 bab["feeble"] = Function("level", "return " + settings.feebleFormula + ";");
 
 const acExpr = /<\s*AC\s*:\s*([+-]?\d+)\s*>/i;
 const toHitExpr = /<\s*To\s*Hit\s*:\s*([+-]?\d+)\s*>/i;
 let bodyArmorIsBaseAC = true;
 
 function processAttackRatingNotetags(classes) {
     const expression = /<\s*Attack\s*Rating\s*:\s*(strong|average|weak|feeble)\s*>/i;
     const defaultFormula = bab[settings.defaultAttackRating];
     // Why are these arrays 1 based? This caused me hours of grief!
     for (let i = 1, length = classes.length; i < length; i++) {
         let thisClass = classes[i];
         let match = thisClass.note.match(expression);
         thisClass.babFormula = match ? bab[match[1].toLowerCase()] : defaultFormula;
     }
 }
 
 function processArmorNotetags(armors) {
     for (let i = 1, length = armors.length; i < length; i++) {
         let armor = armors[i];
         let match = armor.note.match(acExpr);
         armor.ac = match ? Number(match[1]) : 0;
     }
 }
 
 function processEnemyNotetags(enemies) {
     for (let i = 1, length = enemies.length; i < length; i++) {
         let enemy = enemies[i];
         let match = enemy.note.match(toHitExpr);
         enemy.toHit = match ? Number(match[1]) : settings.defaultFoeToHit;
         match = enemy.note.match(acExpr);
         enemy.ac = match ? Number(match[1]) : settings.defaultFoeAc;
     }
 }
 
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
 Object.defineProperty(Game_Actor.prototype, "toHit", {
     get: function() {
         let bab = this.currentClass().babFormula(this.level);
         return settings.useThac0 ? 20 - bab : bab;
     }
 });
 
 // I'll add ability modifiers in a different plugin.
 Object.defineProperty(Game_Actor.prototype, "ac", {
     get: function() {
         let ac = settings.unarmoredAc;
         let bonus = 0;
         for (const armor of this.armors()) {
              // If armor is in the body slot.
              if (settings.isBodyBaseAc && armor.etypeId === 4) {
                  ac = armor.ac;
              } else {
                  bonus += armor.ac;
              }
         }
         return settings.useThac0 ? ac - bonus : ac + bonus;
     }
 });
})();
