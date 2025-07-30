const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');

// New: Mobile control elements
const mobileControls = document.getElementById('mobile-controls');
const rotateLeftButton = document.getElementById('rotate-left-button');
const rotateRightButton = document.getElementById('rotate-right-button');
const thrustButton = document.getElementById('thrust-button');
const shootButton = document.getElementById('shoot-button');

canvas.width = window.innerWidth * 0.9;
canvas.height = window.innerHeight * 0.9;

let score = 0;
let lives = 3;
let highScore = localStorage.getItem('asteroidHighScore') || 0;
let gameOver = false;
let gameRunning = false;

// New: Base asteroid speed and spawn interval
let baseAsteroidSpeed = 1; // Initial speed
let asteroidSpawnInterval = 1500; // Milliseconds
let lastAsteroidSpawnTime = 0;

const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
    // New: Mobile control states
    mobileRotateLeft: false,
    mobileRotateRight: false,
    mobileThrust: false,
    mobileShoot: false
};

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 20,
    speed: 5,
    rotation: 0,
    isThrusting: false,
    velX: 0,
    velY: 0,
    friction: 0.99,
    isInvincible: false,
    shielded: false,
    tripleShot: false,
    tripleShotTimer: 0,
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius - 5, this.radius);
        ctx.lineTo(-(this.radius - 5), this.radius);
        ctx.closePath();
        ctx.strokeStyle = this.isInvincible ? '#0ff' : '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.shielded) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        if (this.isThrusting) {
            ctx.beginPath();
            ctx.moveTo(0, this.radius + 5);
            ctx.lineTo(5, this.radius + 15);
            ctx.lineTo(-5, this.radius + 15);
            ctx.closePath();
            ctx.fillStyle = '#f00';
            ctx.fill();
        }
        ctx.restore();
    },
    update() {
        // Combined keyboard and mobile controls for rotation
        if (keys.a || keys.ArrowLeft || keys.mobileRotateLeft) this.rotation -= 0.05;
        if (keys.d || keys.ArrowRight || keys.mobileRotateRight) this.rotation += 0.05;

        // Combined keyboard and mobile controls for thrust
        if (keys.w || keys.ArrowUp || keys.mobileThrust) {
            this.velX += Math.sin(this.rotation) * 0.1;
            this.velY -= Math.cos(this.rotation) * 0.1;
            this.isThrusting = true;
        } else {
            this.isThrusting = false;
        }

        this.x += this.velX;
        this.y += this.velY;
        this.velX *= this.friction;
        this.velY *= this.friction;

        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        if (this.tripleShotTimer > 0) {
            this.tripleShotTimer--;
            if (this.tripleShotTimer === 0) {
                this.tripleShot = false;
            }
        }
    }
};

const bullets = [];
const asteroids = [];
const particles = [];
const powerUps = [];

class Bullet {
    constructor(x, y, rotation) {
        this.x = x;
        this.y = y;
        this.radius = 3;
        this.speed = 10;
        this.rotation = rotation;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0';
        ctx.fill();
    }
    update() {
        this.x += Math.sin(this.rotation) * this.speed;
        this.y -= Math.cos(this.rotation) * this.speed;
    }
}

