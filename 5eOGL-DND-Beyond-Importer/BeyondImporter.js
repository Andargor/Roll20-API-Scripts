/*
 * Version 0.3.7
 *
 * Made By Robin Kuiper
 * Skype: RobinKuiper.eu
 * Discord: Atheos#1095
 * Roll20: https://app.roll20.net/users/1226016/robin
 * Roll20 Thread: https://app.roll20.net/forum/post/6248700/script-beta-beyondimporter-import-dndbeyond-character-sheets
 * Github: https://github.com/RobinKuiper/Roll20APIScripts
 * Reddit: https://www.reddit.com/user/robinkuiper/
 * Patreon: https://patreon.com/robinkuiper
 * Paypal.me: https://www.paypal.me/robinkuiper
 *
 * Modified By Matt DeKok
 * Discord: Sillvva#2532
 * Roll20: https://app.roll20.net/users/494585/sillvva
 * Github: https://github.com/sillvva/Roll20-API-Scripts
 */

(function() {
    const _ABILITIES = {1:'STR',2:'DEX',3:'CON',4:'INT',5:'WIS',6:'CHA'};
    const _ABILITY = {'STR': 'strength', 'DEX': 'dexterity', 'CON': 'constitution', 'INT': 'intelligence', 'WIS': 'wisdom', 'CHA': 'charisma'}
    const alignments = ['','Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];
    const skills = ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'];
    const strength_skills = ['athletics'];
    const dexterity_skills = ['acrobatics', 'sleight of hand', 'stealth'];
    const intelligence_skills = ['arcana','history','investigation','nature','religion'];
    const wisdom_skills = ['animal_handling','medicine','perception','survival'];
    const charisma_skills = ['deception','intimidation','performance','persuasion']

    var class_spells = [];
    var beyond_caller = {};
    var object;

    // Styling for the chat responses.
    const style = "margin-left: -45px; overflow: hidden; background-color: #fff; border: 1px solid #000; padding: 5px; border-radius: 5px;";
    const buttonStyle = "background-color: #000; border: 1px solid #292929; border-radius: 3px; padding: 5px; color: #fff; text-align: center; float: right;"

    var jack = '0';

    const script_name = 'BeyondImporter';
    const state_name = 'BEYONDIMPORTER';
    const debug = false;

    on('ready', function() {
        checkInstall();
        log(script_name + ' Ready! Command: !beyond');
        if(debug) { sendChat(script_name, script_name + ' Ready!', null, {noarchive:true}); }
    });

    on('chat:message', function(msg) {
        if (msg.type != 'api') return;

        // Split the message into command and argument(s)
        var args = msg.content.split(/ --(help|reset|config|imports|import) ?/g);
        var command = args.shift().substring(1).trim();

        beyond_caller = getObj('player', msg.playerid);

        if (command == 'beyond') {
            var importData = '';
            if(args.length < 1) { sendHelpMenu(beyond_caller); return; }

            var initTiebreaker = state[state_name][beyond_caller.id].config.initTieBreaker;
            var languageGrouping = state[state_name][beyond_caller.id].config.languageGrouping;

            for(var i = 0; i < args.length; i+=2) {
                var k = args[i].trim();
                var v = args[i+1] != null ? args[i+1].trim() : null;

                switch(k) {
                    case 'help':
                        sendHelpMenu(beyond_caller);
                        return;

                    case 'reset':
                        state[state_name][beyond_caller] = {};
                        setDefaults(true);
                        sendConfigMenu(beyond_caller);
                        return;

                    case 'config':
                        if(args.length > 0){
                            var setting = v.split('|');
                            var key = setting.shift();
                            var value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : (setting[0] === '[NONE]') ? '' : setting[0];

                            if(key === 'prefix' && value.charAt(0) !== '_' && value.length > 0) { value = value + ' ';}
                            if(key === 'suffix' && value.charAt(0) !== '_' && value.length > 0) { value = ' ' + value}

                            state[state_name][beyond_caller.id].config[key] = value;
                        }

                        sendConfigMenu(beyond_caller);
                        return;

                    case 'imports':
                        if(args.length > 0){
                            var setting = v.split('|');
                            var key = setting.shift();
                            var value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : (setting[0] === '[NONE]') ? '' : setting[0];

                            state[state_name][beyond_caller.id].config.imports[key] = value;
                        }

                        sendConfigMenu(beyond_caller);
                        return;

                    case 'import':
                        importData = v;
                        break;

                    default:
                        sendHelpMenu(beyond_caller);
                        return;
                }
            }

            if(importData != '') {
                var json = importData;
                var character = JSON.parse(json).character;

                class_spells = [];
                all_attributes = {};

                object = null;
                // Remove characters with the same name if overwrite is enabled.
                if(state[state_name][beyond_caller.id].config.overwrite) {
                    var objects = findObjs({
                        _type: "character",
                        name: state[state_name][beyond_caller.id].config.prefix + character.name + state[state_name][beyond_caller.id].config.suffix
                    }, {caseInsensitive: true});

                    if(objects.length > 0) {
                        object = objects[0];
                        for(var i = 1; i < objects.length; i++){
                            objects[i].remove();
                        }
                    }
                }

                if(!object) {
                    // Create character object
                    object = createObj("character", {
                        name: character.name + state[state_name][beyond_caller.id].config.prefix,
                        inplayerjournals: playerIsGM(msg.playerid) ? state[state_name][beyond_caller.id].config.inplayerjournals : msg.playerid,
                        controlledby: playerIsGM(msg.playerid) ? state[state_name][beyond_caller.id].config.controlledby : msg.playerid
                    });
                }

                // Make Speed String
                var weightSpeeds = character.race.weightSpeeds;

                var speedMods = getObjects(character, 'subType', 'speed');
                if(speedMods != null) {
                    speedMods.forEach(function(speedMod) {
                        if(speedMod.type == 'set') {
                            weightSpeeds.normal.walk = (speedMod.value > weightSpeeds.normal.walk ? speedMod.value : weightSpeeds.normal.walk);
                        }
                    });
                }

                speedMods = getObjects(character, 'subType', 'innate-speed-flying');
                if(speedMods != null) {
                    speedMods.forEach(function(speedMod) {
                        if(speedMod.type == 'set' && speedMod.id.indexOf('spell') == -1) {
                            if(speedMod.value == null) speedMod.value = weightSpeeds.normal.walk;
                            weightSpeeds.normal.fly = (speedMod.value > weightSpeeds.normal.fly ? speedMod.value : weightSpeeds.normal.fly);
                        }
                    });
                }

                speedMods = getObjects(character, 'subType', 'innate-speed-swimming');
                if(speedMods != null) {
                    speedMods.forEach(function(speedMod) {
                        if(speedMod.type == 'set' && speedMod.id.indexOf('spell') == -1) {
                            if(speedMod.value == null) speedMod.value = weightSpeeds.normal.walk;
                            weightSpeeds.normal.swim = (speedMod.value > weightSpeeds.normal.swim ? speedMod.value : weightSpeeds.normal.swim);
                        }
                    });
                }

                speedMods = getObjects(character, 'subType', 'innate-speed-climbing');
                if(speedMods != null) {
                    speedMods.forEach(function(speedMod) {
                        if(speedMod.type == 'set' && speedMod.id.indexOf('spell') == -1) {
                            if(speedMod.value == null) speedMod.value = weightSpeeds.normal.walk;
                            weightSpeeds.normal.climb = (speedMod.value > weightSpeeds.normal.climb ? speedMod.value : weightSpeeds.normal.climb);
                        }
                    });
                }

                speedMods = getObjects(character, 'subType', 'unarmored-movement');
                if(speedMods != null) {
                    speedMods.forEach(function(speedMod) {
                        if(speedMod.type == 'bonus') {
                            speedMod.value = isNaN(weightSpeeds.normal.walk + speedMod.value) ? 0 : speedMod.value;
                            weightSpeeds.normal.walk += speedMod.value;
                            if(weightSpeeds.normal.fly > 0) weightSpeeds.normal.fly += speedMod.value;
                            if(weightSpeeds.normal.swim > 0) weightSpeeds.normal.swim += speedMod.value;
                            if(weightSpeeds.normal.climb > 0) weightSpeeds.normal.climb += speedMod.value;
                        }
                    });
                }

                speedMods = getObjects(character, 'subType', 'speed');
                if(speedMods != null) {
                    speedMods.forEach(function(speedMod) {
                        if(speedMod.type == 'bonus') {
                            speedMod.value = isNaN(weightSpeeds.normal.walk + speedMod.value) ? 0 : speedMod.value;
                            weightSpeeds.normal.walk += speedMod.value;
                            if(weightSpeeds.normal.fly > 0) weightSpeeds.normal.fly += speedMod.value;
                            if(weightSpeeds.normal.swim > 0) weightSpeeds.normal.swim += speedMod.value;
                            if(weightSpeeds.normal.climb > 0) weightSpeeds.normal.climb += speedMod.value;
                        }
                    });
                }

                var speed = weightSpeeds.normal.walk + 'ft.';
                for(var key in weightSpeeds.normal){
                    if(key !== 'walk' && weightSpeeds.normal[key] !== 0){
                        speed += ', ' + key + ' ' + weightSpeeds.normal[key] + 'ft.';
                    }
                }

                // Import Character Inventory
                var hasArmor = false;
                if(state[state_name][beyond_caller.id].config.imports.inventory) {
                    const inventory = character.inventory;
                    var prevAdded = [];
                    if(inventory != null) inventory.forEach(function(item, i) {
                        var paIndex = prevAdded.filter(function(pAdded) { return pAdded == item.definition.name; }).length;
                        var row = getRepeatingRowIds('inventory', 'itemname', item.definition.name, paIndex);
                        prevAdded.push(item.definition.name);

                        var attributes = {};
                        attributes["repeating_inventory_"+row+"_itemname"] = item.definition.name;
                        attributes["repeating_inventory_"+row+"_equipped"] = (item.equipped) ? '1' : '0';
                        attributes["repeating_inventory_"+row+"_itemcount"] = item.quantity;
                        attributes["repeating_inventory_"+row+"_itemweight"] = item.definition.weight / item.definition.bundleSize;
                        attributes["repeating_inventory_"+row+"_itemcontent"] = replaceChars(item.definition.description);
                        var _itemmodifiers = 'Item Type: ' + item.definition.type;
                        if(typeof item.definition.damage === 'object' && item.definition.type !== 'Ammunition'){
                            var properties = '';
                            var finesse = false;
                            for(var j = 0; j < item.definition.properties.length; j++){
                                properties += item.definition.properties[j].name + ', ';
                                //if(item.definition.properties[j].name === 'Finesse'){ finesse = true }
                            }
                            attributes["repeating_inventory_"+row+"_itemproperties"] = properties;
                            attributes["repeating_inventory_"+row+"_hasattack"] = '0';
                            _itemmodifiers = 'Item Type: ' + item.definition.attackType + ' ' + item.definition.filterType + (item.definition.damage != null ? ', Damage: ' + item.definition.damage.diceString : '') + ', Damage Type: ' + item.definition.damageType + ', Range: ' + item.definition.range + '/' + item.definition.longRange;

                            var magic = 0;
                            item.definition.grantedModifiers.forEach(function(grantedMod) {
                                if(grantedMod.type == 'bonus' && grantedMod.subType == 'magic') {
                                    magic += grantedMod.value;
                                }
                            });

                            // Finesse Weapon
                            var isFinesse = item.definition.properties.filter(function(property) { return property.name == 'Finesse'; }).length > 0;
                            if(isFinesse && getTotalAbilityScore(character, 2) > getTotalAbilityScore(character, item.definition.attackType)) {
                                item.definition.attackType = 2;
                            }

                            // Hexblade's Weapon
                            var characterValues = getObjects(character.characterValues, 'valueId', item.id);
                            characterValues.forEach(function(cv) {
                                if(cv.typeId == 29 && getTotalAbilityScore(character, 6) >= getTotalAbilityScore(character, item.definition.attackType)) {
                                    item.definition.attackType = 6;
                                }
                            });

                            // CREATE ATTACK
                            var attack = {
                                name: item.definition.name,
                                range: item.definition.range + '/' + item.definition.longRange,
                                attack: {
                                    attribute: _ABILITY[_ABILITIES[item.definition.attackType]]
                                },
                                damage: {
                                    diceString: item.definition.damage != null ? item.definition.damage.diceString : '',
                                    type: item.definition.damageType,
                                    attribute: _ABILITY[_ABILITIES[item.definition.attackType]]
                                },
                                description: replaceChars(item.definition.description),
                                magic: magic
                            };

                            item.definition.grantedModifiers.forEach(function(grantedMod) {
                                if(grantedMod.type == 'damage') {
                                    if(grantedMod.dice != null) {
                                        attack.damage2 = {
                                            diceString: grantedMod.dice.diceString,
                                            type: grantedMod.friendlySubtypeName,
                                            attribute: grantedMod.statId == null ? '0' : _ABILITY[_ABILITIES[grantedMod.statId]]
                                        };
                                    }
                                }
                            });

                            var repAttack = createRepeatingAttack(object, attack, {index: paIndex, itemid: row});
                            Object.assign(all_attributes, repAttack);
                            // /CREATE ATTACK
                        }
                        item.definition.grantedModifiers.forEach(function(grantedMod) {
                            for(var abilityId in _ABILITIES) {
                                var ABL = _ABILITIES[abilityId];
                                if(grantedMod.type == 'set' && grantedMod.subType == _ABILITY[ABL]+'-score') {
                                    _itemmodifiers += ', '+ucFirst(_ABILITY[ABL])+': '+grantedMod.value;
                                }
                            }
                            if(grantedMod.type == 'bonus' && (grantedMod.subType == 'unarmored-armor-class' || grantedMod.subType == 'armor-class')) {
                                if(grantedMod.subType == 'armor-class') {
                                    hasArmor = true;
                                }
                                if(item.definition.hasOwnProperty('armorClass')) {
                                    item.definition.armorClass += grantedMod.value;
                                }
                                else {
                                    _itemmodifiers += ', AC +' + grantedMod.value;
                                }
                            }
                            if(grantedMod.type == 'set' && (grantedMod.subType == 'unarmored-armor-class' || grantedMod.subType == 'armor-class')) {
                                if(grantedMod.subType == 'armor-class') {
                                    hasArmor = true;
                                }
                                _itemmodifiers += ', AC: ' + grantedMod.value;
                            }
                            if(grantedMod.type == 'bonus' && (grantedMod.subType == 'saving-throws')) {
                                _itemmodifiers += ', Saving Throws +' + grantedMod.value;
                            }
                        });
                        if(item.definition.hasOwnProperty('armorClass')){
                            _itemmodifiers += ', AC: ' + item.definition.armorClass;
                            hasArmor = true;
                        }
                        attributes["repeating_inventory_"+row+"_itemmodifiers"] = _itemmodifiers;
                        Object.assign(all_attributes, attributes);
                    });
                }

                // If character has unarmored defense, add it to the inventory, so a player can enable/disable it.
                var unarmored = getObjects(character, 'subType', 'unarmored-armor-class');
                var x = 0;
                if(unarmored != null) unarmored.forEach(function(ua, i) {
                    if(ua.type != 'set') return;
                    if(ua.value == null) {
                        ua.value = Math.floor((getTotalAbilityScore(character, ua.statId) - 10) / 2);
                    }

                    var row = getRepeatingRowIds('inventory', 'itemname', 'Unarmored Defense')[x];

                    var attributes = {}
                    attributes["repeating_inventory_"+row+"_itemname"] = 'Unarmored Defense';
                    attributes["repeating_inventory_"+row+"_equipped"] = !hasArmor ? '1' : '0';
                    attributes["repeating_inventory_"+row+"_itemcount"] = 1;
                    attributes["repeating_inventory_"+row+"_itemmodifiers"] = 'AC: '+ua.value;
                    Object.assign(all_attributes, attributes);

                    x++;
                });

                // Languages
                if(state[state_name][beyond_caller.id].config.imports.languages) {
                    var languages = getObjects(character, 'type', 'language');
                    if(languageGrouping) {
                        var langs = [];
                        if(languages != null) {
                            languages.forEach(function(language) {
                                langs.push(language.friendlySubtypeName);
                            });
                        }

                        var row = getRepeatingRowIds('proficiencies', 'prof_type', 'LANGUAGE')[0];

                        var attributes = {};
                        attributes["repeating_proficiencies_"+row+"_name"] = langs.join(', ');
                        attributes["repeating_proficiencies_"+row+"_prof_type"] = 'LANGUAGE';
                        attributes["repeating_proficiencies_"+row+"_options-flag"] = '0';

                        Object.assign(all_attributes, attributes);
                    }
                    else {
                        if(languages != null) {
                            languages.forEach(function(language) {
                                var row = getRepeatingRowIds('proficiencies', 'name', language.friendlySubtypeName)[0];
                                var attributes = {};
                                attributes["repeating_proficiencies_"+row+"_name"] = language.friendlySubtypeName;
                                attributes["repeating_proficiencies_"+row+"_prof_type"] = 'LANGUAGE';
                                attributes["repeating_proficiencies_"+row+"_options-flag"] = '0';

                                Object.assign(all_attributes, attributes);
                            });
                        }
                    }
                }

                // Import Proficiencies
                const weapons = ['Club', 'Dagger', 'Greatclub', 'Handaxe', 'Javelin', 'Light hammer', 'Mace', 'Quarterstaff', 'Sickle', 'Spear', 'Crossbow, Light', 'Dart', 'Shortbow', 'Sling', 'Battleaxe', 'Flail', 'Glaive', 'Greataxe', 'Greatsword', 'Halberd', 'Lance', 'Longsword', 'Maul', 'Morningstar', 'Pike', 'Rapier', 'Scimitar', 'Shortsword', 'Trident', 'War pick', 'Warhammer', 'Whip', 'Blowgun', 'Crossbow, Hand', 'Crossbow, Heavy', 'Longbow', 'Net'];
                var proficiencies = getObjects(character, 'type', 'proficiency');
                var profs = [];
                if(proficiencies != null) {
                    proficiencies.forEach(function(prof) {
                        var skill = prof.subType.replace(/-/g, '_');
                        if(skills.includes(skill)){
                            var attributes = {}
                            attributes[skill + '_prof'] = '(@{pb}*@{'+skill+'_type})';
                            Object.assign(all_attributes, attributes);
                        }
                        else if(state[state_name][beyond_caller.id].config.imports.proficiencies) {
                            if(profs.indexOf(prof.friendlySubtypeName) !== -1) return;
                            profs.push(prof.friendlySubtypeName);

                            var row = getRepeatingRowIds('proficiencies', 'name', prof.friendlySubtypeName)[0];

                            var attributes = {}
                            attributes["repeating_proficiencies_" + row + "_name"] = prof.friendlySubtypeName;
                            attributes["repeating_proficiencies_" + row + "_prof_type"] = (prof.subType.includes('weapon') || weapons.includes(prof.friendlySubtypeName)) ? 'WEAPON' : (prof.subType.includes('armor') || prof.subType.includes('shield')) ? 'ARMOR' : 'OTHER';
                            attributes["repeating_proficiencies_" + row + "_options-flag"] = '0';

                            Object.assign(all_attributes, attributes);
                        }
                    });
                }

                if(state[state_name][beyond_caller.id].config.imports.traits) {
                    // Background Feature
                    if(character.background.definition != null) {
                        var btrait = {
                            name: character.background.definition.featureName,
                            description: replaceChars(character.background.definition.featureDescription),
                            source: 'Background',
                            source_type: character.background.definition.name
                        }

                        var attrs = createRepeatingTrait(object, btrait);
                        Object.assign(all_attributes, attrs);
                    }
                    // Custom Background Feature
                    if(character.background.customBackground.name != null) {
                        var btrait = {
                            name: character.background.customBackground.featuresBackground.featureName,
                            description: replaceChars(character.background.customBackground.featuresBackground.featureDescription),
                            source: 'Background',
                            source_type: character.background.customBackground.name
                        };

                        var attrs = createRepeatingTrait(object, btrait);
                        Object.assign(all_attributes, attrs);
                    }
                    // Feats
                    character.feats.forEach(function(feat, fi) {
                        var t = {
                            name: feat.definition.name,
                            description: replaceChars(feat.definition.description),
                            source: 'Feat',
                            source_type: feat.definition.name
                        };

                        var attrs = createRepeatingTrait(object, t, fi);
                        Object.assign(all_attributes, attrs);
                    });
                    // Race Features
                    if(character.race.racialTraits != null) {
                        var ti = 0;
                        character.race.racialTraits.forEach(function(trait) {
                            if(['Languages', 'Darkvision', 'Superior Darkvision', 'Skills', 'Ability Score Increase', 'Feat', 'Age', 'Alignment', 'Size', 'Speed', 'Skill Versatility', 'Dwarven Combat Training', 'Keen Senses', 'Elf Weapon Training', 'Extra Language', 'Tool Proficiency'].indexOf(trait.definition.name) !== -1) {
                                return;
                            }

                            var description = '';
                            if(trait.options != null) {
                                trait.options.forEach(function(option) {
                                    description += option.name + '\n';
                                    description += (option.description !== '') ? option.description + '\n\n' : '\n';
                                });
                            }

                            description += trait.definition.description;

                            var t = {
                                name: trait.definition.name,
                                description: replaceChars(description),
                                source: 'Race',
                                source_type: character.race.fullName
                            };

                            var attrs = createRepeatingTrait(object, t, ti);
                            Object.assign(all_attributes, attrs);

                            var spells = getFeatureSpells(character, trait.id, 'race');
                            spells.forEach(function(spell) {
                                spell.spellCastingAbility = _ABILITIES[spell.spellCastingAbilityId];
                                class_spells.push(spell);
                            });

                            ti++;
                        });
                    }
                }

                // Handle (Multi)Class Features
                var multiclass_level = 0;
                var total_level = 0;
                if(state[state_name][beyond_caller.id].config.imports.classes) {
                    character.classes.forEach(function(current_class, i) {
                        total_level += current_class.level;

                        if(!current_class.isStartingClass){
                            var multiclasses = {};
                            multiclasses['multiclass'+i+'_flag'] = '1';
                            multiclasses['multiclass'+i+'_lvl'] = current_class.level;
                            multiclasses['multiclass'+i] = current_class.definition.name.toLowerCase();
                            multiclasses['multiclass'+i+'_subclass'] = current_class.subclassDefinition == null ? '' : current_class.subclassDefinition.name;
                            Object.assign(all_attributes, multiclasses);

                            multiclass_level += current_class.level;
                        }

                        // Set Pact Magic as class resource
                        if(current_class.definition.name.toLowerCase() === 'warlock'){
                            var attributes = {}
                            attributes['other_resource_name'] = 'Pact Magic';
                            attributes['other_resource_max'] = getPactMagicSlots(current_class.level);
                            attributes['other_resource'] = getPactMagicSlots(current_class.level);
                            Object.assign(all_attributes, attributes);
                        }

                        if(state[state_name][beyond_caller.id].config.imports.class_traits){
                            var ti = 0;
                            current_class.definition.classFeatures.forEach(function(trait) {
                                if(['Spellcasting', 'Divine Domain', 'Ability Score Improvement', 'Bonus Cantrip', 'Proficiencies', 'Hit Points', 'Arcane Tradition', 'Otherworldly Patron', 'Pact Magic', 'Expanded Spell List', 'Ranger Archetype', 'Druidic', 'Druid Circle', 'Sorcerous Origin', 'Monastic Tradition', 'Bardic College', 'Expertise', 'Roguish Archetype', 'Sacred Oath', 'Oath Spells', 'Martial Archetype'].indexOf(trait.name) !== -1) {
                                    return;
                                }
                                if(trait.requiredLevel > current_class.level) return;

                                if(trait.name.includes('Jack')){
                                    jack = '@{jack}';
                                }

                                var description = '';

                                description += trait.description;

                                var t = {
                                    name: trait.name,
                                    description: replaceChars(description),
                                    source: 'Class',
                                    source_type: current_class.definition.name
                                };

                                Object.assign(all_attributes, createRepeatingTrait(object, t, ti));

                                var spells = getFeatureSpells(character, trait.id, 'class');
                                spells.forEach(function(spell) {
                                    spell.spellCastingAbility = _ABILITIES[spell.spellCastingAbilityId];
                                    class_spells.push(spell);
                                });

                                if(trait.name == 'Metamagic') {
                                    character.choices.class.forEach(function(option) {
                                        if(option.type == 3 && (option.optionValue >= 106 && option.optionValue <= 113)) {
                                            var item = getObjects(option.options, 'id', option.optionValue);

                                            if(item.length > 0) {
                                                item = item[0];
                                                var o = {
                                                    name: item.label,
                                                    description: item.description,
                                                    source: 'Class',
                                                    source_type: current_class.definition.name
                                                };

                                                Object.assign(all_attributes, createRepeatingTrait(object, o));
                                            }
                                        }
                                    });
                                }

                                ti++;
                            });

                            if(current_class.subclassDefinition != null) {
                                var ti = 0;
                                current_class.subclassDefinition.classFeatures.forEach(function(trait) {
                                    if(['Spellcasting', 'Bonus Proficiency', 'Divine Domain', 'Ability Score Improvement', 'Bonus Cantrip', 'Proficiencies', 'Hit Points', 'Arcane Tradition', 'Otherworldly Patron', 'Pact Magic', 'Expanded Spell List', 'Ranger Archetype', 'Druidic', 'Druid Circle', 'Sorcerous Origin', 'Monastic Tradition', 'Bardic College', 'Expertise', 'Roguish Archetype', 'Sacred Oath', 'Oath Spells', 'Martial Archetype'].indexOf(trait.name) !== -1) {
                                        return;
                                    }
                                    if(trait.requiredLevel > current_class.level) return;

                                    if(trait.name.includes('Jack')){
                                        jack = '@{jack}';
                                    }

                                    var description = '';

                                    description += trait.description;

                                    var t = {
                                        name: trait.name,
                                        description: replaceChars(description),
                                        source: 'Class',
                                        source_type: current_class.definition.name
                                    }

                                    Object.assign(all_attributes, createRepeatingTrait(object, t, ti));

                                    var spells = getFeatureSpells(character, trait.id, 'class');
                                    spells.forEach(function(spell) {
                                        spell.spellCastingAbility = _ABILITIES[spell.spellCastingAbilityId];
                                        class_spells.push(spell);
                                    });

                                    ti++;
                                });
                            }
                        }

                        // Class Spells
                        if(state[state_name][beyond_caller.id].config.imports.class_spells){
                            for(var i in character.classSpells) {
                                var spells = character.classSpells[i];
                                if(character.classSpells[i].characterClassId == current_class.id) {
                                    character.classSpells[i].spells.forEach(function(spell) {
                                        spell.spellCastingAbility = _ABILITIES[current_class.definition.spellCastingAbilityId];
                                        class_spells.push(spell);
                                    });
                                }
                            }
                        }
                    });
                }

                if(character.spells.race.length > 0) {
                    var spells = character.spells.race;
                    spells.forEach(function(spell) {
                        spell.spellCastingAbility = _ABILITIES[spell.spellCastingAbilityId];
                        class_spells.push(spell);
                    });
                }

                var proficiencies = getObjects(character, 'type', 'proficiency');
                skills.forEach(function(skill) {
                    var skill_prof = getObjects(proficiencies, 'subType', skill.replace(/_/g, '-'));
                    if(skill_prof.length == 0) {
                        var hpModifiers = getObjects(character.modifiers.class, 'type', 'half-proficiency');
                        var hprModifiers = getObjects(character.modifiers.class, 'type', 'half-proficiency-round-up');
                        if(hprModifiers.length > 0) {
                            hprModifiers.forEach(function(modifier) {
                                if(
                                    modifier.subType == 'ability-checks'
                                    || (modifier.subType == 'strength-ability-checks' && strength_skills.indexOf(skill) !== -1)
                                    || (modifier.subType == 'dexterity-ability-checks' && dexterity_skills.indexOf(skill) !== -1)
                                    || (modifier.subType == 'intelligence-ability-checks' && intelligence_skills.indexOf(skill) !== -1)
                                    || (modifier.subType == 'wisdom-ability-checks' && wisdom_skills.indexOf(skill) !== -1)
                                    || (modifier.subType == 'charisma-ability-checks' && charisma_skills.indexOf(skill) !== -1)
                                ) {
                                    var attributes = {};
                                    attributes[skill + "_flat"] = Math.ceil((Math.floor((total_level - 1) / 4) + 2) / 2);
                                    Object.assign(all_attributes, attributes);
                                }
                            });
                        }
                        else if(hpModifiers.length > 0) {
                            hpModifiers.forEach(function(modifier) {
                                if(
                                    modifier.subType == 'ability-checks'
                                    || (modifier.subType == 'strength-ability-checks' && strength_skills.indexOf(skill) !== -1)
                                    || (modifier.subType == 'dexterity-ability-checks' && dexterity_skills.indexOf(skill) !== -1)
                                    || (modifier.subType == 'intelligence-ability-checks' && intelligence_skills.indexOf(skill) !== -1)
                                    || (modifier.subType == 'wisdom-ability-checks' && wisdom_skills.indexOf(skill) !== -1)
                                    || (modifier.subType == 'charisma-ability-checks' && charisma_skills.indexOf(skill) !== -1)
                                ) {
                                    var attributes = {};
                                    attributes[skill + "_flat"] = Math.floor((Math.floor((total_level - 1) / 4) + 2) / 2);
                                    Object.assign(all_attributes, attributes);
                                }
                            });
                        }
                    }
                });

                var hpModifiers = getObjects(character.modifiers.class, 'type', 'half-proficiency');
                var hprModifiers = getObjects(character.modifiers.class, 'type', 'half-proficiency-round-up');
                if(hprModifiers.length > 0) {
                    hprModifiers.forEach(function(modifier) {
                        if(modifier.subType == 'initiative') {
                            var attributes = {};
                            attributes["initmod"] = Math.ceil((Math.floor((total_level - 1) / 4) + 2) / 2);
                            Object.assign(all_attributes, attributes);
                        }
                    });
                }
                else if(hpModifiers.length > 0) {
                    hpModifiers.forEach(function(modifier) {
                        if(modifier.subType == 'initiative') {
                            var attributes = {};
                            attributes["initmod"] = Math.floor((Math.floor((total_level - 1) / 4) + 2) / 2);
                            Object.assign(all_attributes, attributes);
                        }
                    });
                }

                // Expertise
                var exp = getObjects(character, 'type', 'expertise');
                for(var i in exp) {
                    var expertise = exp[i];
                    var attributes = {};
                    var type = expertise.subType.replace(/-/g, '_');
                    if(skills.includes(type)){
                        attributes[type + '_type'] = "2";
                    }

                    if(expertise.subType === 'thieves-tools') {
                        var row = getRepeatingRowIds('proficiencies', 'name', expertise.friendlySubtypeName)[0];

                        var attributes = {}
                        attributes["repeating_proficiencies_"+row+"_name"] = expertise.friendlySubtypeName;
                        attributes["repeating_proficiencies_"+row+"_prof_type"] = 'OTHER';
                        attributes["repeating_proficiencies_"+row+"_options-flag"] = '0';
                    }

                    Object.assign(all_attributes, attributes);
                }

                // Adhoc Expertise
                var characterValues = getObjects(character.characterValues, 'typeId', 26);
                characterValues.forEach(function(cv) {
                    var attributes = {};
                    if(cv.value == 4) {
                        var objs = getObjects(character, 'type', 'proficiency');
                        objs.forEach(function(obj) {
                            if(cv.valueId == obj.entityId && cv.valueTypeId == obj.entityTypeId) {
                                var type = obj.subType.replace(/-/g, '_');
                                if(skills.includes(type)){
                                    attributes[type + '_type'] = "2";
                                }
                            }
                        });
                    }
                    Object.assign(all_attributes, attributes);
                });

                // Other Bonuses
                var bonuses = getObjects(character, 'type', 'bonus');
                var bonus_attributes = {};
                if(state[state_name][beyond_caller.id].config.imports.bonuses){
                    bonuses.forEach(function(bonus){
                        if(!bonus.id.includes('spell')){
                            switch(bonus.subType){
                                default:
                                    var type = bonus.subType.replace(/-/g, '_')
                                    if(skills.includes(type)){
                                        bonus_attributes[type + '_flat'] = bonus.value;
                                    }
                                    break;
                            }
                        }
                    })
                }

                var contacts = '',
                    treasure = '',
                    otherNotes = '';
                if(state[state_name][beyond_caller.id].config.imports.notes){
                    contacts += (character.notes.allies) ? 'ALLIES:\n' + character.notes.allies + '\n\n' : '';
                    contacts += (character.notes.organizations) ? 'ORGANIZATIONS:\n' + character.notes.organizations + '\n\n' : '';
                    contacts += (character.notes.enemies) ? 'ENEMIES:\n' + character.notes.enemies : '';

                    treasure += (character.notes.personalPossessions) ? 'PERSONAL POSSESSIONS:\n' + character.notes.personalPossessions + '\n\n' : '';
                    treasure += (character.notes.otherHoldings) ? 'OTHER HOLDINGS:\n' + character.notes.otherHoldings : '';

                    otherNotes += (character.notes.otherNotes) ? 'OTHER NOTES:\n' + character.notes.otherNotes + '\n\n' : '';
                    otherNotes += (character.faith) ? 'FAITH: ' + character.faith + '\n' : '';
                    otherNotes += (character.lifestyle) ? 'Lifestyle: ' + character.lifestyle.name + ' with a ' + character.lifestyle.cost + ' cost.' : '';
                }

                var background = '';
                if(character.background.definition != null) background = character.background.definition.name;
                if(background == '' && character.background.customBackground.name != null) background = character.background.customBackground.name;

                var other_attributes = {
                    // Base Info
                    'level': character.classes[0].level + multiclass_level,
                    'experience': character.currentXp,
                    'race': character.race.fullName,
                    'background': background,
                    'speed': speed,
                    'hp_temp': character.temporaryHitPoints || '',
                    'inspiration': (character.inspiration) ? 'on' : 0,
                    'alignment': character.alignmentId == null ? '' : alignments[character.alignmentId],

                    // Bio Info
                    // 'age': character.age ? character.age : '',
                    // 'size': character.size,
                    // 'height': character.height ? character.height : '',
                    // 'weight': character.weight ? character.weight : '',
                    // 'eyes': character.eyes ? character.eyes : '',
                    // 'hair': character.hair ? character.hair : '',
                    // 'skin': character.skin ? character.skin : '',
                    // 'character_appearance': character.traits.appearance,

                    // Class(es)
                    'class': character.classes[0].definition.name,
                    'subclass': character.classes[0].subclassDefinition == null ? '' : character.classes[0].subclassDefinition.name,
                    'base_level': character.classes[0].level,

                    // Ability Scores
                    'strength_base': getTotalAbilityScore(character, 1),
                    'dexterity_base': getTotalAbilityScore(character, 2),
                    'constitution_base': getTotalAbilityScore(character, 3),
                    'intelligence_base': getTotalAbilityScore(character, 4),
                    'wisdom_base': getTotalAbilityScore(character, 5),
                    'charisma_base': getTotalAbilityScore(character, 6),

                    // Traits
                    'personality_traits': character.traits.personalityTraits,
                    'options-flag-personality': '0',
                    'ideals': character.traits.ideals,
                    'options-flag-ideals': '0',
                    'bonds': character.traits.bonds,
                    'options-flag-bonds': '0',
                    'flaws': character.traits.flaws,
                    'options-flag-flaws': '0',

                    // currencies
                    'cp': character.currencies.cp,
                    'sp': character.currencies.sp,
                    'gp': character.currencies.gp,
                    'ep': character.currencies.ep,
                    'pp': character.currencies.pp,

                    // Notes/Bio
                    'character_backstory': character.notes.backstory,
                    'allies_and_organizations': contacts,
                    'additional_feature_and_traits': otherNotes,
                    'treasure': treasure,

                    'global_save_mod_flag': 1,
                    'global_skill_mod_flag': 1,
                    'global_attack_mod_flag': 1,
                    'global_damage_mod_flag': 1,
                    'dtype': 'full',
                    'init_tiebreaker': initTiebreaker ? '@{dexterity}/100' : '',
                    // 'jack_of_all_trades': jack
                };

                Object.assign(all_attributes, other_attributes);
                // Object.assign(all_attributes, bonus_attributes);

                setAttrs(object.id, all_attributes);

                if(state[state_name][beyond_caller.id].config.imports.class_spells) {
                    onSheetWorkerCompleted(function() {
                        importSpells(character, class_spells)
                    });
                }

                var hp = Math.floor(character.baseHitPoints + ( total_level * Math.floor( ( ( getTotalAbilityScore(character, 3) - 10 ) / 2 ) ) ) );

                var hpLevelBons = getObjects(character, 'subType', 'hit-points-per-level').forEach(function(bons) {
                    hp += total_level * bons.value;
                });

                createObj('attribute', {
                    characterid: object.id,
                    name: 'hp',
                    current: hp,
                    max: hp
                });

                if(class_spells.length > 15 && state[state_name][beyond_caller.id].config.imports.class_spells) {
                    sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.name + '</b> is almost ready.<br><p>There are some more spells than expected, they will be imported over time.</p></div>', null, {noarchive:true});
                } else {
                    sendChat(script_name, '<div style="'+style+'">Import of <b>' + character.name + '</b> is ready.</div>', null, {noarchive:true});
                }
            }
        }
    });

    const getPactMagicSlots = function(level) {
        switch(level){
            case 1:
                return 1;
                break;

            case 2: case 3: case 4: case 5: case 6: case 7: case 8: case 9: case 10:
            return 2;
            break;

            case 11: case 12: case 13: case 14: case 15: case 16:
            return 3;
            break;

            default:
                return 4
                break;
        }
        return 0;
    };

    const getFeatureSpells = function(character, traitId, featureType) {
        var spellsArr = [];
        if(character.spells[featureType] == null) return spellsArr;
        if(character.spells[featureType].length > 0) {
            var options = getObjects(character.options[featureType], 'componentId', traitId);
            for(var i = 0; i < options.length; i++) {
                var spells = getObjects(character.spells[featureType], 'componentId', options[i].definition.id);
                for(var j = 0; j < spells.length; j++) {
                    spellsArr.push(spells[j])
                }
            }
        }
        return spellsArr;
    };

    const importSpells = function(character, array) {
        // set this to whatever number of items you can process at once
        // return attributes;
        var chunk = 5;
        var index = 0;
        function doChunk() {
            var cnt = chunk;
            var attributes = {};
            while (cnt-- && index < array.length) {
                Object.assign(attributes, importSpell(character, array[index], true));
                ++index;
            }
            setAttrs(object.id, attributes);
            if (index < array.length) {
                // set Timeout for async iteration
                onSheetWorkerCompleted(doChunk);
            }
        }
        doChunk();
    };

    const importSpell = function(character, spell, addAttack) {
        var level = (spell.definition.level === 0) ? 'cantrip' : spell.definition.level.toString();
        var row = getRepeatingRowIds('spell-'+level, 'spellname', spell.definition.name)[0];

        spell.castingTime = {
            castingTimeInterval: spell.activation.activationTime,
        };
        if(spell.activation.activationType == 1) spell.castingTime.castingTimeUnit = 'Action';
        if(spell.activation.activationType == 3) spell.castingTime.castingTimeUnit = 'Bonus Action';
        if(spell.activation.activationType == 4) spell.castingTime.castingTimeUnit = 'Reaction';
        if(spell.activation.activationType == 5) spell.castingTime.castingTimeUnit = 'Second' + (spell.activation.activationTime != 1 ? 's' : '');
        if(spell.activation.activationType == 6) spell.castingTime.castingTimeUnit = 'Minute' + (spell.activation.activationTime != 1 ? 's' : '');
        if(spell.activation.activationType == 7) spell.castingTime.castingTimeUnit = 'Hour' + (spell.activation.activationTime != 1 ? 's' : '');
        if(spell.activation.activationType == 8) spell.castingTime.castingTimeUnit = 'Day' + (spell.activation.activationTime != 1 ? 's' : '');

        var attributes = {};
        attributes["repeating_spell-"+level+"_"+row+"_spellprepared"] = (spell.prepared || spell.alwaysPrepared) ? '1' : '0';
        attributes["repeating_spell-"+level+"_"+row+"_spellname"] = spell.definition.name;
        attributes["repeating_spell-"+level+"_"+row+"_spelllevel"] = level;
        attributes["repeating_spell-"+level+"_"+row+"_spellschool"] = spell.definition.school.toLowerCase();
        attributes["repeating_spell-"+level+"_"+row+"_spellritual"] = (spell.ritual) ? '{{ritual=1}}' : '0';
        attributes["repeating_spell-"+level+"_"+row+"_spellcastingtime"] = spell.castingTime.castingTimeInterval + ' ' + spell.castingTime.castingTimeUnit;
        attributes["repeating_spell-"+level+"_"+row+"_spellrange"] = (spell.definition.range.origin === 'Ranged') ? spell.definition.range.rangeValue + 'ft.' : spell.definition.range.origin;
        attributes["repeating_spell-"+level+"_"+row+"_options-flag"] = '0';
        attributes["repeating_spell-"+level+"_"+row+"_spellritual"] = (spell.definition.ritual) ? '1' : '0';
        attributes["repeating_spell-"+level+"_"+row+"_spellconcentration"] = (spell.definition.concentration) ? '{{concentration=1}}' : '0';
        attributes["repeating_spell-"+level+"_"+row+"_spellduration"] = (spell.definition.duration.durationUnit !== null) ? spell.definition.duration.durationInterval + ' ' + spell.definition.duration.durationUnit : spell.definition.duration.durationType;
        attributes["repeating_spell-"+level+"_"+row+"_spell_ability"] = spell.spellCastingAbility == null ? '0*' : '@{'+_ABILITY[spell.spellCastingAbility]+'_mod}+';

        var descriptions = spell.definition.description.split('At Higher Levels. ');
        attributes["repeating_spell-"+level+"_"+row+"_spelldescription"] = replaceChars(descriptions[0]);
        attributes["repeating_spell-"+level+"_"+row+"_spellathigherlevels"] = (descriptions.length > 1) ? replaceChars(descriptions[1]) : '';

        var components = spell.definition.components;
        attributes["repeating_spell-"+level+"_"+row+"_spellcomp_v"] = (components.includes(1)) ? '{{v=1}}' : '0';
        attributes["repeating_spell-"+level+"_"+row+"_spellcomp_s"] = (components.includes(2)) ? '{{s=1}}' : '0';
        attributes["repeating_spell-"+level+"_"+row+"_spellcomp_m"] = (components.includes(3)) ? '{{m=1}}' : '0';
        attributes["repeating_spell-"+level+"_"+row+"_spellcomp_materials"] = (components.includes(3)) ? replaceChars(spell.definition.componentsDescription) : '';

        var healing = getObjects(spell, 'subType', 'hit-points');
        if(healing.length !== 0) {
            healing = healing[0];
            if(healing.type == 'bonus') {
                var bonus = '';
                if(getObjects(character.classes, 'name', 'Disciple of Life').length > 0) {
                    bonus = '+'+(2 + spell.definition.level);
                }

                attributes["repeating_spell-"+level+"_"+row+"_spellattack"] = 'None';
                attributes["repeating_spell-"+level+"_"+row+"_spellsave"] = '';
                attributes["repeating_spell-"+level+"_"+row+"_spelldamage"] = '';
                attributes["repeating_spell-"+level+"_"+row+"_spelldamagetype"] = '';
                attributes["repeating_spell-"+level+"_"+row+"_spellhealing"] = (healing.die.fixedValue !== null) ? healing.die.fixedValue+bonus : healing.die.diceString+bonus;
                attributes["repeating_spell-"+level+"_"+row+"_spelldmgmod"] = healing.usePrimaryStat ? 'Yes' : '0';

                var bonus = '';
                if(getObjects(character.classes, 'name', 'Disciple of Life').length > 0) {
                    bonus = '1';
                }

                var ahl = spell.definition.atHigherLevels.higherLevelDefinitions;
                for(var i in ahl) {
                    if(ahl[i].dice == null) continue;
                    attributes["repeating_spell-"+level+"_"+row+"_spellhldie"] = ahl[i].dice.diceCount;
                    attributes["repeating_spell-"+level+"_"+row+"_spellhldietype"] = 'd'+ahl[i].dice.diceValue;
                    attributes["repeating_spell-"+level+"_"+row+"_spellhlbonus"] = bonus;
                }

                if(healing.hasOwnProperty('atHigherLevels') && healing.atHigherLevels.scaleType === 'spellscale') {
                    attributes["repeating_spell-"+level+"_"+row+"_spellhldie"] = '1';
                    attributes["repeating_spell-"+level+"_"+row+"_spellhldietype"] = 'd'+healing.die.diceValue;
                    attributes["repeating_spell-"+level+"_"+row+"_spellhlbonus"] = bonus;
                }
                if(addAttack) attributes["repeating_spell-"+level+"_"+row+"_spelloutput"] = 'ATTACK';
            }
        }

        // Damage/Attack
        var damage = getObjects(spell, 'type', 'damage');
        if(damage.length !== 0 && (spell.definition.attackType !== "" || spell.definition.saveDcStat !== null)) {
            damage = damage[0];
            if(damage.die.diceString != null) {
                if(spell.definition.attackType == 0) spell.definition.attackType = 'none';
                if(spell.definition.attackType == 1) spell.definition.attackType = 'melee';
                if(spell.definition.attackType == 2) spell.definition.attackType = 'ranged';
                attributes["repeating_spell-"+level+"_"+row+"_spellattack"] = (spell.definition.attackType === '') ? 'None' : spell.definition.attackType;
                attributes["repeating_spell-"+level+"_"+row+"_spellsave"] = (spell.definition.saveDcAbilityId === null) ? '' : ucFirst(_ABILITY[_ABILITIES[spell.definition.saveDcAbilityId]]);
                attributes["repeating_spell-"+level+"_"+row+"_spelldamage"] = damage.die.diceString;
                attributes["repeating_spell-"+level+"_"+row+"_spelldamagetype"] = damage.friendlySubtypeName;

                var hlDiceCount = '';
                var hlDiceValue = '';

                if(damage.hasOwnProperty('atHigherLevels')) {
                    var ahl = spell.definition.atHigherLevels.higherLevelDefinitions;
                    if(spell.definition.level == 0 && ahl.length == 0) {
                        if(spell.definition.atHigherLevels.scaleType == 'characterlevel') {
                            attributes["repeating_spell-"+level+"_"+row+"_spell_damage_progression"] = 'Cantrip Dice';
                        }
                    }
                    else if(spell.definition.level > 0) {
                        for(var i in ahl) {
                            if(ahl[i].dice == null) continue;
                            attributes["repeating_spell-"+level+"_"+row+"_spellhldie"] = ahl[i].dice.diceCount;
                            attributes["repeating_spell-"+level+"_"+row+"_spellhldietype"] = 'd'+ahl[i].dice.diceValue;
                            hlDiceCount = ahl[i].dice.diceCount;
                            hlDiceValue = ahl[i].dice.diceValue;
                        }

                        if(damage.atHigherLevels.scaleType === 'spellscale'){
                            attributes["repeating_spell-"+level+"_"+row+"_spellhldie"] = '1';
                            attributes["repeating_spell-"+level+"_"+row+"_spellhldietype"] = 'd'+damage.die.diceValue;
                            hlDiceCount = '1';
                            hlDiceValue = damage.die.diceValue;
                        }
                    }
                }

                if(addAttack) attributes["repeating_spell-"+level+"_"+row+"_spelloutput"] = 'ATTACK';
            }
        }

        return attributes;
    };

    const ucFirst = function(string) {
        if(string == null) return string;
        return string.charAt(0).toUpperCase() + string.slice(1);
    };

    const sendConfigMenu = function(player, first) {
        var playerid = player.id;
        var prefix = (state[state_name][playerid].config.prefix !== '') ? state[state_name][playerid].config.prefix : '[NONE]';
        var prefixButton = makeButton(prefix, '!beyond --config prefix|?{Prefix}', buttonStyle);
        var suffix = (state[state_name][playerid].config.suffix !== '') ? state[state_name][playerid].config.suffix : '[NONE]';
        var suffixButton = makeButton(suffix, '!beyond --config suffix|?{Suffix}', buttonStyle);
        var overwriteButton = makeButton(state[state_name][playerid].config.overwrite, '!beyond --config overwrite|'+!state[state_name][playerid].config.overwrite, buttonStyle);
        var debugButton = makeButton(state[state_name][playerid].config.debug, '!beyond --config debug|'+!state[state_name][playerid].config.debug, buttonStyle);
        // var silentSpellsButton = makeButton(state[state_name][playerid].config.silentSpells, '!beyond --config silentSpells|'+!state[state_name][playerid].config.silentSpells, buttonStyle);

        var listItems = [
            '<span style="float: left; margin-top: 6px;">Overwrite:</span> '+overwriteButton+'<br /><small style="clear: both; display: inherit;">This option will overwrite an existing character sheet with a matching character name. I recommend making a backup copy just in case.</small>',
            '<span style="float: left; margin-top: 6px;">Prefix:</span> '+prefixButton,
            '<span style="float: left; margin-top: 6px;">Suffix:</span> '+suffixButton,
            '<span style="float: left; margin-top: 6px;">Debug:</span> '+debugButton,
            // '<span style="float: left; margin-top: 6px;">Silent Spells:</span> '+silentSpellsButton
        ]

        var list = '<b>Importer</b>'+makeList(listItems, 'overflow: hidden; list-style: none; padding: 0; margin: 0;', 'overflow: hidden; margin-top: 5px;');

        var languageGroupingButton = makeButton(state[state_name][playerid].config.languageGrouping, '!beyond --config languageGrouping|'+!state[state_name][playerid].config.languageGrouping, buttonStyle);
        var initTieBreakerButton = makeButton(state[state_name][playerid].config.initTieBreaker, '!beyond --config initTieBreaker|'+!state[state_name][playerid].config.initTieBreaker, buttonStyle);

        if(playerIsGM(playerid)) {
            var players = '';
            var playerObjects = findObjs({
                _type: "player",
            });
            for(var i = 0; i < playerObjects.length; i++) {
                players += '|'+playerObjects[i]['attributes']['_displayname']+','+playerObjects[i].id;
            }

            var ipj = state[state_name][playerid].config.inplayerjournals == '' ? '[NONE]' : state[state_name][playerid].config.inplayerjournals;
            if(ipj != '[NONE]' && ipj != 'all') ipj = getObj('player', ipj).get('displayname');
            var inPlayerJournalsButton = makeButton(ipj, '!beyond --config inplayerjournals|?{Player|None,[NONE]|All Players,all'+players+'}', buttonStyle);
            var cb = state[state_name][playerid].config.controlledby == '' ? '[NONE]' : state[state_name][playerid].config.controlledby;
            if(cb != '[NONE]' && cb != 'all') cb = getObj('player', cb).get('displayname');
            var controlledByButton = makeButton(cb, '!beyond --config controlledby|?{Player|None,[NONE]|All Players,all'+players+'}', buttonStyle);
        }
        else {
            var inPlayerJournalsButton = makeButton(player.get('displayname'), '', buttonStyle);
            var controlledByButton = makeButton(player.get('displayname'), '', buttonStyle);
        }

        var sheetListItems = [
            '<span style="float: left; margin-top: 6px;">In Player Journal:</span> '+inPlayerJournalsButton,
            '<span style="float: left; margin-top: 6px;">Player Control Permission:</span> '+controlledByButton,
            '<span style="float: left; margin-top: 6px;">Language Grouping:</span> '+languageGroupingButton,
            '<span style="float: left; margin-top: 6px;">Initiative Tie Breaker:</span> '+initTieBreakerButton
        ]

        var sheetList = '<hr><b>Character Sheet</b>'+makeList(sheetListItems, 'overflow: hidden; list-style: none; padding: 0; margin: 0;', 'overflow: hidden; margin-top: 5px;');

        var debug = '';
        if(state[state_name][playerid].config.debug){
            var debugListItems = [];
            for(var importItemName in state[state_name][playerid].config.imports){
                var button = makeButton(state[state_name][playerid].config.imports[importItemName], '!beyond --imports '+importItemName+'|'+!state[state_name][playerid].config.imports[importItemName], buttonStyle);
                debugListItems.push('<span style="float: left">'+importItemName+':</span> '+button)
            }

            debug += '<hr><b>Imports</b>'+makeList(debugListItems, 'overflow: hidden; list-style: none; padding: 0; margin: 0;', 'overflow: hidden; margin-top: 5px;');
        }

        var resetButton = makeButton('Reset', '!beyond --reset', buttonStyle + ' margin: auto; width: 90%; display: block; float: none;');

        var title_text = (first) ? script_name + ' First Time Setup' : script_name + ' Config';
        var text = '<div style="'+style+'">'+makeTitle(title_text)+list+sheetList+debug+'<hr>'+resetButton+'</div>';

        sendChat(script_name, '/w "' + player.get('displayname') + '" ' + text, null, {noarchive:true});
    };

    const sendHelpMenu = function(player, first) {
        // var configButton = makeButton('Config', '!beyond --config', buttonStyle+' margin: auto; width: 90%; display: block; float: none;');

        var listItems = [
            '<span style="text-decoration: underline; font-size: 90%;">!beyond --help</span><br />Shows this menu.',
            '<span style="text-decoration: underline; font-size: 90%;">!beyond --config</span><br />Shows the configuration menu. (GM only)',
            '<span style="text-decoration: underline; font-size: 90%;">!beyond --import [CHARACTER JSON]</span><br />Imports a character from <a href="http://www.dndbeyond.com" target="_blank">D&D Beyond</a>.',
        ];

        var command_list = makeList(listItems, 'list-style: none; padding: 0; margin: 0;');

        var text = '<div style="'+style+'">';
        text += makeTitle(script_name + ' Help');
        text += '<p>Go to a character on <a href="http://www.dndbeyond.com" target="_blank">D&D Beyond</a>, and put `/json` behind the link. Copy the full contents of this page and paste it behind the command `!beyond --import`.</p>';
        text += '<p>For more information take a look at my <a style="text-decoration: underline" href="https://github.com/sillvva/Roll20-API-Scripts/blob/master/5eOGL-DND-Beyond-Importer/BeyondImporter.js" target="_blank">Github</a> repository.</p>';
        text += '<hr>';
        text += '<b>Commands:</b>'+command_list;
        // text += '<hr>';
        // text += configButton;
        text += '</div>';

        sendChat(script_name, '/w "'+ player.get('displayname') + '" ' + text, null, {noarchive:true});
    };

    const makeTitle = function(title) {
        return '<h3 style="margin-bottom: 10px;">'+title+'</h3>';
    };

    const makeButton = function(title, href, style) {
        return '<a style="'+style+'" href="'+href+'">'+title+'</a>';
    };

    const makeList = function(items, listStyle, itemStyle) {
        var list = '<ul style="'+listStyle+'">';
        items.forEach(function(item) {
            list += '<li style="'+itemStyle+'">'+item+'</li>';
        });
        list += '</ul>';
        return list;
    };

    const replaceChars = function(text) {
        text = text.replace('\&rsquo\;', '\'').replace('\&mdash\;','—').replace('\ \;',' ').replace('\&hellip\;','…');
        text = text.replace('\û\;','û').replace('’', '\'').replace(' ', ' ');
        text = text.replace(/\<li[^\>]+\>/gi,'• ').replace('\<\/li\>','');

        return text;
    };

    const getRepeatingRowIds = function(section, attribute, matchValue, index) {
        var ids = [];
        if(state[state_name][beyond_caller.id].config.overwrite) {
            var matches = findObjs({ type: 'attribute', characterid: object.id })
                .filter(function(attr) {
                    return attr.get('name').indexOf('repeating_'+section) !== -1 && attr.get('name').indexOf(attribute) !== -1 && attr.get('current') == matchValue;
                });
            for(var i in matches) {
                var row = matches[i].get('name').replace('repeating_'+section+'_','').replace('_'+attribute,'');
                ids.push(row);
                // if(section == 'inventory') sendChat(script_name, matchValue+' ('+ids.length+')'+': '+row, null, {noarchive:true});
            }
            if(ids.length == 0) ids.push(generateRowID());
        }
        else ids.push(generateRowID());

        if(index == null) return ids;
        else return ids[index] == null && index > 0 ? ids[0] : ids[index];
    }

    const createRepeatingTrait = function(object, trait, options) {
        var options = options || {};

        var opts = {
            index: 0,
            itemid: ''
        };
        Object.assign(opts, options);

        var row = getRepeatingRowIds('traits', 'name', trait.name, opts.index);

        var attributes = {}
        attributes["repeating_traits_"+row+"_name"] = trait.name;
        attributes["repeating_traits_"+row+"_source"] = trait.source;
        attributes["repeating_traits_"+row+"_source_type"] = trait.source_type;
        attributes["repeating_traits_"+row+"_description"] = replaceChars(trait.description);
        attributes["repeating_traits_"+row+"_options-flag"] = '0';

        return attributes;
    };

    const createRepeatingAttack = function(object, attack, options) {
        var options = options || {};

        var opts = {
            index: 0,
            itemid: ''
        };
        Object.assign(opts, options);

        var attackrow = getRepeatingRowIds('attack', 'atkname', attack.name, opts.index);

        var attackattributes = {};
        attackattributes["repeating_attack_"+attackrow+"_options-flag"] = '0';
        attackattributes["repeating_attack_"+attackrow+"_atkname"] = attack.name;
        attackattributes["repeating_attack_"+attackrow+"_itemid"] = opts.itemid;
        attackattributes["repeating_attack_"+attackrow+"_atkflag"] = '{{attack=1}}';
        attackattributes["repeating_attack_"+attackrow+"_atkattr_base"] = '@{'+attack.attack.attribute+'_mod}';
        attackattributes["repeating_attack_"+attackrow+"_atkprofflag"] = '(@{pb})';
        attackattributes["repeating_attack_"+attackrow+"_atkmagic"] = attack.magic;
        attackattributes["repeating_attack_"+attackrow+"_atkrange"] = attack.range;

        attackattributes["repeating_attack_"+attackrow+"_dmgflag"] = '{{damage=1}} {{dmg1flag=1}}';
        attackattributes["repeating_attack_"+attackrow+"_dmgbase"] = typeof attack.damage.diceString == 'string' ? attack.damage.diceString+'' : '';
        attackattributes["repeating_attack_"+attackrow+"_dmgattr"] = (attack.damage.attribute === '0') ? '0' : '@{'+attack.damage.attribute+'_mod}';
        attackattributes["repeating_attack_"+attackrow+"_dmgtype"] = attack.damage.type;
        attackattributes["repeating_attack_"+attackrow+"_dmgcustcrit"] = attack.damage.diceString;

        if(attack.damage2 != null) {
            attackattributes["repeating_attack_"+attackrow+"_dmg2flag"] = '{{damage=1}} {{dmg2flag=1}}';
            attackattributes["repeating_attack_"+attackrow+"_dmg2base"] = attack.damage2.diceString;
            attackattributes["repeating_attack_"+attackrow+"_dmg2attr"] = (attack.damage2.attribute === '0') ? '0' : '@{'+attack.damage2.attribute+'_mod}';
            attackattributes["repeating_attack_"+attackrow+"_dmg2type"] = attack.damage2.type;
            attackattributes["repeating_attack_"+attackrow+"_dmg2custcrit"] = attack.damage2.diceString;
        }

        attackattributes["repeating_attack_"+attackrow+"_atk_desc"] = '';//replaceChars(attack.description);

        return attackattributes;
    };

    const getTotalAbilityScore = function(character, scoreId) {
        var index = scoreId-1;
        var base = (character.stats[index].value == null ? 10 : character.stats[index].value),
            bonus = (character.bonusStats[index].value == null ? 0 : character.bonusStats[index].value),
            override = (character.overrideStats[index].value == null ? 0 : character.overrideStats[index].value),
            total = base + bonus,
            modifiers = getObjects(character, '', _ABILITY[_ABILITIES[scoreId]] + "-score");
        if(override > 0) total = override;
        if(modifiers.length > 0) {
            var used_ids = [];
            for(var i = 0; i < modifiers.length; i++){
                if(modifiers[i].type == 'bonus' && used_ids.indexOf(modifiers[i].id) == -1) {
                    total += modifiers[i].value;
                    used_ids.push(modifiers[i].id);
                }
            }
        }

        return total;
    };

    //return an array of objects according to key, value, or key and value matching
    const getObjects = function(obj, key, val) {
        var objects = [];
        for (var i in obj) {
            if (!obj.hasOwnProperty(i)) continue;
            if (typeof obj[i] == 'object') {
                objects = objects.concat(getObjects(obj[i], key, val));
            } else
            //if key matches and value matches or if key matches and value is not passed (eliminating the case where key matches but passed value does not)
            if (i == key && obj[i] == val || i == key && val == '') { //
                objects.push(obj);
            } else if (obj[i] == val && key == ''){
                //only add if the object is not already in the array
                if (objects.lastIndexOf(obj) == -1){
                    objects.push(obj);
                }
            }
        }
        return objects;
    };

    // Find an existing repeatable item with the same name, or generate new row ID
    const getOrMakeRowID = function(character,repeatPrefix,name){
        // Get list of all of the character's attributes
        var attrObjs = findObjs({ _type: "attribute", _characterid: character.get("_id") });

        var i = 0;
        while (i < attrObjs.length)
        {
            // If this is a feat taken multiple times, strip the number of times it was taken from the name
            /*var attrName = attrObjs[i].get("current").toString();
             if (regexIndexOf(attrName, / x[0-9]+$/) !== -1)
             attrName = attrName.replace(/ x[0-9]+/,"");

             if (attrObjs[i].get("name").indexOf(repeatPrefix) !== -1 && attrObjs[i].get("name").indexOf("_name") !== -1 && attrName === name)
             return attrObjs[i].get("name").substring(repeatPrefix.length,(attrObjs[i].get("name").indexOf("_name")));
             i++;*/
            i++;
        }
        return generateRowID();
    };

    const generateUUID = (function() {
        var a = 0, b = [];
        return function() {
            var c = (new Date()).getTime() + 0, d = c === a;
            a = c;
            for (var e = new Array(8), f = 7; 0 <= f; f--) {
                e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
                c = Math.floor(c / 64);
            }
            c = e.join("");
            if (d) {
                for (f = 11; 0 <= f && 63 === b[f]; f--) {
                    b[f] = 0;
                }
                b[f]++;
            } else {
                for (f = 0; 12 > f; f++) {
                    b[f] = Math.floor(64 * Math.random());
                }
            }
            for (f = 0; 12 > f; f++){
                c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
            }
            return c;
        };
    }());

    const generateRowID = function() {
        "use strict";
        return generateUUID().replace(/_/g, "Z");
    };

    const regexIndexOf = function(str, regex, startpos) {
        var indexOf = str.substring(startpos || 0).search(regex);
        return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
    };

    const pre_log = function(message) {
        log('---------------------------------------------------------------------------------------------');
        log(message);
        log('---------------------------------------------------------------------------------------------');
    };

    const checkInstall = function() {
        if(!_.has(state, state_name)){
            state[state_name] = state[state_name] || {};
        }
        setDefaults();
    };

    const setDefaults = function(reset) {
        const defaults = {
            overwrite: false,
            debug: false,
            prefix: '',
            suffix: '',
            inplayerjournals: '',
            controlledby: '',
            languageGrouping: false,
            initTieBreaker: false,
            imports: {
                classes: true,
                class_spells: true,
                class_traits: true,
                inventory: true,
                proficiencies: true,
                traits: true,
                languages: true,
                bonuses: true,
                notes: true,
            }
        };

        var playerObjects = findObjs({
            _type: "player",
        });
        playerObjects.forEach(function(player) {
            if(!state[state_name][player.id]) {
                state[state_name][player.id] = {};
            }

            if(!state[state_name][player.id].config) {
                state[state_name][player.id].config = defaults;
            }

            for(var item in defaults) {
                if(!state[state_name][player.id].config.hasOwnProperty(item)) {
                    state[state_name][player.id].config[item] = defaults[item];
                }
            }

            for(var item in defaults.imports) {
                if(!state[state_name][player.id].config.imports.hasOwnProperty(item)) {
                    state[state_name][player.id].config.imports[item] = defaults.imports[item];
                }
            }

            if(!state[state_name][player.id].config.hasOwnProperty('firsttime')){
                if(!reset){
                    sendConfigMenu(player, true);
                }
                state[state_name][player.id].config.firsttime = false;
            }
        });
    };
})();
