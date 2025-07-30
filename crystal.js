// Game variables
let engine, render, world;
let crystals = [];
let projectiles = [];
let gems = [];
let currentLevel = 1;
let shotsRemaining = 3;
let score = 0;
let highScore = localStorage.getItem('crystalHighScore') || 0;
let gameState = 'start'; // start, aiming, firing, levelComplete, gameOver
let aimPosition = { x: 0, y: 0 };
let launchPower = 0;
let levelObjectives = {};
let initialLevelGemObjective = 0; // To store the initial gem objective for the level
let levelCompleted = false;
let gameReadinessCheckTimeout = null; // To prevent multiple timeouts for game state transition

// DOM elements
const canvas = document.getElementById('gameCanvas');
const startScreen = document.getElementById('start-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const nextLevelButton = document.getElementById('next-level-button');
const restartButton = document.getElementById('restart-button');
const levelDisplay = document.getElementById('level-display');
const shotsDisplay = document.getElementById('shots');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('high-score');
const levelScoreDisplay = document.getElementById('level-score');
const finalScoreDisplay = document.getElementById('final-score');
const aimIndicator = document.getElementById('aim-indicator');

// Sound effects
const sounds = {
    launch: new Howl({ src: ['https://assets.codepen.io/417525/shot.mp3'] }),
    crystalBreak: new Howl({ src: ['https://assets.codepen.io/417525/glass.mp3'], volume: 0.7 }),
    gemCollect: new Howl({ src: ['https://assets.codepen.io/417525/collect.mp3'] }),
    explosion: new Howl({ src: ['https://assets.codepen.io/417525/explosion.mp3'], volume: 0.6 }),
    levelComplete: new Howl({ src: ['https://assets.codepen.io/417525/level-up.mp3'] }),
    gameOver: new Howl({ src: ['https://assets.codepen.io/417525/game-over.mp3'] })
};

// Initialize Matter.js
function initEngine() {
    // If engine or render already exist, clear them to prevent multiple instances
    if (engine) Matter.Engine.clear(engine);
    if (render) Matter.Render.stop(render);
    if (world) Matter.World.clear(world, false); // Clear bodies but keep gravity etc.

    engine = Matter.Engine.create({
        gravity: { x: 0, y: 1 }
    });
    
    world = engine.world;
    
    render = Matter.Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: 800,
            height: 600,
            wireframes: false,
            background: 'transparent'
        }
    });
    
    Matter.Render.run(render);
    Matter.Runner.run(engine);
    
    // Add boundaries
    const boundaries = [
        // Ground - thicker and with friction
        Matter.Bodies.rectangle(400, 605, 810, 30, { 
            isStatic: true,
            friction: 0.1,
            render: { fillStyle: '#3c096c' }
        }),
        // Left wall
        Matter.Bodies.rectangle(-5, 300, 10, 620, { 
            isStatic: true,
            render: { fillStyle: '#3c096c' }
        }),
        // Right wall
        Matter.Bodies.rectangle(805, 300, 10, 620, { 
            isStatic: true,
            render: { fillStyle: '#3c096c' }
        })
    ];
    
    Matter.World.add(world, boundaries);
    
    // Add collision events
    Matter.Events.on(engine, 'collisionStart', handleCollisions);
    // Add afterUpdate event to continuously check game readiness
    Matter.Events.on(engine, 'afterUpdate', checkGameReadiness);
}

// Initialize game
function initGame() {
    // Clear existing objects from the world and arrays
    // Remove projectiles first as they might be interacting with other bodies
    projectiles.forEach(projectile => Matter.World.remove(world, projectile));
    crystals.forEach(crystal => Matter.World.remove(world, crystal));
    gems.forEach(gem => Matter.World.remove(world, gem));
    
    crystals = [];
    projectiles = [];
    gems = [];
    
    // Reset game state
    shotsRemaining = 3;
    levelObjectives = getLevelObjectives(currentLevel);
    initialLevelGemObjective = levelObjectives.gems; // Store initial gem objective
    levelCompleted = false;
    
    // Clear any pending game readiness check timeout
    if (gameReadinessCheckTimeout) {
        clearTimeout(gameReadinessCheckTimeout);
        gameReadinessCheckTimeout = null;
    }

    // Create crystals based on level
    createCrystals();
    
    // Create gems
    createGems();
    
    // Create projectile launcher
    createLauncher();
    
    // Update UI
    updateUI();
    
    // Set game state
    gameState = 'aiming';
}

// Get objectives for current level
function getLevelObjectives(level) {
    return {
        gems: Math.min(level * 3, 15),
        crystals: Math.min(level * 5, 25),
        score: level * 500
    };
}

