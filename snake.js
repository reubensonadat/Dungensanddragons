const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const levelEl = document.getElementById('level');
const finalScoreEl = document.getElementById('final-score');

// New: Mobile control elements
const mobileControls = document.getElementById('mobile-controls');
const upButton = document.getElementById('up-button');
const downButton = document.getElementById('down-button');
const leftButton = document.getElementById('left-button');
const rightButton = document.getElementById('right-button');


// Game variables
let gridSize = 20;
let snake = [];
let food = {};
let powerUp = {};
let direction = 'right';
let nextDirection = 'right';
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameSpeed = 150; // Initial slower speed for better control
let gameInterval;
let gameOver = false;
let gameRunning = false;
let level = 1;
let shieldActive = false;
let shieldTimer = 0;
let speedBoostActive = false;
let speedBoostTimer = 0;

// Function to set canvas size responsively
function setCanvasSize() {
    // Determine the smaller dimension of the window
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.8; // 80% of the smaller dimension
    canvas.width = size - (size % gridSize); // Ensure canvas width is a multiple of gridSize
    canvas.height = size - (size % gridSize); // Ensure canvas height is a multiple of gridSize
    // Adjust background-size for grid if canvas size changes
    canvas.style.backgroundSize = `${gridSize}px ${gridSize}px`;
}

// Initialize game
function init() {
    // Set canvas size at initialization
    setCanvasSize();

    snake = [
        {x: 8, y: 10},
        {x: 7, y: 10},
        {x: 6, y: 10}
    ];
    
    generateFood();
    generatePowerUp();
    
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    gameSpeed = 150; // Reset to initial speed
    level = 1;
    shieldActive = false;
    shieldTimer = 0;
    speedBoostActive = false;
    speedBoostTimer = 0;
    gameOver = false;
    
    updateUI();
}

// Generate food at random position
function generateFood() {
    food = {
        x: Math.floor(Math.random() * (canvas.width / gridSize)),
        y: Math.floor(Math.random() * (canvas.height / gridSize))
    };
    
    // Make sure food doesn't appear on snake
    for (let segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            generateFood();
            break;
        }
    }
}

// Generate power-up
function generatePowerUp() {
    // Only generate if no existing power-up and random chance
    if (Object.keys(powerUp).length === 0 && Math.random() < 0.25) {
        powerUp = {
            x: Math.floor(Math.random() * (canvas.width / gridSize)),
            y: Math.floor(Math.random() * (canvas.height / gridSize)),
            type: ['speed', 'shrink', 'shield'][Math.floor(Math.random() * 3)]
        };
        
        // Make sure power-up doesn't appear on snake or food
        for (let segment of snake) {
            if (segment.x === powerUp.x && segment.y === powerUp.y) {
                powerUp = {};
                return;
            }
        }
        
        if (powerUp.x === food.x && powerUp.y === food.y) {
            powerUp = {};
        }
    }
}

