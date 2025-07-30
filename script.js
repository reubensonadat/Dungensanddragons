        // --- Firebase/Firestore Imports ---
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, deleteDoc, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // --- DOM Elements ---
        const DOMElements = {
            body: document.body,
            gameContainer: document.getElementById('game-container'),
            startScreen: document.getElementById('start-screen'),
            classSelectionScreen: document.getElementById('class-selection-screen'),
            gameOverScreen: document.getElementById('game-over-screen'),
            eventScreen: document.getElementById('event-screen'),
            eventContent: document.getElementById('event-content'),
            playerInfoContainer: document.getElementById('player-info-container'),
            enemyName: document.getElementById('enemy-name'),
            enemyArtContainer: document.getElementById('enemy-art-container'),
            enemyHealthBar: document.getElementById('enemy-health-bar'),
            enemyDescription: document.getElementById('enemy-description'),
            actionButtonsContainer: document.getElementById('action-buttons'),
            gameLog: document.getElementById('game-log'),
            dungeonLevelDisplay: document.getElementById('dungeon-level-display'),
            gameOverMessage: document.getElementById('game-over-message'),
            gameOverStats: document.getElementById('game-over-stats'),
            enemyDamageContainer: document.getElementById('enemy-damage-container'),
            turnIndicatorContainer: document.getElementById('turn-indicator-container'),
            playerGoldDisplay: document.getElementById('player-gold-display'),
            playerPotionsDisplay: document.getElementById('player-potions-display'),
            authStatus: document.getElementById('auth-status'),
            enemyStatusEffects: document.getElementById('enemy-status-effects'),
            continueBtn: document.getElementById('continue-btn'),
            startGameBtn: document.getElementById('start-game-btn'),
        };

        // --- Firebase Setup ---
        let app, auth, db, userId, isOnline = false;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'dungeon-crawler-default';
        const localSaveKey = `dungeonCrawler_${appId}_save`;
        
        try {
            const firebaseConfig = JSON.parse(__firebase_config);
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            // setLogLevel('debug');
        } catch (e) {
            console.error("Firebase config not found or invalid. Using offline mode.", e);
            DOMElements.authStatus.textContent = "Offline Mode";
        }

        // --- Game State ---
        let gameState = {};

        // --- Audio Engine ---
        const Audio = {
            sounds: {},
            winSequence: null,
            init() {
                this.sounds = {
                    hit: new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 } }).toDestination(),
                    crit: new Tone.Synth({ oscillator: { type: "triangle8" }, envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.1 } }).toDestination(),
                    potion: new Tone.MembraneSynth().toDestination(),
                    heal: new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 3 }, envelope: { attack: 0.1, decay: 0.4, sustain: 0.2, release: 0.5}}).toDestination(),
                    levelUp: new Tone.Synth({ oscillator: {type: 'sawtooth'}, envelope: {attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5}}).toDestination(),
                    fireball: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.2 } }).toDestination(),
                    lose: new Tone.Synth({ oscillator: { type: "fmsquare", modulationType: "sawtooth", modulationIndex: 3, harmonicity: 3.4 }, envelope: { attack: 0.01, decay: 1, sustain: 0, release: 0.2 } }).toDestination(),
                    win: new Tone.Synth().toDestination(),
                    poison: new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.2, decay: 0.5, sustain: 0.1, release: 0.2 } }).toDestination(),
                    gold: new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination(),
                    boss: new Tone.Synth({ oscillator: { type: 'sawtooth6', detune: 10 }, envelope: { attack: 0.1, decay: 1, sustain: 0.5, release: 1}}).toDestination(),
                    equip: new Tone.MetalSynth({frequency: 150, envelope: {attack: 0.01, decay: 0.2, release: 0.1}, harmonicity: 3.1, modulationIndex: 16, resonance: 2000, octaves: 1.5}).toDestination(),
                    run: new Tone.NoiseSynth({noise: {type: "white"}, envelope: {attack: 0.01, decay: 0.2, sustain: 0}}).toDestination(),
                };
                this.winSequence = new Tone.Sequence((time, note) => { this.sounds.win.triggerAttackRelease(note, '8n', time); }, ['C5', 'E5', 'G5', 'C6'], '8n');
                Tone.Transport.bpm.value = 140;
            },
            play(sound, note = null, duration = '8n') {
                if (Tone.context.state !== 'running') { Tone.start(); }
                if (this.sounds[sound]) {
                    if(sound === 'win') { 
                        Tone.Transport.start(); 
                        this.winSequence.start(0); 
                        Tone.Transport.scheduleOnce(() => { Tone.Transport.stop(); }, 2);
                    }
                    else if(sound === 'boss') { this.sounds.boss.triggerAttackRelease("C2", "1n"); }
                    else if (note) { this.sounds[sound].triggerAttackRelease(note, duration); }
                    else { this.sounds[sound].triggerAttackRelease(); }
                }
            }
        };

        // --- Game Data ---
        const GameData = {
            classes: {
                warrior: { name: 'Warrior', art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#C62828"><rect x="30" y="50" width="40" height="40" rx="5"/><rect x="40" y="20" width="20" height="30" rx="5"/><rect x="35" y="25" width="30" height="10" fill="#757575"/><rect x="48" y="10" width="4" height="15" fill="#B71C1C"/></g><g fill="#BDBDBD"><rect x="20" y="40" width="15" height="40" rx="5"/><rect x="65" y="40" width="15" height="40" rx="5"/></g></svg>`, hp: 120, mana: 20, baseDamage: 12, abilities: [{ id: 'power_strike', cost: 0 }, { id: 'shield_wall', cost: 10 }] },
                mage: { name: 'Mage', art: `<svg class="character-art" viewBox="0 0 100 100"><g><path d="M50 10 L20 90 L80 90 Z" fill="#673AB7"/><circle cx="50" cy="30" r="15" fill="#9575CD"/><circle cx="50" cy="30" r="8" fill="#D1C4E9"/><path d="M40 80 L60 80 L55 95 L45 95 Z" fill="#4527A0"/></g></svg>`, hp: 80, mana: 80, baseDamage: 8, abilities: [{ id: 'fireball', cost: 15 }, { id: 'mana_drain', cost: 0 }] },
                rogue: { name: 'Rogue', art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#424242"><path d="M50 90 C 40 80, 40 70, 50 60 L 50 20 L 60 10 L 70 20 L 70 60 C 80 70, 80 80, 70 90 Z"/><rect x="45" y="5" width="10" height="10" fill="#212121"/></g><g fill="#757575"><circle cx="45" cy="30" r="3"/><circle cx="55" cy="30" r="3"/></g></svg>`, hp: 90, mana: 40, baseDamage: 10, abilities: [{ id: 'poison_stab', cost: 15 }, { id: 'eviscerate', cost: 25 }] },
                cleric: { name: 'Cleric', art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#E0E0E0"><rect x="30" y="20" width="40" height="70" rx="10"/><rect x="40" y="10" width="20" height="20" rx="5"/><rect x="45" y="40" width="10" height="30" fill="#FFD54F"/><rect x="35" y="50" width="30" height="10" fill="#FFD54F"/></g></svg>`, hp: 100, mana: 60, baseDamage: 9, abilities: [{ id: 'smite', cost: 10 }, { id: 'holy_light', cost: 20 }] },
                paladin: { name: 'Paladin', art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#B0BEC5"><rect x="25" y="20" width="50" height="70" rx="8" /><rect x="35" y="10" width="30" height="20" rx="4" /><path d="M40 50 L 60 50 L 50 70 Z" fill="#FFCA28"/></g><g fill="#FFCA28"><rect x="48" y="5" width="4" height="10"/></g></svg>`, hp: 110, mana: 50, baseDamage: 11, abilities: [{ id: 'divine_strike', cost: 15 }, { id: 'lay_on_hands', cost: 25 }] }
            },
            abilities: {
                power_strike: { name: 'Power Strike', description: 'A mighty blow dealing 2x to 3x weapon damage.', execute: (player, enemy) => { const dmg = Game.calculateDamage(player.getDamage() * 2, 1.0); enemy.takeDamage(dmg); UI.log(`${player.name} uses Power Strike for ${dmg} damage!`, 'attack'); } },
                shield_wall: { name: 'Shield Wall', description: 'Reduces incoming damage by 50% for 2 turns.', execute: (player, enemy) => { player.addStatus('shielded', 2); UI.log(`${player.name} raises their shield!`, 'ability'); } },
                fireball: { name: 'Fireball', description: 'Hurls a ball of fire for 25-50 damage.', execute: (player, enemy) => { const dmg = Game.calculateDamage(38, 0.7); enemy.takeDamage(dmg); Audio.play('fireball'); UI.log(`${player.name} casts Fireball for ${dmg} damage!`, 'attack'); } },
                mana_drain: { name: 'Mana Drain', description: 'Drains 10 mana from the enemy and restores it to you.', execute: (player, enemy) => { const drained = enemy.drainMana(10); player.updateMana(drained); UI.showDamageIndicator(drained, 'player', false, 'drain'); UI.log(`${player.name} drains ${drained} mana!`, 'ability'); } },
                poison_stab: { name: 'Poison Stab', description: 'Deals 2x to 3x weapon damage and poisons the enemy for 3 turns.', execute: (player, enemy) => { const dmg = Game.calculateDamage(player.getDamage() * 2, 1.0); enemy.takeDamage(dmg); enemy.addStatus('poisoned', 3); UI.log(`${player.name} stabs with a poisoned blade for ${dmg} damage!`, 'attack'); } },
                eviscerate: { name: 'Eviscerate', description: 'A vicious attack dealing 2x to 3x weapon damage.', execute: (player, enemy) => { const dmg = Game.calculateDamage(player.getDamage() * 2, 1.0); enemy.takeDamage(dmg); UI.log(`${player.name} eviscerates for a massive ${dmg} damage!`, 'attack'); } },
                smite: { name: 'Smite', description: 'Deals 2x to 3x weapon damage and heals you for 20% of damage dealt.', execute: (player, enemy) => { const dmg = Game.calculateDamage(player.getDamage() * 2, 1.0); enemy.takeDamage(dmg); const healed = Math.round(dmg * 0.2); player.heal(healed); UI.log(`${player.name} smites the enemy for ${dmg} damage and recovers ${healed} health.`, 'attack'); } },
                holy_light: { name: 'Holy Light', description: 'Heals you for 40% of your max HP.', execute: (player, enemy) => { const healed = Math.round(player.maxHp * 0.4); player.heal(healed); UI.log(`${player.name} is bathed in Holy Light, healing for ${healed} health.`, 'heal'); } },
                divine_strike: { name: 'Divine Strike', description: 'Deals 2x to 3x weapon damage. 25% chance to stun.', execute: (player, enemy) => { const dmg = Game.calculateDamage(player.getDamage() * 2, 1.0); enemy.takeDamage(dmg); UI.log(`${player.name}'s Divine Strike hits for ${dmg} damage!`, 'attack'); if (Math.random() < 0.25) { enemy.addStatus('stunned', 1); UI.log('The enemy is stunned by divine power!', 'debuff'); } } },
                lay_on_hands: { name: 'Lay on Hands', description: 'A powerful heal for 50% of your max HP.', execute: (player, enemy) => { const healed = Math.round(player.maxHp * 0.5); player.heal(healed); UI.log(`${player.name} uses Lay on Hands, restoring ${healed} health.`, 'heal'); } },
            },
            items: {
                rusty_sword: { name: 'Rusty Sword', type: 'weapon', damage: 4, art: '🗡️' },
                iron_helmet: { name: 'Iron Helmet', type: 'armor', defense: 1, art: '🪖' },
                goblin_scimitar: { name: 'Goblin Scimitar', type: 'weapon', damage: 6, art: '🔪' },
                warlock_robe: { name: 'Warlock Robe', type: 'armor', defense: 2, art: '🥋' },
                greatsword_of_valor: { name: 'Greatsword of Valor', type: 'weapon', damage: 10, art: '⚔️'},
                runic_shield: { name: 'Runic Shield', type: 'armor', defense: 5, art: '🛡️'},
            },
            enemies: {
                goblin: { name: "Goblin Sneak", hp: 30, mana: 10, damage: 10, xp: 25, gold: 10, description: "A small, wicked creature with a rusty knife.", art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#689F38"><path d="M50 90C40 90 30 80 30 70C30 60 40 50 50 50C60 50 70 60 70 70C70 80 60 90 50 90Z"/><path d="M40 50C30 50 20 40 20 30C20 20 30 10 40 10C50 10 60 20 60 30C60 40 50 50 40 50Z"/><path d="M60 50C70 50 80 40 80 30C80 20 70 10 60 10C50 10 40 20 40 30C40 40 50 50 60 50Z"/><circle cx="45" cy="65" r="5" fill="#FFEB3B"/><circle cx="55" cy="65" r="5" fill="#FFEB3B"/><rect x="40" y="75" width="20" height="5" fill="#212121"/></g></svg>` },
                skeleton: { name: "Skeleton Warrior", hp: 45, mana: 0, damage: 12, xp: 35, gold: 15, description: "A rattling warrior of bone, armed with a pitted sword.", art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#E0E0E0"><rect x="45" y="20" width="10" height="20" rx="5"/><circle cx="50" cy="15" r="10"/><rect x="30" y="40" width="40" height="10" rx="5"/><rect x="47" y="40" width="6" height="30"/><rect x="40" y="70" width="20" height="5" rx="2.5"/><rect x="35" y="50" width="5" height="25" rx="2.5"/><rect x="60" y="50" width="5" height="25" rx="2.5"/><g fill="#757575"><circle cx="47" cy="15" r="2"/><circle cx="53" cy="15" r="2"/></g></g></svg>` },
                orc: { name: "Orc Grunt", hp: 60, mana: 5, damage: 15, xp: 50, gold: 20, description: "A brutish foe with a foul temper and a large club.", art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#4CAF50"><rect x="25" y="30" width="50" height="50" rx="10"/><circle cx="40" cy="45" r="5" fill="#FFC107"/><circle cx="60" cy="45" r="5" fill="#FFC107"/><rect x="35" y="60" width="30" height="8" fill="#212121"/><rect x="38" y="60" width="5" height="10" fill="#FFFFFF"/><rect x="57" y="60" width="5" height="10" fill="#FFFFFF"/></g></svg>` },
                darkMage: { name: "Dark Mage", hp: 50, mana: 40, damage: 18, xp: 60, gold: 25, description: "Wields forbidden, life-stealing magic.", art: `<svg class="character-art" viewBox="0 0 100 100"><g><path d="M50 10 L20 90 L80 90 Z" fill="#673AB7"/><circle cx="50" cy="30" r="15" fill="#9575CD"/><circle cx="50" cy="30" r="8" fill="#D1C4E9"/><path d="M40 80 L60 80 L55 95 L45 95 Z" fill="#4527A0"/></g></svg>`, abilities: [{ cost: 15, action: (caster, target) => { const dmg = Game.calculateDamage(25, 0.5); target.takeDamage(dmg); UI.log(`${caster.name} casts a shadow bolt for ${dmg} damage!`, 'damage'); } }] },
                giantSpider: { name: "Giant Spider", hp: 45, mana: 0, damage: 13, xp: 40, gold: 18, description: "A skittering nightmare with venomous fangs.", art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#424242"><circle cx="50" cy="50" r="20"/><path d="M30 50 C 10 30, 10 70, 30 50 Z"/><path d="M30 50 C 10 40, 5 60, 30 50 Z"/><path d="M30 50 C 15 50, 5 70, 30 50 Z"/><path d="M70 50 C 90 30, 90 70, 70 50 Z"/><path d="M70 50 C 90 40, 95 60, 70 50 Z"/><path d="M70 50 C 85 50, 95 70, 70 50 Z"/><g fill="#F44336"><circle cx="45" cy="45" r="2"/><circle cx="55" cy="45" r="2"/><circle cx="42" cy="50" r="2"/><circle cx="58" cy="50" r="2"/></g></g></svg>`},
            }
        };

        // --- Character Classes ---
        class Character {
            constructor(name, hp, mana, baseDamage, art) {
                this.name = name;
                this.maxHp = hp;
                this.hp = hp;
                this.maxMana = mana;
                this.mana = mana;
                this.baseDamage = baseDamage;
                this.art = art;
                this.statusEffects = {};
            }

            takeDamage(amount, fromPlayer = false) {
                let finalDamage = amount;
                if (this.statusEffects.shielded) {
                    finalDamage = Math.round(amount * 0.5);
                }
                this.hp = Math.max(0, this.hp - finalDamage);
                UI.showDamageIndicator(finalDamage, this instanceof Player ? 'player' : 'enemy');
                
                if (this instanceof Player) {
                    UI.shakeScreen(finalDamage);
                } else {
                    const artContainer = DOMElements.enemyArtContainer;
                    if (artContainer) {
                        artContainer.classList.add('attack-animation');
                        setTimeout(() => artContainer.classList.remove('attack-animation'), 500);
                    }
                }
                return finalDamage;
            }

            heal(amount) {
                this.hp = Math.min(this.maxHp, this.hp + amount);
                UI.showDamageIndicator(amount, this instanceof Player ? 'player' : 'enemy', false, 'heal');
            }
            
            updateMana(amount) {
                this.mana = Math.min(this.maxMana, Math.max(0, this.mana + amount));
            }

            addStatus(effect, duration) {
                if (this.statusEffects[effect]) {
                    this.statusEffects[effect].duration += duration;
                } else {
                    this.statusEffects[effect] = { duration };
                }
                UI.updateStatusEffects(this);
            }

            processStatusEffects() {
                let message = '';
                for (const effect in this.statusEffects) {
                    switch (effect) {
                        case 'poisoned':
                            const poisonDmg = Math.round(this.maxHp * 0.05);
                            this.takeDamage(poisonDmg);
                            UI.showDamageIndicator(poisonDmg, this instanceof Player ? 'player' : 'enemy', false, 'poison');
                            message += `${this.name} takes ${poisonDmg} poison damage. `;
                            break;
                    }
                    this.statusEffects[effect].duration--;
                    if (this.statusEffects[effect].duration <= 0) {
                        delete this.statusEffects[effect];
                    }
                }
                if (message) UI.log(message, 'debuff');
                UI.updateStatusEffects(this);
            }

            isStunned() {
                return this.statusEffects.stunned;
            }
        }

        class Player extends Character {
            constructor(playerClass) {
                const data = GameData.classes[playerClass];
                super(data.name, data.hp, data.mana, data.baseDamage, data.art);
                this.class = playerClass;
                this.level = 1;
                this.xp = 0;
                this.xpToNextLevel = 100;
                this.gold = 0;
                this.potions = 3;
                this.abilities = data.abilities;
                this.inventory = [{...GameData.items.rusty_sword}];
                this.equipment = { weapon: null, armor: null };
            }

            getDamage() {
                const weaponDamage = this.equipment.weapon ? this.equipment.weapon.damage : 0;
                return this.baseDamage + weaponDamage;
            }

            getDefense() {
                return this.equipment.armor ? this.equipment.armor.defense : 0;
            }

            takeDamage(amount) {
                const finalDamage = Math.max(1, amount - this.getDefense());
                super.takeDamage(finalDamage, false);
                Audio.play('hit', 'C3');
                UI.updatePlayerInfo();
            }

            heal(amount) {
                super.heal(amount);
                Audio.play('heal', 'C4', '4n');
                UI.updatePlayerInfo();
            }

            updateMana(amount) {
                super.updateMana(amount);
                UI.updatePlayerInfo();
            }

            addXp(amount) {
                this.xp += amount;
                UI.log(`${this.name} gained ${amount} XP!`, 'info');
                if (this.xp >= this.xpToNextLevel) {
                    this.levelUp();
                }
                UI.updatePlayerInfo();
            }

            levelUp() {
                Audio.play('levelUp', 'C5');
                this.level++;
                this.xp -= this.xpToNextLevel;
                this.xpToNextLevel = Math.round(this.xpToNextLevel * 1.35); 
                this.maxHp = Math.round(this.maxHp * 1.15);
                this.maxMana = Math.round(this.maxMana * 1.15);
                this.baseDamage += 2;
                this.hp = this.maxHp;
                this.mana = this.maxMana;
                UI.log(`${this.name} reached Level ${this.level}! Stats increased!`, 'victory');
            }

            equipItem(itemIndex) {
                const item = this.inventory[itemIndex];
                if (!item) return;

                // Equip the item
                this.equipment[item.type] = item;
                this.inventory.splice(itemIndex, 1);
                Audio.play('equip');
                UI.log(`Equipped ${item.name}.`, 'info');
                UI.updatePlayerInfo();

                // Mark item as equipped and used
                item._used = false;
            }

            // Override getDamage and getDefense to consume equipped item after first use
            getDamage() {
                const weapon = this.equipment.weapon;
                let damage = this.baseDamage;
                if (weapon) {
                    damage += weapon.damage;
                    if (!weapon._used) {
                        weapon._used = true;
                        // Remove weapon after first use
                        this.equipment.weapon = null;
                        UI.log(`${weapon.name} was consumed after use.`, 'info');
                        UI.updatePlayerInfo();
                    }
                }
                return damage;
            }

            getDefense() {
                const armor = this.equipment.armor;
                let defense = 0;
                if (armor) {
                    defense += armor.defense;
                    if (!armor._used) {
                        armor._used = true;
                        // Remove armor after first use
                        this.equipment.armor = null;
                        UI.log(`${armor.name} was consumed after use.`, 'info');
                        UI.updatePlayerInfo();
                    }
                }
                return defense;
            }
        }

        class Enemy extends Character {
            constructor(config) {
                super(config.name, config.hp, config.mana, config.damage, config.art);
                this.xpValue = config.xp;
                this.goldValue = config.gold;
                this.description = config.description;
                this.abilities = config.abilities || [];
                this.isBoss = config.isBoss || false;
            }

            drainMana(amount) {
                const drained = Math.min(this.mana, amount);
                this.mana -= drained;
                UI.updateEnemyInfo(this);
                return drained;
            }

            act(player) {
                if (this.isStunned()) {
                    UI.log(`${this.name} is stunned and cannot act!`, 'info');
                    return;
                }

                const usableAbilities = this.abilities.filter(ability => this.mana >= ability.cost);
                if (usableAbilities.length > 0 && Math.random() > 0.6) {
                    const ability = usableAbilities[Math.floor(Math.random() * usableAbilities.length)];
                    this.mana -= ability.cost;
                    ability.action(this, player);
                } else {
                    const dmg = Game.calculateDamage(this.baseDamage);
                    player.takeDamage(dmg);
                    UI.log(`${this.name} attacks for ${dmg} damage.`, 'damage');
                }
            }
        }

        const EnemyFactory = {
            create(level) {
                if (level > 0 && level % 5 === 0) {
                    return this.createBoss(level);
                }
                const enemyKeys = Object.keys(GameData.enemies);
                const randomKey = enemyKeys[Math.floor(Math.random() * enemyKeys.length)];
                const baseEnemy = {...GameData.enemies[randomKey]};
                
                const scale = 1 + (level - 1) * 0.18; 
                baseEnemy.hp = Math.round(baseEnemy.hp * scale);
                baseEnemy.damage = Math.round(baseEnemy.damage * scale);
                baseEnemy.xp = Math.round(baseEnemy.xp * scale);
                baseEnemy.gold = Math.round(baseEnemy.gold * scale);

                return new Enemy(baseEnemy);
            },
            createBoss(level) {
                Audio.play('boss');
                const bossData = { 
                    name: 'Abyss Dragon', art: `<svg class="character-art" viewBox="0 0 100 100"><g fill="#4A148C"><path d="M50 10 C 20 40, 20 70, 50 90 C 80 70, 80 40, 50 10 Z"/><path d="M50 10 L 40 30 L 60 30 Z" fill="#F06292"/><path d="M30 60 L 20 70 L 40 70 Z" fill="#E91E63"/><path d="M70 60 L 80 70 L 60 70 Z" fill="#E91E63"/><circle cx="45" cy="40" r="5" fill="#FFEB3B"/><circle cx="55" cy="40" r="5" fill="#FFEB3B"/></g></svg>`, 
                    hp: 300, mana: 100, damage: 25, xp: 500, gold: 200, isBoss: true,
                    description: 'The final horror of the dungeon!',
                    abilities: [{ cost: 30, action: (caster, target) => { const dmg = Game.calculateDamage(50, 0.5); target.takeDamage(dmg); UI.log(`${caster.name} breathes a torrent of shadowflame for ${dmg} damage!`, 'damage'); } }]
                };
                const scale = 1 + (level / 5 - 1) * 0.25;
                bossData.hp = Math.round(bossData.hp * scale);
                bossData.damage = Math.round(bossData.damage * scale);
                bossData.xp = Math.round(bossData.xp * scale);
                bossData.gold = Math.round(bossData.gold * scale);

                return new Enemy(bossData);
            }
        };

        // --- UI Module ---
        const UI = {
            showScreen(screen) {
                ['gameContainer', 'startScreen', 'classSelectionScreen', 'gameOverScreen', 'eventScreen'].forEach(s => {
                    if (DOMElements[s]) {
                        DOMElements[s].classList.add('hidden');
                        DOMElements[s].style.display = '';
                    }
                });
                if (DOMElements[screen]) {
                    DOMElements[screen].classList.remove('hidden');
                    if (screen === 'gameContainer' || screen === 'startScreen') {
                         DOMElements[screen].style.display = 'block'; // Use block for main containers
                    } else {
                         DOMElements[screen].style.display = 'flex'; // Use flex for modals
                    }
                }
            },

            log(message, type = 'info') {
                const logEntry = document.createElement('div');
                let colorClass = 'text-gray-400';
                if (type === 'attack') colorClass = 'text-red-400';
                if (type === 'damage') colorClass = 'text-orange-400';
                if (type === 'victory') colorClass = 'text-green-400 font-bold';
                if (type === 'heal') colorClass = 'text-green-300';
                if (type === 'ability') colorClass = 'text-purple-400';
                if (type === 'debuff') colorClass = 'text-lime-400 italic';
                if (type === 'error') colorClass = 'text-yellow-500 font-bold';
                if (type === 'run') colorClass = 'text-blue-300 italic';
                
                logEntry.className = `log-message p-2 text-sm sm:text-base ${colorClass}`;
                logEntry.textContent = `> ${message}`;
                if(DOMElements.gameLog) {
                    DOMElements.gameLog.appendChild(logEntry);
                    DOMElements.gameLog.scrollTop = DOMElements.gameLog.scrollHeight;
                }
            },

            shakeScreen(intensity) {
                let shakeClass = 'shake-light';
                if (intensity > 20) shakeClass = 'shake-heavy';
                else if (intensity > 10) shakeClass = 'shake-medium';
                
                DOMElements.body.classList.add(shakeClass);
                setTimeout(() => DOMElements.body.classList.remove(shakeClass), 500);
            },

            showDamageIndicator(amount, target, isCrit = false, type = 'damage') {
                const container = target === 'enemy' ? DOMElements.enemyDamageContainer : document.getElementById('player-damage-container');
                if (!container) return;
                const indicator = document.createElement('div');
                indicator.textContent = amount;
                let classes = 'damage-indicator ';
                if (isCrit) classes += 'crit ';
                if (type === 'heal') classes += 'heal ';
                if (type === 'drain') classes += 'drain ';
                if (type === 'poison') classes += 'poison ';
                indicator.className = classes;
                container.appendChild(indicator);
                setTimeout(() => indicator.remove(), 1500);
            },

            updatePlayerInfo() {
                const player = gameState.player;
                if (!player || !DOMElements.playerInfoContainer) return;

                const hpDisplay = `${player.hp.toFixed(1)} / ${player.maxHp.toFixed(1)}`;
                const manaDisplay = `${player.mana} / ${player.maxMana}`;
                const xpDisplay = `${player.xp} / ${player.xpToNextLevel}`;
                const playerCardHTML = `
                    <div class="bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-700 space-y-3 sm:space-y-4 relative">
                        <div id="player-damage-container" class="absolute w-full h-full top-0 left-0 pointer-events-none"></div>
                        <div class="flex items-center gap-3 sm:gap-4">
                            <div id="player-art-container" class="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">${player.art}</div>
                            <div>
                                <h2 class="text-xl sm:text-2xl">${player.name} - Lvl ${player.level}</h2>
                                <p class="text-sm text-gray-400">${player.class.charAt(0).toUpperCase() + player.class.slice(1)}</p>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between text-xs sm:text-sm mb-1"><span>HP</span><span>${hpDisplay}</span></div>
                            <div class="health-bar-container"><div class="health-bar h-3 sm:h-4" style="width: ${player.hp / player.maxHp * 100}%"></div></div>
                        </div>
                        <div>
                            <div class="flex justify-between text-xs sm:text-sm mb-1"><span>Mana</span><span>${manaDisplay}</span></div>
                            <div class="health-bar-container"><div class="mana-bar h-3 sm:h-4" style="width: ${player.mana / player.maxMana * 100}%"></div></div>
                        </div>
                        <div>
                            <div class="flex justify-between text-xs sm:text-sm mb-1"><span>XP</span><span>${xpDisplay}</span></div>
                            <div class="xp-bar"><div class="xp-bar-fill" style="width: ${player.xp / player.xpToNextLevel * 100}%"></div></div>
                        </div>
                        <div id="player-status-effects" class="flex gap-2 h-6"></div>
                        <div class="border-t border-gray-700 pt-2">
                            <div class="flex justify-center gap-4 mb-2 text-gray-400 text-sm">
                                <div id="tab-equipment" class="tab active">Equipment</div>
                                <div id="tab-inventory" class="tab">Inventory</div>
                            </div>
                            <div id="equipment-section"></div>
                            <div id="inventory-section" class="hidden"></div>
                        </div>
                    </div>
                `;
                DOMElements.playerInfoContainer.innerHTML = playerCardHTML;
                this.updateStatusEffects(player);
                this.updateEquipmentAndInventory();
                document.getElementById('tab-equipment').addEventListener('click', () => this.switchTab('equipment'));
                document.getElementById('tab-inventory').addEventListener('click', () => this.switchTab('inventory'));
                DOMElements.playerGoldDisplay.textContent = `💰 ${player.gold}`;
                DOMElements.playerPotionsDisplay.textContent = `🧪 ${player.potions}`;
            },

            updateEquipmentAndInventory() {
                const player = gameState.player;
                const equipmentSection = document.getElementById('equipment-section');
                const inventorySection = document.getElementById('inventory-section');
                if(!equipmentSection || !inventorySection) return;

                const weaponSlot = player.equipment.weapon ? 
                    `<div class="inventory-item flex items-center gap-2"> ${player.equipment.weapon.art} ${player.equipment.weapon.name} <div class="tooltip">${player.equipment.weapon.type}: +${player.equipment.weapon.damage} dmg</div></div>` : '<span>Weapon: Empty</span>';
                const armorSlot = player.equipment.armor ? 
                    `<div class="inventory-item flex items-center gap-2"> ${player.equipment.armor.art} ${player.equipment.armor.name} <div class="tooltip">${player.equipment.armor.type}: +${player.equipment.armor.defense} def</div></div>` : '<span>Armor: Empty</span>';
                equipmentSection.innerHTML = `<div class="space-y-2 text-gray-300 text-sm">${weaponSlot}${armorSlot}</div>`;

                if (player.inventory.length === 0) {
                    inventorySection.innerHTML = `<div class="text-gray-500 text-sm text-center italic">Inventory is empty.</div>`;
                } else {
                    inventorySection.innerHTML = player.inventory.map((item, index) => `
                        <div class="inventory-item flex justify-between items-center text-sm text-gray-300 p-1 hover:bg-gray-700 rounded">
                            <span class="flex items-center gap-2">${item.art} ${item.name} <div class="tooltip">${item.type}: +${item.damage || item.defense} ${item.damage ? 'dmg' : 'def'}</div></span>
                            <button class="equip-btn text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded" data-index="${index}">Equip</button>
                        </div>
                    `).join('');
                }

                document.querySelectorAll('.equip-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const index = parseInt(e.target.dataset.index);
                        gameState.player.equipItem(index);
                    });
                });
            },

            switchTab(tabName) {
                document.getElementById('tab-equipment').classList.toggle('active', tabName === 'equipment');
                document.getElementById('tab-inventory').classList.toggle('active', tabName === 'inventory');
                document.getElementById('equipment-section').classList.toggle('hidden', tabName !== 'equipment');
                document.getElementById('inventory-section').classList.toggle('hidden', tabName !== 'inventory');
            },

            updateEnemyInfo(enemy) {
                if (!enemy) return;
                DOMElements.enemyName.textContent = enemy.name;
                DOMElements.enemyArtContainer.innerHTML = `<div class="enemy-idle">${enemy.art}</div>`;
                DOMElements.enemyHealthBar.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
                DOMElements.enemyHealthBar.textContent = `${enemy.hp.toFixed(1)} / ${enemy.maxHp.toFixed(1)}`;
                DOMElements.enemyDescription.textContent = enemy.description;
                this.updateStatusEffects(enemy);
            },
            
            updateActionButtons() {
                const player = gameState.player;
                if(!player || !DOMElements.actionButtonsContainer) return;
                DOMElements.actionButtonsContainer.innerHTML = '';
                
                const attackBtn = this.createButton('Attack', 'bg-red-600', 'hover:bg-red-700', () => Game.playerTurn('attack'));
                attackBtn.innerHTML += `<span class="tooltip">A basic attack dealing damage.</span>`;
                DOMElements.actionButtonsContainer.appendChild(attackBtn);

                player.abilities.forEach(abilityRef => {
                    const ability = GameData.abilities[abilityRef.id];
                    let tooltip = ability.description;
                    // Show correct damage range for special attacks
                    if (["power_strike","poison_stab","eviscerate","smite","divine_strike"].includes(abilityRef.id)) {
                        tooltip = tooltip.replace(/\d+(\.\d+)?x to \d+(\.\d+)?x|\d+(\.\d+)?x|1.5x to 2x|2x to 3x|1.2x|1.3x/g, "2x to 3x");
                    }
                    const btn = this.createButton(ability.name, 'bg-blue-600', 'hover:bg-blue-700', () => Game.playerTurn(abilityRef.id), player.mana < abilityRef.cost);
                    btn.innerHTML += `<span class="tooltip">${tooltip} (Cost: ${abilityRef.cost} Mana)</span>`;
                    DOMElements.actionButtonsContainer.appendChild(btn);
                });

                const potionBtn = this.createButton(`Potion (${player.potions})`, 'bg-green-600', 'hover:bg-green-700', () => Game.playerTurn('potion'), player.potions <= 0);
                potionBtn.innerHTML += `<span class="tooltip">Restores 50% of your maximum health.</span>`;
                DOMElements.actionButtonsContainer.appendChild(potionBtn);
                
                const runBtn = this.createButton('Run', 'bg-gray-500', 'hover:bg-gray-600', () => Game.run());
                runBtn.innerHTML += `<span class="tooltip">Attempt to flee from combat. (50% chance)</span>`;
                DOMElements.actionButtonsContainer.appendChild(runBtn);
            },

            updateTurnIndicator(turn) {
                const indicator = DOMElements.turnIndicatorContainer;
                if(!indicator) return;
                if (turn === 'player') {
                    indicator.innerHTML = `<span class="turn-indicator player-turn">Player's Turn</span>`;
                } else {
                    indicator.innerHTML = `<span class="turn-indicator enemy-turn">Enemy's Turn</span>`;
                }
            },

            updateStatusEffects(character) {
                const containerId = character instanceof Player ? 'player-status-effects' : 'enemy-status-effects';
                const container = document.getElementById(containerId);
                if (!container) return;
                
                container.innerHTML = Object.keys(character.statusEffects).map(effect => {
                    let icon = '';
                    if (effect === 'poisoned') icon = '☠️';
                    if (effect === 'shielded') icon = '🛡️';
                    if (effect === 'stunned') icon = '💫';
                    return `<span class="status-effect-icon" title="${effect} (${character.statusEffects[effect].duration} turns)">${icon}</span>`;
                }).join('');
            },

            showShop() {
                const player = gameState.player;
                const otherClasses = Object.keys(GameData.classes).filter(c => c !== player.class);
                const switchCost = 200 + (player.level * 25);

                const shopHTML = `
                    <h2 class="text-3xl sm:text-4xl text-yellow-400 mb-2" style="font-family: 'MedievalSharp', cursive;">Wandering Merchant</h2>
                    <p class="text-gray-400 mb-6 text-sm sm:text-base">A brief respite. Spend your gold wisely.</p>
                    
                    <div class="space-y-4 mb-6">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-700 p-3 sm:p-4 rounded-lg border border-gray-600 gap-2">
                            <div><h3 class="text-lg sm:text-xl text-green-400">Healing Potion (25g)</h3><p class="text-xs sm:text-sm text-gray-300">Restores 50% of your maximum health.</p></div>
                            <button id="buy-potion-btn" class="btn bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto" ${player.gold < 25 ? 'disabled' : ''}>Buy</button>
                        </div>
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-700 p-3 sm:p-4 rounded-lg border border-gray-600 gap-2">
                            <div><h3 class="text-lg sm:text-xl text-red-400">Strength Elixir (100g)</h3><p class="text-xs sm:text-sm text-gray-300">Permanently increases your base damage by 2.</p></div>
                            <button id="buy-strength-btn" class="btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto" ${player.gold < 100 ? 'disabled' : ''}>Buy</button>
                        </div>
                         <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-700 p-3 sm:p-4 rounded-lg border border-gray-600 gap-2">
                            <div><h3 class="text-lg sm:text-xl text-blue-400">Tome of Knowledge (150g)</h3><p class="text-xs sm:text-sm text-gray-300">Permanently increases your max mana by 10.</p></div>
                            <button id="buy-mana-btn" class="btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto" ${player.gold < 150 ? 'disabled' : ''}>Buy</button>
                        </div>
                    </div>

                    <div class="border-t border-gray-600 pt-6 mt-6">
                        <h3 class="text-2xl sm:text-3xl text-yellow-400 mb-4" style="font-family: 'MedievalSharp', cursive;">Recruit a New Hero</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${otherClasses.map(c => `
                                <div class="bg-gray-700 p-4 rounded-lg border border-gray-600 text-left">
                                    <h4 class="text-lg sm:text-xl text-green-400">${GameData.classes[c].name}</h4>
                                    <p class="text-xs sm:text-sm text-gray-300 mb-3">Switch to this class. Your level, gold, and items will be kept.</p>
                                    <button class="switch-class-btn btn bg-purple-600 hover:bg-purple-700 w-full" data-class="${c}" ${player.gold < switchCost ? 'disabled' : ''}>Recruit (${switchCost}g)</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <button id="leave-shop-btn" class="btn bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg text-lg sm:text-xl mt-8 w-full">Continue Dungeon</button>
                `;
                DOMElements.eventContent.innerHTML = shopHTML;
                this.showScreen('eventScreen');

                document.getElementById('buy-potion-btn').addEventListener('click', () => Game.buyPotion());
                document.getElementById('buy-strength-btn').addEventListener('click', () => Game.buyStrength());
                document.getElementById('buy-mana-btn').addEventListener('click', () => Game.buyMana());
                document.querySelectorAll('.switch-class-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => Game.switchPlayer(e.target.dataset.class, switchCost));
                });
                document.getElementById('leave-shop-btn').addEventListener('click', () => Game.leaveEvent());
            },

            showTreasure(item) {
                const treasureHTML = `
                    <h2 class="text-3xl sm:text-4xl text-yellow-400 mb-2" style="font-family: 'MedievalSharp', cursive;">Treasure Found!</h2>
                    <div class="my-6 text-5xl sm:text-6xl">${item.art}</div>
                    <p class="text-gray-300 mb-6 text-lg sm:text-xl">You found a <span class="text-green-400">${item.name}</span>!</p>
                    <button id="take-treasure-btn" class="btn bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg sm:text-xl w-full">Take Item</button>
                `;
                DOMElements.eventContent.innerHTML = treasureHTML;
                this.showScreen('eventScreen');

                document.getElementById('take-treasure-btn').addEventListener('click', () => {
                    gameState.player.inventory.push(item);
                    this.log(`Added ${item.name} to inventory.`, 'info');
                    Audio.play('gold', 'G5');
                    Game.leaveEvent();
                });
            },

            createButton(text, ...args) {
                const btn = document.createElement('button');
                const [bgColor, hoverColor, action, disabled] = args;
                btn.textContent = text;
                btn.className = `btn ${bgColor} ${hoverColor} text-white font-bold py-2 px-3 sm:px-4 rounded text-sm sm:text-base`;
                btn.disabled = disabled;
                btn.addEventListener('click', action);
                return btn;
            }
        };

        // --- Game Logic Module ---
        const Game = {
            isPlayerTurn: true,

            calculateDamage(base, variance = 0.4) {
                const min = base * (1 - variance / 2);
                const max = base * (1 + variance / 2);
                return Math.max(1, Math.floor(Math.random() * (max - min + 1)) + min);
            },

            async startNewGame(playerClass) {
                gameState = {
                    player: new Player(playerClass),
                    dungeonLevel: 0,
                    enemiesDefeated: 0,
                };
                gameState.player.equipItem(0);
                UI.showScreen('gameContainer');
                this.nextLevel();
                await this.save();
            },

            async continueGame() {
                UI.showScreen('gameContainer');
                if (gameState.enemy) {
                    this.startCombat();
                } else {
                    this.nextLevel();
                }
            },

            nextLevel() {
                gameState.dungeonLevel++;
                DOMElements.dungeonLevelDisplay.textContent = `Level: ${gameState.dungeonLevel}`;
                
                if (gameState.dungeonLevel > 1 && gameState.dungeonLevel % 3 === 0 && gameState.dungeonLevel % 5 !== 0) {
                    UI.showShop();
                } else {
                    this.loadEnemy();
                }
            },

            loadEnemy() {
                gameState.enemy = EnemyFactory.create(gameState.dungeonLevel);
                UI.log(`A wild ${gameState.enemy.name} appears!`, gameState.enemy.isBoss ? 'damage' : 'info');
                this.startCombat();
            },

            startCombat() {
                this.isPlayerTurn = true;
                UI.updatePlayerInfo();
                UI.updateEnemyInfo(gameState.enemy);
                UI.updateActionButtons();
                UI.updateTurnIndicator('player');
            },

            playerTurn(actionId) {
                if (!this.isPlayerTurn || !gameState.enemy) return;
                const { player, enemy } = gameState;

                let actionTaken = false;
                if (actionId === 'attack') {
                    const dmg = this.calculateDamage(player.getDamage());
                    enemy.takeDamage(dmg, true);
                    Audio.play('hit', 'G4');
                    UI.log(`${player.name} attacks for ${dmg} damage.`, 'attack');
                    actionTaken = true;
                } else if (actionId === 'potion') {
                    if (player.potions > 0) {
                        player.potions--;
                        const healed = Math.round(player.maxHp * 0.5);
                        player.heal(healed);
                        Audio.play('potion');
                        UI.log(`${player.name} uses a potion, healing for ${healed} health.`, 'heal');
                        actionTaken = true;
                    } else {
                        UI.log('You are out of potions!', 'error');
                    }
                } else {
                    const abilityRef = player.abilities.find(a => a.id === actionId);
                    if (abilityRef) {
                        const ability = GameData.abilities[actionId];
                        if (player.mana >= abilityRef.cost) {
                            player.updateMana(-abilityRef.cost);
                            ability.execute(player, enemy);
                            actionTaken = true;
                        } else {
                            UI.log('Not enough mana!', 'error');
                        }
                    }
                }

                if (actionTaken) {
                    this.endPlayerTurn();
                }
            },

            run() {
                if (!this.isPlayerTurn) return;
                Audio.play('run');
                if (Math.random() < 0.5) {
                    UI.log('You successfully escaped!', 'run');
                    gameState.enemy = null;
                    setTimeout(() => this.nextLevel(), 1000);
                } else {
                    UI.log('Your attempt to flee failed!', 'error');
                    this.isPlayerTurn = false;
                    UI.updateActionButtons();
                    UI.updateTurnIndicator('enemy');
                    setTimeout(() => {
                        UI.log('The enemy gets a free attack!', 'damage');
                        this.enemyTurn();
                    }, 1000);
                }
            },

            endPlayerTurn() {
                UI.updatePlayerInfo();
                UI.updateEnemyInfo(gameState.enemy);

                if (gameState.enemy.hp <= 0) {
                    this.victory();
                    return;
                }
                
                this.isPlayerTurn = false;
                UI.updateActionButtons();
                UI.updateTurnIndicator('enemy');
                setTimeout(() => this.enemyTurn(), 1000);
            },

            enemyTurn() {
                if(gameState.player.hp <= 0 || !gameState.enemy) return;

                gameState.enemy.processStatusEffects();
                if(gameState.enemy.hp > 0) {
                    gameState.enemy.act(gameState.player);
                }
                UI.updateEnemyInfo(gameState.enemy);

                if (gameState.player.hp <= 0) {
                    this.gameOver('You have been defeated!');
                    return;
                }

                this.endEnemyTurn();
            },

            endEnemyTurn() {
                gameState.player.processStatusEffects();
                UI.updatePlayerInfo();

                if (gameState.player.hp <= 0) {
                    this.gameOver('You succumbed to your wounds!');
                    return;
                }

                this.isPlayerTurn = true;
                UI.updateActionButtons();
                UI.updateTurnIndicator('player');
                this.save();
            },

            victory() {
                const { player, enemy } = gameState;
                UI.log(`You have defeated the ${enemy.name}!`, 'victory');
                Audio.play('win');

                player.addXp(enemy.xpValue);
                player.gold += enemy.goldValue;
                Audio.play('gold', 'E5');
                UI.log(`You found ${enemy.goldValue} gold.`, 'info');
                gameState.enemiesDefeated++;
                gameState.enemy = null;

                if (Math.random() < 0.35 || enemy.isBoss) {
                    const itemKeys = Object.keys(GameData.items);
                    const randomItemKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
                    const droppedItem = {...GameData.items[randomItemKey]};
                    setTimeout(() => UI.showTreasure(droppedItem), 1000);
                } 
                else if (Math.random() < 0.40) { 
                    player.potions++;
                    UI.log(`The ${enemy.name} dropped a health potion!`, 'info');
                    UI.updatePlayerInfo();
                    setTimeout(() => this.nextLevel(), 1500);
                }
                else {
                    setTimeout(() => this.nextLevel(), 1500);
                }
                this.save();
            },
            
            leaveEvent() {
                UI.showScreen('gameContainer');
                this.loadEnemy();
            },

            buyPotion() {
                if (gameState.player.gold >= 25) {
                    gameState.player.gold -= 25;
                    gameState.player.potions++;
                    UI.log('Purchased a Healing Potion.', 'info');
                    Audio.play('gold', 'C5');
                    UI.updatePlayerInfo();
                    UI.showShop();
                }
            },
            buyStrength() {
                if (gameState.player.gold >= 100) {
                    gameState.player.gold -= 100;
                    gameState.player.baseDamage += 2;
                    UI.log('Purchased a Strength Elixir. Base damage increased!', 'info');
                    Audio.play('gold', 'C5');
                    UI.updatePlayerInfo();
                    UI.showShop();
                }
            },
            buyMana() {
                 if (gameState.player.gold >= 150) {
                    gameState.player.gold -= 150;
                    gameState.player.maxMana += 10;
                    UI.log('Purchased a Tome of Knowledge. Max mana increased!', 'info');
                    Audio.play('gold', 'C5');
                    UI.updatePlayerInfo();
                    UI.showShop();
                }
            },
            
            switchPlayer(newClass, cost) {
                const player = gameState.player;
                if (player.gold >= cost) {
                    player.gold -= cost;
                    UI.log(`You paid ${cost}g to recruit a ${newClass}.`, 'info');

                    const oldPlayer = player;
                    const newPlayer = new Player(newClass);

                    // Transfer progress
                    newPlayer.level = oldPlayer.level;
                    newPlayer.xp = oldPlayer.xp;
                    newPlayer.xpToNextLevel = oldPlayer.xpToNextLevel;
                    newPlayer.gold = oldPlayer.gold;
                    newPlayer.potions = oldPlayer.potions;
                    newPlayer.inventory = oldPlayer.inventory;
                    
                    // Add old equipment to inventory
                    if(oldPlayer.equipment.weapon) newPlayer.inventory.push(oldPlayer.equipment.weapon);
                    if(oldPlayer.equipment.armor) newPlayer.inventory.push(oldPlayer.equipment.armor);

                    gameState.player = newPlayer;
                    UI.log(`The ${oldPlayer.class} retires and the ${newPlayer.class} joins the adventure!`, 'victory');
                    Audio.play('levelUp');
                    this.save();
                    UI.showShop(); // Refresh shop UI
                }
            },


            async gameOver(message) {
                Audio.play('lose');
                DOMElements.gameOverMessage.textContent = message;
                const { player, dungeonLevel, enemiesDefeated } = gameState;
                DOMElements.gameOverStats.innerHTML = `
                    <p>Dungeon Level Reached: ${dungeonLevel}</p>
                    <p>Enemies Defeated: ${enemiesDefeated}</p>
                    <p>Total Gold Found: ${player.gold}</p>
                `;
                UI.showScreen('gameOverScreen');
                await this.deleteSave();
            },

            async save() {
                if (!gameState.player) return;
                const saveData = JSON.stringify(gameState, (key, value) => {
                    // Don't save the DOM element reference in the enemy art
                    if (key === 'art' && typeof value !== 'string') {
                        return undefined;
                    }
                    return value;
                });

                // Save to local storage first as a fallback
                localStorage.setItem(localSaveKey, saveData);

                if (isOnline && db && userId) {
                    try {
                        const docRef = doc(db, 'artifacts', appId, 'users', userId);
                        await setDoc(docRef, JSON.parse(saveData));
                    } catch (e) {
                        console.error("Error saving game to Firestore:", e);
                    }
                }
            },

            async load() {
                let data = null;
                // Try loading from Firestore first if online
                if (isOnline && db && userId) {
                    try {
                        const docRef = doc(db, 'artifacts', appId, 'users', userId);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            data = docSnap.data();
                        }
                    } catch (e) {
                        console.error("Error loading from Firestore:", e);
                    }
                }

                // If Firestore fails or offline, try local storage
                if (!data) {
                    const localData = localStorage.getItem(localSaveKey);
                    if (localData) {
                        data = JSON.parse(localData);
                    }
                }

                if(data && data.player) {
                    // Re-hydrate player object into the Player class
                    const loadedPlayer = new Player(data.player.class);
                    Object.assign(loadedPlayer, data.player);
                    gameState.player = loadedPlayer;
                    
                    // Re-hydrate the rest of the game state
                    gameState.dungeonLevel = data.dungeonLevel;
                    gameState.enemiesDefeated = data.enemiesDefeated;

                    if (data.enemy) {
                         const enemyData = GameData.enemies[data.enemy.name.toLowerCase().replace(' ', '')] || Object.values(GameData.enemies).find(e => e.name === data.enemy.name) || data.enemy;
                        const loadedEnemy = new Enemy({...enemyData, ...data.enemy});
                        gameState.enemy = loadedEnemy;
                    } else {
                        gameState.enemy = null;
                    }
                    return true;
                }
                return null;
            },

            async deleteSave() {
                localStorage.removeItem(localSaveKey);
                if (isOnline && db && userId) {
                    try {
                        const docRef = doc(db, 'artifacts', appId, 'users', userId);
                        await deleteDoc(docRef);
                    } catch (e) {
                        console.error("Error deleting Firestore save:", e);
                    }
                }
            }
        };

        // --- Initialization ---
        async function init() {
            Audio.init();
            
            DOMElements.continueBtn.addEventListener('click', async () => {
                if (await Game.load()) {
                    Game.continueGame();
                } else {
                    UI.log("No saved game found.", 'error');
                }
            });
            DOMElements.startGameBtn.addEventListener('click', () => UI.showScreen('classSelectionScreen'));
            document.getElementById('select-warrior').addEventListener('click', () => Game.startNewGame('warrior'));
            document.getElementById('select-mage').addEventListener('click', () => Game.startNewGame('mage'));
            document.getElementById('select-rogue').addEventListener('click', () => Game.startNewGame('rogue'));
            document.getElementById('select-cleric').addEventListener('click', () => Game.startNewGame('cleric'));
            document.getElementById('select-paladin').addEventListener('click', () => Game.startNewGame('paladin'));
            document.getElementById('new-game-btn').addEventListener('click', () => {
                Game.deleteSave().then(() => location.reload());
            });
            
            // Check for local save immediately
            const localData = localStorage.getItem(localSaveKey);
            DOMElements.continueBtn.classList.toggle('hidden', !localData);
            DOMElements.startGameBtn.disabled = false;
            UI.showScreen('startScreen');


            // Auth Flow for online features
            if (auth) {
                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        isOnline = true;
                        userId = user.uid;
                        DOMElements.authStatus.textContent = `Online`;
                        const savedGameExists = await Game.load();
                        DOMElements.continueBtn.classList.toggle('hidden', !savedGameExists);
                    } else {
                        DOMElements.authStatus.textContent = "Authenticating...";
                        try {
                            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                await signInWithCustomToken(auth, __initial_auth_token);
                            } else {
                                await signInAnonymously(auth);
                            }
                        } catch(error) {
                            console.error("Authentication failed:", error);
                            isOnline = false;
                            DOMElements.authStatus.textContent = "Auth Failed. Offline Mode.";
                        }
                    }
                });
            } else {
                 DOMElements.authStatus.textContent = "Offline Mode";
            }
        }

        init();