class Asteroid {
    constructor(x, y, radius) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.radius = radius || 50;
        // New: Use baseAsteroidSpeed and add a random factor
        this.speed = baseAsteroidSpeed + Math.random() * 1.5;
        this.rotation = Math.random() * Math.PI * 2;
        this.sides = Math.floor(Math.random() * 5) + 8;
        this.shape = [];
        for (let i = 0; i < this.sides; i++) {
            this.shape.push(Math.random() * 0.4 + 0.8);
        }
    }
    draw() {
        ctx.beginPath();
        ctx.moveTo(this.x + this.radius * this.shape[0] * Math.cos(0), this.y + this.radius * this.shape[0] * Math.sin(0));
        for (let i = 1; i < this.sides; i++) {
            const angle = i * Math.PI * 2 / this.sides;
            ctx.lineTo(this.x + this.radius * this.shape[i] * Math.cos(angle), this.y + this.radius * this.shape[i] * Math.sin(angle));
        }
        ctx.closePath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    update() {
        this.x += Math.cos(this.rotation) * this.speed;
        this.y += Math.sin(this.rotation) * this.speed;
        if (this.x < -this.radius) this.x = canvas.width + this.radius;
        if (this.x > canvas.width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = canvas.height + this.radius;
        if (this.y > canvas.height + this.radius) this.y = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 2 + 1;
        this.color = color;
        this.alpha = 1;
        this.velX = Math.random() * 4 - 2;
        this.velY = Math.random() * 4 - 2;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
    update() {
        this.x += this.velX;
        this.y += this.velY;
        this.alpha -= 0.02;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 15;
        this.alpha = 1;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.type === 'shield' ? '#0ff' : '#f0f';
        ctx.fill();
        ctx.font = 'bold 15px Orbitron';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type === 'shield' ? 'S' : 'T', this.x, this.y);
        ctx.restore();
    }
    update() {
        this.alpha -= 0.005;
    }
}

function createExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function shoot() {
    if (player.tripleShot) {
        bullets.push(new Bullet(player.x, player.y, player.rotation));
        bullets.push(new Bullet(player.x, player.y, player.rotation - 0.2));
        bullets.push(new Bullet(player.x, player.y, player.rotation + 0.2));
    } else {
        bullets.push(new Bullet(player.x, player.y, player.rotation));
    }
    playSound('shoot');
}

function checkCollisions() {
    // Asteroid-Player collision
    if (!player.isInvincible && !player.shielded) {
        asteroids.forEach(asteroid => {
            const dist = Math.hypot(player.x - asteroid.x, player.y - asteroid.y);
            if (dist - player.radius - asteroid.radius < 1) {
                playerHit();
            }
        });
    }

    // Bullet-Asteroid collision
    bullets.forEach((bullet, bIndex) => {
        asteroids.forEach((asteroid, aIndex) => {
            const dist = Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y);
            if (dist < asteroid.radius) {
                if (asteroid.radius > 20) {
                    score += 20;
                    const newRadius = asteroid.radius / 2;
                    asteroids.push(new Asteroid(asteroid.x, asteroid.y, newRadius));
                    asteroids.push(new Asteroid(asteroid.x, asteroid.y, newRadius));
                } else {
                    score += 50;
                }
                
                // Power-up drop
                if (Math.random() < 0.1) {
                    const type = Math.random() < 0.5 ? 'shield' : 'tripleShot';
                    powerUps.push(new PowerUp(asteroid.x, asteroid.y, type));
                }

                asteroids.splice(aIndex, 1);
                bullets.splice(bIndex, 1);
                createExplosion(asteroid.x, asteroid.y, '#fff');
                playSound('explosion');
            }
        });
    });
    
    // PowerUp-Player collision
    powerUps.forEach((powerUp, pIndex) => {
        const dist = Math.hypot(player.x - powerUp.x, player.y - powerUp.y);
        if (dist - player.radius - powerUp.radius < 1) {
            if (powerUp.type === 'shield') {
                player.shielded = true;
                setTimeout(() => player.shielded = false, 5000);
            } else if (powerUp.type === 'tripleShot') {
                player.tripleShot = true;
                player.tripleShotTimer = 300; // 5 seconds
            }
            powerUps.splice(pIndex, 1);
            playSound('powerup');
        }
    });
}

function playerHit() {
    if (player.isInvincible) return;
    lives--;
    createExplosion(player.x, player.y, '#f00', 50);
    playSound('playerExplosion');
    if (lives <= 0) {
        endGame();
    } else {
        player.x = canvas.width / 2;
        player.y = canvas.height / 2;
        player.velX = 0;
        player.velY = 0;
        player.isInvincible = true;
        setTimeout(() => player.isInvincible = false, 2000);
    }
}

function spawnAsteroids() {
    const currentTime = performance.now();
    // Adjust spawn interval and asteroid speed based on score
    const dynamicSpawnInterval = Math.max(500, asteroidSpawnInterval - Math.floor(score / 50) * 10); // Faster spawning
    const dynamicAsteroidSpeed = baseAsteroidSpeed + Math.floor(score / 1000) * 0.5; // Faster asteroids

    if (currentTime - lastAsteroidSpawnTime > dynamicSpawnInterval && asteroids.length < 5 + Math.floor(score / 1000)) {
        asteroids.push(new Asteroid());
        lastAsteroidSpawnTime = currentTime;
    }
    // Update asteroid speed for existing asteroids (optional, but makes them speed up)
    asteroids.forEach(asteroid => {
        if (asteroid.speed < dynamicAsteroidSpeed + 1.5) { // Ensure they don't get too fast too quickly
            asteroid.speed = dynamicAsteroidSpeed + Math.random() * 1.5;
        }
    });
}