// Draw game elements
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw snake
    snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#00ffaa' : '#00ff80';
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
        
        // Draw border
        ctx.strokeStyle = '#00f7ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
        
        // Draw eyes on head
        if (index === 0) {
            ctx.fillStyle = '#000';
            const eyeSize = gridSize / 5;
            
            if (direction === 'right') {
                ctx.fillRect((segment.x + 0.7) * gridSize, (segment.y + 0.2) * gridSize, eyeSize, eyeSize);
                ctx.fillRect((segment.x + 0.7) * gridSize, (segment.y + 0.6) * gridSize, eyeSize, eyeSize);
            } else if (direction === 'left') {
                ctx.fillRect((segment.x + 0.2) * gridSize, (segment.y + 0.2) * gridSize, eyeSize, eyeSize);
                ctx.fillRect((segment.x + 0.2) * gridSize, (segment.y + 0.6) * gridSize, eyeSize, eyeSize);
            } else if (direction === 'up') {
                ctx.fillRect((segment.x + 0.2) * gridSize, (segment.y + 0.2) * gridSize, eyeSize, eyeSize);
                ctx.fillRect((segment.x + 0.6) * gridSize, (segment.y + 0.2) * gridSize, eyeSize, eyeSize);
            } else if (direction === 'down') {
                ctx.fillRect((segment.x + 0.2) * gridSize, (segment.y + 0.7) * gridSize, eyeSize, eyeSize);
                ctx.fillRect((segment.x + 0.6) * gridSize, (segment.y + 0.7) * gridSize, eyeSize, eyeSize);
            }
        }
    });
    
    // Draw food
    ctx.fillStyle = '#ff0066';
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize/2,
        food.y * gridSize + gridSize/2,
        gridSize/2 - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = '#ff99cc';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw power-up if exists
    if (Object.keys(powerUp).length > 0) {
        const centerX = powerUp.x * gridSize + gridSize/2;
        const centerY = powerUp.y * gridSize + gridSize/2;
        const radius = gridSize/2 - 2;
        
        if (powerUp.type === 'speed') {
            ctx.fillStyle = '#ff00cc';
        } else if (powerUp.type === 'shrink') {
            ctx.fillStyle = '#00ffcc';
        } else if (powerUp.type === 'shield') {
            ctx.fillStyle = '#ccff00';
        }
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw pulse effect
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw icon
        ctx.fillStyle = '#000';
        ctx.font = `${gridSize/1.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (powerUp.type === 'speed') {
            ctx.fillText('⚡', centerX, centerY);
        } else if (powerUp.type === 'shrink') {
            ctx.fillText('▼', centerX, centerY);
        } else if (powerUp.type === 'shield') {
            ctx.fillText('⛨', centerX, centerY);
        }
    }
    
    // Draw shield if active
    if (shieldActive) {
        const head = snake[0];
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
            head.x * gridSize + gridSize/2,
            head.y * gridSize + gridSize/2,
            gridSize + 3,
            0,
            Math.PI * 2
        );
        ctx.stroke();
    }
}

// Update game state
function update() {
    // Update direction
    direction = nextDirection;
    
    // Calculate new head position
    const head = {...snake[0]};
    
    switch (direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }
    
    // Check collision with walls
    if (
        head.x < 0 || 
        head.x >= canvas.width / gridSize || 
        head.y < 0 || 
        head.y >= canvas.height / gridSize
    ) {
        if (shieldActive) {
            // Wrap around with shield
            if (head.x < 0) head.x = (canvas.width / gridSize) - 1;
            if (head.x >= canvas.width / gridSize) head.x = 0;
            if (head.y < 0) head.y = (canvas.height / gridSize) - 1;
            if (head.y >= canvas.height / gridSize) head.y = 0;
        } else {
            endGame();
            return;
        }
    }
    
    // Check collision with self
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            if (!shieldActive) {
                endGame();
                return;
            } else {
                // Remove shield and continue
                shieldActive = false;
                break;
            }
        }
    }
    
    // Add new head
    snake.unshift(head);
    
    // Check food collision
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        playSound('eat');
        
        // Level up every 50 points
        if (score % 50 === 0) {
            level++;
            // Make game faster, but with a higher minimum speed for mobile
            gameSpeed = Math.max(80, gameSpeed - 10); // Slower initial acceleration
            playSound('levelUp');
            // Clear and restart interval to apply new speed immediately
            clearInterval(gameInterval);
            gameInterval = setInterval(gameLoop, gameSpeed);
        }
        
        generateFood();
    } else {
        // Remove tail if no food eaten
        snake.pop();
    }
    
    // Check power-up collision
    if (Object.keys(powerUp).length > 0 && 
        head.x === powerUp.x && head.y === powerUp.y) {
        applyPowerUp(powerUp.type);
        powerUp = {};
    }
    
    // Update timers
    if (shieldActive) {
        shieldTimer--;
        if (shieldTimer <= 0) shieldActive = false;
    }
    
    if (speedBoostActive) {
        speedBoostTimer--;
        if (speedBoostTimer <= 0) {
            speedBoostActive = false;
            gameSpeed = Math.max(80, gameSpeed + 20); // Revert speed, but not below new min
            clearInterval(gameInterval);
            gameInterval = setInterval(gameLoop, gameSpeed);
        }
    }
    
    updateUI();
}

// Apply power-up effect
function applyPowerUp(type) {
    playSound('powerup');
    
    if (type === 'speed') {
        speedBoostActive = true;
        speedBoostTimer = 150; // 15 seconds
        gameSpeed = Math.max(30, gameSpeed - 40); // More noticeable speed boost
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, gameSpeed);
    } else if (type === 'shrink') {
        if (snake.length > 3) {
            // Remove 3 tail segments
            snake.splice(snake.length - 3, 3);
        }
    } else if (type === 'shield') {
        shieldActive = true;
        shieldTimer = 100; // 10 seconds
    }
}

// Update UI elements
function updateUI() {
    scoreEl.textContent = `SCORE: ${score}`;
    highScoreEl.textContent = `HIGH SCORE: ${highScore}`;
    levelEl.textContent = `LEVEL: ${level}`;
}

// Game loop
function gameLoop() {
    if (!gameOver) {
        update();
        draw();
    }
}

// Handle keyboard input
function handleKeyDown(e) {
    if (!gameRunning) return;
    
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (direction !== 'down') nextDirection = 'up';
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (direction !== 'up') nextDirection = 'down';
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (direction !== 'right') nextDirection = 'left';
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (direction !== 'left') nextDirection = 'right';
            break;
    }
}

// Start game
function startGame() {
    init();
    gameRunning = true;
    gameOver = false;
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    mobileControls.classList.add('active'); // Show mobile controls
    
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, gameSpeed);
}

// End game
function endGame() {
    gameOver = true;
    gameRunning = false;
    clearInterval(gameInterval);
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
    }
    
    finalScoreEl.textContent = `FINAL SCORE: ${score}`;
    gameOverScreen.style.display = 'flex';
    mobileControls.classList.remove('active'); // Hide mobile controls
    playSound('gameOver');
}

// Audio setup
function createAudio() {
    return {
        eat: new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 } }).toDestination(),
        powerup: new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.2 } }).toDestination(),
        gameOver: new Tone.Synth({ oscillator: { type: "fmsquare" }, envelope: { attack: 0.01, decay: 1, sustain: 0, release: 0.2 } }).toDestination(),
        levelUp: new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 } }).toDestination()
    };
}

const sounds = createAudio();

function playSound(sound) {
    if (Tone.context.state !== 'running') {
        Tone.start();
    }
    if (sounds[sound]) {
        if (sound === 'eat') {
            sounds[sound].triggerAttackRelease('C6', '8n');
        } else if (sound === 'powerup') {
            sounds[sound].triggerAttackRelease('E5', '8n');
        } else if (sound === 'gameOver') {
            sounds[sound].triggerAttackRelease('C2', '1n');
        } else if (sound === 'levelUp') {
            sounds[sound].triggerAttackRelease('C5', '8n');
        }
    }
}

// Event listeners for Keyboard
window.addEventListener('keydown', handleKeyDown);

// New: Event Listeners for Mobile Controls (touch and mouse down/up for broader compatibility)
upButton.addEventListener('touchstart', (e) => { e.preventDefault(); if (direction !== 'down') nextDirection = 'up'; });
upButton.addEventListener('touchend', (e) => { e.preventDefault(); });
upButton.addEventListener('mousedown', () => { if (direction !== 'down') nextDirection = 'up'; });
upButton.addEventListener('mouseup', () => {});
upButton.addEventListener('mouseleave', () => {});


downButton.addEventListener('touchstart', (e) => { e.preventDefault(); if (direction !== 'up') nextDirection = 'down'; });
downButton.addEventListener('touchend', (e) => { e.preventDefault(); });
downButton.addEventListener('mousedown', () => { if (direction !== 'up') nextDirection = 'down'; });
downButton.addEventListener('mouseup', () => {});
downButton.addEventListener('mouseleave', () => {});

leftButton.addEventListener('touchstart', (e) => { e.preventDefault(); if (direction !== 'right') nextDirection = 'left'; });
leftButton.addEventListener('touchend', (e) => { e.preventDefault(); });
leftButton.addEventListener('mousedown', () => { if (direction !== 'right') nextDirection = 'left'; });
leftButton.addEventListener('mouseup', () => {});
leftButton.addEventListener('mouseleave', () => {});

rightButton.addEventListener('touchstart', (e) => { e.preventDefault(); if (direction !== 'left') nextDirection = 'right'; });
rightButton.addEventListener('touchend', (e) => { e.preventDefault(); });
rightButton.addEventListener('mousedown', () => { if (direction !== 'left') nextDirection = 'right'; });
rightButton.addEventListener('mouseup', () => {});
rightButton.addEventListener('mouseleave', () => {});


startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

// Event listener for window resize to adjust canvas size
window.addEventListener('resize', setCanvasSize);

// Initialize UI and canvas size on load
updateUI();
setCanvasSize();
