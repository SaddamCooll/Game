/**
 * Cyber-Neon Snake Game - JavaScript Logic
 * Includes custom Web Audio synth, high-res canvas scaling, particle systems, and touch controls.
 */

// --- Audio Synthesizer Engine ---
class CyberSynth {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    init() {
        if (!this.ctx) {
            // Lazy initialization on user interaction (due to browser autoplay policies)
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playEat() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Retro-arcade blip sound (upward frequency sweep)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playCrash() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Create low frequency explosion / noise sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.4);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.55);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.6);
    }

    playMove() {
        // Minimal quiet click for game feedback
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
    }

    playGolden() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Double blip upbeat sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

        osc.start();
        osc.stop(now + 0.25);
    }

    playHighscore() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Play a short synth melody (arpeggio)
        const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
            gain.gain.setValueAtTime(0.12, now + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.01, now + i * 0.12 + 0.2);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.25);
        });
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }
}

// --- Particle Explosion System ---
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1.5;
        this.speedX = (Math.random() - 0.5) * 5;
        this.speedY = (Math.random() - 0.5) * 5;
        this.alpha = 1;
        this.decay = Math.random() * 0.03 + 0.015;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- Snake Game Core Class ---
class SnakeGame {
    constructor() {
        // UI & Canvas Setup
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Settings State
        this.wrapWalls = true;
        this.difficulty = 'medium'; // easy, medium, hard, custom (accelerating)
        this.themeColor = 'neon-green';
        this.muted = false;

        // Score Counters
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cyber_snake_highscore')) || 0;
        this.multiplier = 1.0;

        // Core Game Constants
        this.gridSize = 20; // grid cell dimension in logical pixels
        this.tileCount = 20; // 20x20 grid

        // Game State Variables
        this.snake = [];
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.food = { x: 0, y: 0 };
        this.isGoldenFood = false;
        this.goldenFoodTimer = 0;
        this.particles = [];
        this.gameState = 'start'; // start, playing, paused, gameover

        // Loop Throttling
        this.lastTime = 0;
        this.baseSpeedMs = 90; // Default speed

        // Audio and Particle instances
        this.synth = new CyberSynth();

        // UI Element Cache
        this.scoreEl = document.getElementById('current-score');
        this.highScoreEl = document.getElementById('high-score');
        this.multiplierEl = document.getElementById('score-multiplier');
        this.powerupStatusEl = document.getElementById('powerup-status');
        this.startScreen = document.getElementById('start-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        this.gameOverScreen = document.getElementById('gameover-screen');
        this.finalScoreEl = document.getElementById('final-score');
        this.newHighAlert = document.getElementById('new-highscore-alert');

        this.init();
    }

    init() {
        this.setupCanvasDPR();
        this.loadScores();
        this.bindEvents();
        this.resetGame();
        
        // Start animation frame loop
        requestAnimationFrame((t) => this.loop(t));
    }

    // Setup High-DPI support to ensure crisp rendering on dynamic screen aspect ratios and mobile
    setupCanvasDPR() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Logical layout matching CSS bounding box size
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        
        // Save dimensions for layout references
        this.logicalWidth = rect.width;
        this.logicalHeight = rect.height;
        
        // Re-calculate tile counts and sizes based on responsive layout (approx 20 grid columns)
        this.gridSize = this.logicalWidth / this.tileCount;
    }

    loadScores() {
        this.highScoreEl.textContent = this.padScore(this.highScore);
    }

    padScore(num) {
        return num.toString().padStart(3, '0');
    }

    resetGame() {
        this.score = 0;
        this.multiplier = 1.0;
        this.scoreEl.textContent = this.padScore(this.score);
        this.multiplierEl.textContent = '1.0x';
        this.powerupStatusEl.innerHTML = '<span class="pulse-dot"></span> NO ACTIVE BUFFS';
        this.powerupStatusEl.style.borderColor = 'rgba(255,255,255,0.05)';

        // Start in the center, heading right
        this.snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.particles = [];
        this.isGoldenFood = false;
        
        this.spawnFood();
        this.updateSpeed();
    }