// Create crystals
function createCrystals() {
    const crystalTypes = ['glass', 'ruby', 'emerald', 'amethyst', 'topaz'];
    const crystalStrength = {
        'glass': 1,
        'ruby': 3,
        'emerald': 2,
        'amethyst': 2,
        'topaz': 4
    };
    // Map crystal types to colors for Matter.js rendering
    const crystalColors = {
        'glass': '#7ebaff',    // Light blue
        'ruby': '#ff2b2b',     // Red
        'emerald': '#2bff6b',  // Green
        'amethyst': '#c27bff', // Purple
        'topaz': '#ffc02b'     // Orange
    };
    
    // Create crystal formations
    for (let i = 0; i < 5 + currentLevel * 2; i++) {
        const type = crystalTypes[Math.floor(Math.random() * crystalTypes.length)];
        const x = 300 + Math.random() * 300;
        const y = 200 + Math.random() * 200;
        const radius = 20 + Math.random() * 15;
        const sides = Math.floor(6 + Math.random() * 4);
        
        const crystal = Matter.Bodies.polygon(x, y, sides, radius, {
            restitution: 0.6,
            friction: 0.01,
            density: 0.05,
            render: { 
                fillStyle: crystalColors[type], // Use direct color for Matter.js
                strokeStyle: '#ffffff',
                lineWidth: 2
            },
            crystalType: type,
            health: crystalStrength[type],
            label: 'crystal'
        });
        
        crystals.push(crystal);
        Matter.World.add(world, crystal);
    }
}

// Create gems
function createGems() {
    const gemColors = ['#ff6b6b', '#6bff9c', '#ffd96b', '#d9a3ff', '#a3d9ff'];
    
    // Place gems near crystals
    crystals.forEach(crystal => {
        if (Math.random() > 0.6) { // 40% chance to spawn a gem near a crystal
            const gem = Matter.Bodies.circle(
                crystal.position.x + (Math.random() - 0.5) * 40,
                crystal.position.y - 40 + (Math.random() - 0.5) * 20,
                10, 
                {
                    isStatic: false,
                    restitution: 0.8,
                    friction: 0.01,
                    density: 0.01,
                    render: { fillStyle: gemColors[Math.floor(Math.random() * gemColors.length)] },
                    label: 'gem'
                }
            );
            
            gems.push(gem);
            Matter.World.add(world, gem);
        }
    });
}

// Create projectile launcher
function createLauncher() {
    // Launcher base (static)
    const launcher = Matter.Bodies.rectangle(100, 500, 20, 80, {
        isStatic: true,
        render: { fillStyle: '#5a189a' }
    });
    
    Matter.World.add(world, launcher);
}

// Launch projectile
function launchProjectile(power, angle) {
    if (shotsRemaining <= 0) return;
    
    shotsRemaining--;
    gameState = 'firing'; // Set game state to firing
    
    // Create projectile
    // Projectile originates from the launcher's approximate position
    const projectile = Matter.Bodies.circle(100, 450, 15, {
        restitution: 0.8,
        friction: 0.01,
        density: 0.1,
        render: { fillStyle: '#ff9e00' }, // Orange color for projectile
        label: 'projectile'
    });
    
    // Apply force
    // Force calculation based on power and angle
    const force = {
        x: Math.cos(angle) * power * 0.02,
        y: Math.sin(angle) * power * 0.02
    };
    
    Matter.Body.applyForce(projectile, projectile.position, force);
    Matter.World.add(world, projectile);
    projectiles.push(projectile);
    
    sounds.launch.play(); // Play launch sound
    
    updateUI(); // Update UI after shot
}

// Handle collisions
function handleCollisions(event) {
    const pairs = event.pairs;
    
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        
        // Check labels for collision types
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Projectile hits crystal
        if ((bodyA.label === 'projectile' && bodyB.label === 'crystal')) {
            damageCrystal(bodyB);
            sounds.crystalBreak.play();
        } else if ((bodyA.label === 'crystal' && bodyB.label === 'projectile')) {
            damageCrystal(bodyA);
            sounds.crystalBreak.play();
        }
        
        // Projectile hits gem or Crystal hits gem
        if ((bodyA.label === 'projectile' && bodyB.label === 'gem')) {
            collectGem(bodyB);
        } else if ((bodyA.label === 'gem' && bodyB.label === 'projectile')) {
            collectGem(bodyA);
        } else if ((bodyA.label === 'crystal' && bodyB.label === 'gem')) {
            collectGem(bodyB);
        } else if ((bodyA.label === 'gem' && bodyB.label === 'crystal')) {
            collectGem(bodyA);
        }
    }
}