function updateUI() {
    scoreEl.textContent = `SCORE: ${score}`;
    livesEl.textContent = `LIVES: ${lives}`;
    highScoreEl.textContent = `HIGH SCORE: ${highScore}`;
}

function loop() {
    if (gameOver) return;
    requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    player.update();
    player.draw();

    bullets.forEach((bullet, index) => {
        bullet.update();
        bullet.draw();
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(index, 1);
        }
    });

    asteroids.forEach(asteroid => {
        asteroid.update();
        asteroid.draw();
    });

    particles.forEach((particle, index) => {
        particle.update();
        particle.draw();
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        }
    });
    
    powerUps.forEach((powerUp, index) => {
        powerUp.update();
        powerUp.draw();
        if (powerUp.alpha <= 0) {
            powerUps.splice(index, 1);
        }
    });

    checkCollisions();
    spawnAsteroids();
    updateUI();
}

function startGame() {
    score = 0;
    lives = 3;
    gameOver = false;
    gameRunning = true;
    asteroids.length = 0;
    bullets.length = 0;
    particles.length = 0;
    powerUps.length = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.velX = 0;
    player.velY = 0;
    player.isInvincible = true;
    setTimeout(() => player.isInvincible = false, 2000);
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    mobileControls.classList.add('active'); // Show mobile controls
    loop();
}

function endGame() {
    gameOver = true;
    gameRunning = false;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroidHighScore', highScore);
    }
    finalScoreEl.textContent = `FINAL SCORE: ${score}`;
    gameOverScreen.style.display = 'flex';
    mobileControls.classList.remove('active'); // Hide mobile controls
}

// Audio
const sounds = {
    shoot: new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination(),
    explosion: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 } }).toDestination(),
    playerExplosion: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.2 } }).toDestination(),
    powerup: new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 } }).toDestination(),
};

function playSound(sound) {
    if (Tone.context.state !== 'running') {
        Tone.start();
    }
    if (sounds[sound]) {
        if (sound === 'powerup') {
            sounds[sound].triggerAttackRelease('C5', '8n');
        } else {
            sounds[sound].triggerAttackRelease('8n');
        }
    }
}

// Event Listeners for Keyboard
window.addEventListener('keydown', e => {
    if (gameRunning) {
        if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    }
});

window.addEventListener('keyup', e => {
    if (gameRunning) {
        if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    }
});

// Event Listener for Mouse Click (shooting)
canvas.addEventListener('click', () => {
    if (gameRunning) shoot();
});

// New: Event Listeners for Mobile Controls (touch and mouse down/up for broader compatibility)
rotateLeftButton.addEventListener('touchstart', () => { keys.mobileRotateLeft = true; });
rotateLeftButton.addEventListener('touchend', () => { keys.mobileRotateLeft = false; });
rotateLeftButton.addEventListener('mousedown', () => { keys.mobileRotateLeft = true; });
rotateLeftButton.addEventListener('mouseup', () => { keys.mobileRotateLeft = false; });
rotateLeftButton.addEventListener('mouseleave', () => { keys.mobileRotateLeft = false; }); // Important for mouse events

rotateRightButton.addEventListener('touchstart', () => { keys.mobileRotateRight = true; });
rotateRightButton.addEventListener('touchend', () => { keys.mobileRotateRight = false; });
rotateRightButton.addEventListener('mousedown', () => { keys.mobileRotateRight = true; });
rotateRightButton.addEventListener('mouseup', () => { keys.mobileRotateRight = false; });
rotateRightButton.addEventListener('mouseleave', () => { keys.mobileRotateRight = false; });

thrustButton.addEventListener('touchstart', () => { keys.mobileThrust = true; });
thrustButton.addEventListener('touchend', () => { keys.mobileThrust = false; });
thrustButton.addEventListener('mousedown', () => { keys.mobileThrust = true; });
thrustButton.addEventListener('mouseup', () => { keys.mobileThrust = false; });
thrustButton.addEventListener('mouseleave', () => { keys.mobileThrust = false; });

shootButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior like scrolling/zooming
    if (gameRunning) shoot();
});
shootButton.addEventListener('click', () => { // Keep click for desktop testing
    if (gameRunning) shoot();
});


startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.9;
    // Reposition player if canvas size changes drastically
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
});

updateUI();