    spawnFood() {
        let proposedFood = {};
        let onSnake = true;

        // Try spawning food until it's not on the snake segments
        while (onSnake) {
            proposedFood = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
            onSnake = this.snake.some(segment => segment.x === proposedFood.x && segment.y === proposedFood.y);
        }

        this.food = proposedFood;

        // 15% chance to spawn glowing golden power-up apple
        this.isGoldenFood = Math.random() < 0.15;
        if (this.isGoldenFood) {
            this.goldenFoodTimer = 6000; // Lives for 6 seconds
            this.powerupStatusEl.innerHTML = '<span class="pulse-dot" style="background-color: var(--neon-gold); box-shadow: 0 0 8px var(--neon-gold);"></span> GOLDEN SPAWN DETECTED';
            this.powerupStatusEl.style.borderColor = 'rgba(255, 215, 0, 0.3)';
        } else {
            this.powerupStatusEl.innerHTML = '<span class="pulse-dot"></span> SCANNING GRID...';
            this.powerupStatusEl.style.borderColor = 'rgba(255, 255, 255, 0.05)';
        }
    }

    updateSpeed() {
        switch (this.difficulty) {
            case 'easy':
                this.baseSpeedMs = 130;
                break;
            case 'hard':
                this.baseSpeedMs = 60;
                break;
            case 'custom':
                // Accelerating speed based on snake length
                this.baseSpeedMs = Math.max(45, 100 - this.snake.length * 1.5);
                break;
            case 'medium':
            default:
                this.baseSpeedMs = 90;
                break;
        }
    }