// Damage crystal
function damageCrystal(crystal) {
    // Ensure the crystal is still in the world and has health
    if (!crystal || !Matter.Composite.allBodies(world).includes(crystal) || crystal.health <= 0) {
        return;
    }

    crystal.health--;
    
    // Visual effect: change fill style to indicate damage
    // The alpha value increases as health decreases
    const damageColor = `rgba(255, 0, 0, ${0.3 * (4 - crystal.health)})`;
    crystal.render.fillStyle = damageColor; // Apply damage color directly
    
    if (crystal.health <= 0) {
        // Destroy crystal
        // Remove immediately to prevent further collisions
        Matter.World.remove(world, crystal);
        const index = crystals.indexOf(crystal);
        if (index > -1) {
            crystals.splice(index, 1);
        }
        
        // Create explosion effect at the crystal's last known position
        createExplosion(crystal.position.x, crystal.position.y, crystal.render.fillStyle);
        
        // Add score for destroying crystal
        score += 100;
        updateUI();
        
        checkLevelCompletion(); // Check for completion after crystal is destroyed
    }
}

// Collect gem
function collectGem(gem) {
    // Ensure it's a gem and it's still in the world
    if (gem.label !== 'gem' || !Matter.Composite.allBodies(world).includes(gem)) return;
    
    // Remove gem from world and array
    Matter.World.remove(world, gem);
    const index = gems.indexOf(gem);
    if (index > -1) {
        gems.splice(index, 1);
    }
    
    // Add score for collecting gem
    score += 250;
    // Decrement the remaining gems objective
    levelObjectives.gems--; 
    
    sounds.gemCollect.play();
    updateUI();
    
    checkLevelCompletion(); // Check for completion after gem is collected
}

// Create explosion effect
function createExplosion(x, y, color) {
    sounds.explosion.play();
    
    // Create particles
    for (let i = 0; i < 15; i++) {
        const particle = Matter.Bodies.circle(
            x, 
            y, 
            3 + Math.random() * 5, 
            {
                restitution: 0.9,
                friction: 0.01,
                density: 0.01,
                render: { fillStyle: color },
                collisionFilter: { mask: 0 } // No collisions for particles
            }
        );
        
        // Apply random force to particles for explosion effect
        const force = {
            x: (Math.random() - 0.5) * 0.05,
            y: (Math.random() - 0.5) * 0.05
        };
        
        Matter.Body.applyForce(particle, particle.position, force);
        Matter.World.add(world, particle);
        
        // Remove particles after a delay
        setTimeout(() => {
            if (particle && Matter.Composite.allBodies(world).includes(particle)) {
                Matter.World.remove(world, particle);
            }
        }, 2000);
    }
}

// Function to check if the game is ready for the next shot or game over
function checkGameReadiness() {
    // Only proceed if we are in 'firing' state and level is not yet completed
    if (gameState !== 'firing' || levelCompleted) {
        return;
    }

    // Filter out projectiles that are still in the world and moving
    // Also remove projectiles that have gone far off-screen to keep the array clean
    projectiles = projectiles.filter(p => {
        const isInWorld = Matter.Composite.allBodies(world).includes(p);
        // Define a small velocity threshold to consider an object "not moving"
        // Reduced threshold for more responsiveness
        const isMoving = Math.abs(p.velocity.x) > 0.05 || Math.abs(p.velocity.y) > 0.05; 
        // Define off-screen boundaries, slightly larger than canvas to account for partial visibility
        const isOffScreen = p.position.y > 650 || p.position.x < -50 || p.position.x > 850; 

        if (!isInWorld || isOffScreen) {
            // Remove from world if it's off-screen or already removed
            if (isInWorld) { // Only attempt to remove if it's still in the world
                Matter.World.remove(world, p);
            }
            return false; // Remove from projectiles array
        }
        return isMoving; // Keep if still moving and in world
    });

    // Check if all other objects (crystals, gems) are settled
    const movingObjects = [...crystals, ...gems].filter(obj => 
        Matter.Composite.allBodies(world).includes(obj) && 
        (Math.abs(obj.velocity.x) > 0.05 || Math.abs(obj.velocity.y) > 0.05) // Reduced threshold
    );

    // If no active projectiles and no other moving objects
    if (projectiles.length === 0 && movingObjects.length === 0) {
        // Clear any existing timeout to prevent multiple calls
        if (gameReadinessCheckTimeout) {
            clearTimeout(gameReadinessCheckTimeout);
            gameReadinessCheckTimeout = null;
        }

        // Add a small delay to ensure everything has truly settled
        gameReadinessCheckTimeout = setTimeout(() => {
            if (!levelCompleted) { // Double check level completion status
                if (shotsRemaining === 0) {
                    gameOver();
                } else {
                    // If shots remaining and objects have settled, allow next shot
                    gameState = 'aiming';
                }
            }
            gameReadinessCheckTimeout = null; // Reset timeout ID
        }, 100); // Reduced delay further to 100ms for quicker response
    } else {
        // If there are still moving objects, clear any pending timeout
        // This prevents the game from transitioning too early if objects start moving again
        if (gameReadinessCheckTimeout) {
            clearTimeout(gameReadinessCheckTimeout);
            gameReadinessCheckTimeout = null;
        }
    }
}

// Level complete
function levelComplete() {
    gameState = 'levelComplete';
    sounds.levelComplete.play();
    
    levelScoreDisplay.textContent = `Level Score: ${score}`;
    levelCompleteScreen.style.display = 'flex';
}

// Game over
function gameOver() {
    gameState = 'gameOver';
    sounds.gameOver.play();
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('crystalHighScore', highScore);
    }
    
    finalScoreDisplay.textContent = `FINAL SCORE: ${score}`;
    gameOverScreen.style.display = 'flex';
}

// Next level
function nextLevel() {
    currentLevel++;
    levelCompleteScreen.style.display = 'none';
    initGame();
}

// Update UI
function updateUI() {
    levelDisplay.textContent = `LEVEL: ${currentLevel}`;
    shotsDisplay.textContent = `SHOTS: ${shotsRemaining}`;
    scoreDisplay.textContent = `SCORE: ${score}`;
    highScoreDisplay.textContent = `HIGH SCORE: ${highScore}`;
}

// Start game
function startGame() {
    currentLevel = 1;
    score = 0;
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none'; // Ensure game over screen is hidden
    levelCompleteScreen.style.display = 'none'; // Ensure level complete screen is hidden
    initEngine(); // Initialize Matter.js engine and world
    initGame(); // Initialize game objects for the first level
}

// Handle mouse events for aiming
function handleMouseMove(e) {
    if (gameState !== 'aiming') return;
    
    const rect = canvas.getBoundingClientRect();
    // Calculate mouse position relative to the canvas
    aimPosition.x = e.clientX - rect.left;
    aimPosition.y = e.clientY - rect.top;
    
    // Position aim indicator relative to the canvas
    aimIndicator.style.display = 'block';
    // Adjust position by half of indicator's width/height to center it on the cursor
    aimIndicator.style.left = `${aimPosition.x - aimIndicator.offsetWidth / 2}px`;
    aimIndicator.style.top = `${aimPosition.y - aimIndicator.offsetHeight / 2}px`;
}

function handleMouseDown(e) {
    if (gameState !== 'aiming') return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Start calculating launch power
    launchPower = 0;
    // Increase launch power over time
    const powerInterval = setInterval(() => {
        launchPower = Math.min(launchPower + 2, 100); // Max power 100
        // Scale aim indicator to show power
        aimIndicator.style.transform = `scale(${1 + launchPower/50})`;
    }, 50);
    
    // Handle mouse up event to launch projectile
    const mouseUpHandler = () => {
        clearInterval(powerInterval); // Stop power calculation
        document.removeEventListener('mouseup', mouseUpHandler); // Remove this listener
        
        // Calculate angle from launcher position (100, 450) to mouse release position
        const launcherX = 100;
        const launcherY = 450;
        const angle = Math.atan2(mouseY - launcherY, mouseX - launcherX);
        
        // Launch projectile with calculated power and angle
        launchProjectile(launchPower, angle);
        
        // Hide aim indicator after launch
        aimIndicator.style.display = 'none';
        aimIndicator.style.transform = 'scale(1)'; // Reset scale for next aim
    };
    
    // Add mouseup listener to the document to capture release even if mouse moves off canvas
    document.addEventListener('mouseup', mouseUpHandler);
}

// Initialize function called on window load
function init() {
    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;
    
    // Event listeners for game control buttons
    startButton.addEventListener('click', startGame);
    nextLevelButton.addEventListener('click', nextLevel);
    restartButton.addEventListener('click', startGame); // Restart button also starts a new game
    
    // Event listeners for aiming and launching
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    
    // Hide game screens initially
    levelCompleteScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    startScreen.style.display = 'flex'; // Ensure start screen is visible on load
    
    // Update UI with initial values
    updateUI();
}

// Initialize when the window is fully loaded
window.addEventListener('load', init);