    // --- Input Control Router ---
    changeDirection(x, y) {
        if (this.gameState !== 'playing') return;

        // Prevent 180-degree immediate turns (e.g. going left while moving right)
        if (x !== 0 && this.direction.x !== 0) return;
        if (y !== 0 && this.direction.y !== 0) return;

        this.nextDirection = { x, y };
        this.synth.playMove();
    }

    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.pauseScreen.classList.remove('hidden');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.pauseScreen.classList.add('hidden');
        }
    }

    triggerGameOver() {
        this.gameState = 'gameover';
        this.synth.playCrash();
        
        // Set final scores
        this.finalScoreEl.textContent = this.score;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cyber_snake_highscore', this.highScore);
            this.highScoreEl.textContent = this.padScore(this.highScore);
            this.newHighAlert.classList.remove('hidden');
            setTimeout(() => this.synth.playHighscore(), 200);
        } else {
            this.newHighAlert.classList.add('hidden');
        }

        this.gameOverScreen.classList.remove('hidden');
    }

    startGame() {
        this.resetGame();
        this.gameState = 'playing';
        this.startScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.synth.init();
    }

    restartGame() {
        this.startGame();
    }

    // --- Main Loop: Update and Draw ---
    loop(currentTime) {
        requestAnimationFrame((t) => this.loop(t));

        // Background update for floating particles (always runs smoothly regardless of game tick speed)
        this.updateParticles();

        if (this.gameState !== 'playing') {
            this.draw();
            return;
        }

        // Throttle snake updates using game tick milliseconds
        const elapsed = currentTime - this.lastTime;
        
        // Handle Golden food timer ticking
        if (this.isGoldenFood) {
            this.goldenFoodTimer -= elapsed;
            if (this.goldenFoodTimer <= 0) {
                this.isGoldenFood = false;
                this.spawnFood(); // Despawn and replace with regular food
            }
        }

        if (elapsed >= this.baseSpeedMs) {
            this.lastTime = currentTime - (elapsed % this.baseSpeedMs);
            this.updateGameLogic();
        }

        this.draw();
    }

    updateGameLogic() {
        // Lock direction from buffer
        this.direction = { ...this.nextDirection };

        // Head position
        const head = { 
            x: this.snake[0].x + this.direction.x, 
            y: this.snake[0].y + this.direction.y 
        };

        // Collision Checks: Walls
        if (this.wrapWalls) {
            // Wrapping logic
            if (head.x < 0) head.x = this.tileCount - 1;
            if (head.x >= this.tileCount) head.x = 0;
            if (head.y < 0) head.y = this.tileCount - 1;
            if (head.y >= this.tileCount) head.y = 0;
        } else {
            // Rigid solid walls game over
            if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
                this.triggerGameOver();
                return;
            }
        }

        // Collision Checks: Self (exclude tail end because it moves out of the way)
        for (let i = 0; i < this.snake.length - 1; i++) {
            if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
                this.triggerGameOver();
                return;
            }
        }

        // Insert head at the beginning of body array
        this.snake.unshift(head);

        // Check if head landed on food coordinates
        if (head.x === this.food.x && head.y === this.food.y) {
            this.handleFoodEating();
        } else {
            // Remove tail segment if food is not eaten
            this.snake.pop();
        }

        // Keep updating accelerating speeds dynamically if selected
        if (this.difficulty === 'custom') {
            this.updateSpeed();
        }
    }

    handleFoodEating() {
        const themeColorHex = this.getThemeHexColor();
        const foodColor = this.isGoldenFood ? '#ffd700' : '#ff007f';

        // Trigger Synth Sound & Particles
        if (this.isGoldenFood) {
            this.synth.playGolden();
            this.score += 30; // 3x standard food
            this.multiplier += 0.2; // boost score multiplier
        } else {
            this.synth.playEat();
            this.score += Math.round(10 * this.multiplier);
        }

        this.scoreEl.textContent = this.padScore(this.score);
        this.multiplierEl.textContent = this.multiplier.toFixed(1) + 'x';

        // Create Burst Particles at exact pixel center of eaten grid cell
        const pixelX = this.food.x * this.gridSize + this.gridSize / 2;
        const pixelY = this.food.y * this.gridSize + this.gridSize / 2;
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(pixelX, pixelY, foodColor));
        }

        this.spawnFood();
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // --- Drawing / Rendering ---
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#07080c';
        this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

        // Draw Arena Grid (subtle glow scanlines)
        this.drawSubtleGrid();

        // Draw Food
        this.drawFood();

        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx));

        // Draw Snake
        this.drawSnake();
    }

    drawSubtleGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        this.ctx.lineWidth = 1;

        for (let i = 0; i <= this.tileCount; i++) {
            // Vertical lines
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.logicalHeight);
            this.ctx.stroke();

            // Horizontal lines
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.gridSize);
            this.ctx.lineTo(this.logicalWidth, i * this.gridSize);
            this.ctx.stroke();
        }
    }

    drawSnake() {
        const themeColorHex = this.getThemeHexColor();
        this.ctx.save();

        this.snake.forEach((segment, index) => {
            const isHead = index === 0;
            const x = segment.x * this.gridSize;
            const y = segment.y * this.gridSize;
            const pad = 1.5; // margin within grid tile to separate links

            // Neon glowing settings
            this.ctx.shadowBlur = isHead ? 15 : 8;
            this.ctx.shadowColor = themeColorHex;

            if (isHead) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.strokeStyle = themeColorHex;
                this.ctx.lineWidth = 2.5;

                // Draw Head with round corners facing direction
                this.drawRoundedHead(x + pad, y + pad, this.gridSize - pad * 2);
            } else {
                // Gradient transparency fade from neck to tail
                const opacity = Math.max(0.25, 1 - (index / this.snake.length));
                this.ctx.fillStyle = themeColorHex;
                this.ctx.globalAlpha = opacity;

                this.drawRoundedRect(x + pad, y + pad, this.gridSize - pad * 2, this.gridSize - pad * 2, 4);
                this.ctx.fill();
            }
        });

        this.ctx.restore();
    }

    drawRoundedHead(x, y, size) {
        const radius = size / 2;
        this.ctx.beginPath();

        // Custom head rounding pointing towards current movement vector
        if (this.direction.x === 1) { // Right
            this.ctx.roundRect(x, y, size, size, [0, radius, radius, 0]);
        } else if (this.direction.x === -1) { // Left
            this.ctx.roundRect(x, y, size, size, [radius, 0, 0, radius]);
        } else if (this.direction.y === 1) { // Down
            this.ctx.roundRect(x, y, size, size, [0, 0, radius, radius]);
        } else if (this.direction.y === -1) { // Up
            this.ctx.roundRect(x, y, size, size, [radius, radius, 0, 0]);
        } else {
            this.ctx.roundRect(x, y, size, size, 6);
        }
        
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, radius);
    }

    drawFood() {
        const x = this.food.x * this.gridSize;
        const y = this.food.y * this.gridSize;
        const radius = this.gridSize / 2;

        this.ctx.save();

        if (this.isGoldenFood) {
            // Glowing pulsing golden apple
            const pulseSpeed = 0.008;
            const pulse = 1 + Math.sin(Date.now() * pulseSpeed) * 0.15;
            const finalSize = radius * pulse;

            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ffd700';
            this.ctx.fillStyle = '#ffd700';

            // Star / cross design for futuristic high-tech food
            this.ctx.beginPath();
            this.ctx.arc(x + radius, y + radius, finalSize * 0.8, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Normal Neon Pink food
            const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.08;
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = '#ff007f';
            this.ctx.fillStyle = '#ff007f';

            this.ctx.beginPath();
            this.ctx.arc(x + radius, y + radius, radius * 0.7 * pulse, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    getThemeHexColor() {
        switch (this.themeColor) {
            case 'neon-cyan': return '#00f0ff';
            case 'neon-pink': return '#ff007f';
            case 'neon-gold': return '#ffd700';
            case 'neon-green':
            default:
                return '#39ff14';
        }
    }

    // --- User Controls & Event Bindings ---
    bindEvents() {
        // Keyboard bindings
        window.addEventListener('keydown', (e) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault(); // Stop mobile browser scrolling on keyboard interactions
            }

            switch(e.key) {
                // Movement
                case 'w': case 'W': case 'ArrowUp':
                    this.changeDirection(0, -1);
                    break;
                case 's': case 'S': case 'ArrowDown':
                    this.changeDirection(0, 1);
                    break;
                case 'a': case 'A': case 'ArrowLeft':
                    this.changeDirection(-1, 0);
                    break;
                case 'd': case 'D': case 'ArrowRight':
                    this.changeDirection(1, 0);
                    break;
                // Pause toggles
                case ' ': // Spacebar
                case 'Escape':
                    if (this.gameState === 'playing' || this.gameState === 'paused') {
                        this.togglePause();
                    }
                    break;
            }
        });

        // HTML Screen Buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        
        // Quick control footer actions
        const qPauseBtn = document.getElementById('quick-pause-btn');
        qPauseBtn.addEventListener('click', () => {
            if (this.gameState === 'playing' || this.gameState === 'paused') {
                this.togglePause();
            }
        });

        const qSoundBtn = document.getElementById('quick-sound-btn');
        qSoundBtn.addEventListener('click', () => {
            const isMuted = this.synth.toggleMute();
            if (isMuted) {
                qSoundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
                qSoundBtn.classList.add('active');
            } else {
                qSoundBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                qSoundBtn.classList.remove('active');
            }
        });

        // Config Elements: Difficulty
        const diffSelect = document.getElementById('difficulty-select');
        diffSelect.addEventListener('change', (e) => {
            this.difficulty = e.target.value;
            this.updateSpeed();
        });

        // Config Elements: Walls wrapping toggle
        const wrapBtn = document.getElementById('wall-wrap-btn');
        const solidBtn = document.getElementById('wall-solid-btn');
        
        wrapBtn.addEventListener('click', () => {
            this.wrapWalls = true;
            wrapBtn.classList.add('active');
            solidBtn.classList.remove('active');
        });

        solidBtn.addEventListener('click', () => {
            this.wrapWalls = false;
            solidBtn.classList.add('active');
            wrapBtn.classList.remove('active');
        });

        // Config Elements: Theme Switcher
        const dots = document.querySelectorAll('.color-dot');
        dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                dots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                
                const colorName = dot.getAttribute('data-color');
                this.themeColor = colorName;

                // Update document root CSS accent colors for smooth styling transitions
                const root = document.documentElement;
                root.style.setProperty('--accent', `var(--${colorName})`);
                root.style.setProperty('--accent-glow', `var(--${colorName}-glow)`);
            });
        });

        // Mobile D-Pad touches
        document.getElementById('ctrl-up').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.changeDirection(0, -1);
        });
        document.getElementById('ctrl-down').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.changeDirection(0, 1);
        });
        document.getElementById('ctrl-left').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.changeDirection(-1, 0);
        });
        document.getElementById('ctrl-right').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.changeDirection(1, 0);
        });
        document.getElementById('ctrl-pause').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.togglePause();
        });

        // Fallbacks for mouse click simulation on desktop devTools testing
        document.getElementById('ctrl-up').addEventListener('mousedown', () => this.changeDirection(0, -1));
        document.getElementById('ctrl-down').addEventListener('mousedown', () => this.changeDirection(0, 1));
        document.getElementById('ctrl-left').addEventListener('mousedown', () => this.changeDirection(-1, 0));
        document.getElementById('ctrl-right').addEventListener('mousedown', () => this.changeDirection(1, 0));
        document.getElementById('ctrl-pause').addEventListener('mousedown', () => this.togglePause());

        // Mobile Touch Swipe Gesture Tracker on the Canvas
        let touchStartX = 0;
        let touchStartY = 0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        this.canvas.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            
            // Threshold to register a clear swipe (min 30px)
            const minSwipeLength = 30;
            if (Math.abs(diffX) < minSwipeLength && Math.abs(diffY) < minSwipeLength) return;

            // Determine if swipe was mostly horizontal or vertical
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 0) {
                    this.changeDirection(1, 0); // Right
                } else {
                    this.changeDirection(-1, 0); // Left
                }
            } else {
                if (diffY > 0) {
                    this.changeDirection(0, 1); // Down
                } else {
                    this.changeDirection(0, -1); // Up
                }
            }
        }, { passive: true });

        // Resize handler to adjust logical scale sizing on orientation flip
        window.addEventListener('resize', () => {
            this.setupCanvasDPR();
            this.draw();
        });
    }
}

// Instantiate game instance when DOM loads
window.addEventListener('DOMContentLoaded', () => {
    new SnakeGame();
});
