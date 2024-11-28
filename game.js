class SoundManager {
    constructor() {
        this.audioContext = null;
        this.isMuted = false;
        this.isMusicMuted = false;
        this.backgroundMusic = new Audio('./assets/music.mp3');
        
        // Safely initialize AudioContext
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    createSound(frequency, duration = 0.1, volume = 0.3, type = 'sine') {
        if (this.isMuted || !this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (error) {
            console.warn('Sound creation error:', error);
        }
    }

    playJumpSound() {
        const frequencies = [330];
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                this.createSound(880, 0.1, 0.2); // High-pitched jump sound
            }, index * 100);
        });
    }

    playGameOverSound() {
        const frequencies = [330, 220, 165];
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                this.createSound(freq, 0.3, 0.4, 'triangle');
            }, index * 100);
        });
    }

    playMusic() {
        if (!this.isMusicMuted) {
            if (this.backgroundMusic.paused) {
                this.backgroundMusic = new Audio('./assets/music.mp3');
                this.backgroundMusic.volume = 0.3;
                this.backgroundMusic.play();
            } else {
                this.backgroundMusic.pause();
            };
        }else {
            this.backgroundMusic = new Audio('./assets/music.mp3');
            this.backgroundMusic.pause();
        }
    }

    toggleMusic() {
        this.isMusicMuted = !this.isMusicMuted;
        if (this.isMusicMuted) {
            this.backgroundMusic.pause();
        } else {
            if (this.gameActive) this.backgroundMusic.play();
        }
        return this.isMusicMuted;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }
}

class FlappySealGame {
    constructor() {
        // Get DOM elements
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.gameOverScreen = document.getElementById('gameOver');
        this.startScreen = document.getElementById('startScreen');
        this.finalScoreElement = document.getElementById('finalScore');
        this.pauseOverlay = document.getElementById('pauseOverlay');

        // Game settings
        this.gravity = 0.2;   // Increased by 15% from 0.48
        this.jumpForce = -6;   // Increased by 20% from -7.5
        this.rocketGap = 180;  // Slightly wider gap for faster gameplay
        this.rocketWidth = 50;
        this.sealSize = 50;
        this.gameSpeed = 1.5;  // Increased from 2.2 to 3.0
        
        // Hitbox adjustment
        this.sealHitboxScale = {
            width: 0.75,  // Slightly more forgiving hitbox
            height: 0.75
        };

        // Background animation settings
        this.nebulae = [];
        this.numNebulae = 8; // Increased number of nebulae
        this.nebulaOffset = 0;

        // Particle systems
        this.bubbles = [];
        this.ripples = [];
        this.scorePopups = [];
        this.comets = [];
        this.maxBubbles = 20;
        this.maxRipples = 3;
        this.maxComets = 5;  // Maximum number of comets on screen

        // Load assets
        this.loadAssets();

        // Event listeners
        this.canvas.addEventListener('click', () => this.jump());
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.jump();
        });
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.jump();
        });

        // Initialize game state
        this.reset();
        this.initializeBackground();

         // Sound management
         this.soundManager = new SoundManager();
    }

    initializeBackground() {
        // Create nebulae with x positions
        for (let i = 0; i < this.numNebulae; i++) {
            this.nebulae.push({
                x: Math.random() * (this.canvas.width + 400) - 200,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 200 + 150, // Larger nebulae
                color: this.getRandomNebulaeColor(),
                opacity: Math.random() * 0.3 + 0.1,
                parallaxSpeed: 0.5 + Math.random() * 0.2
            });
        }
    }

    getRandomNebulaeColor() {
        const colors = [
            'hsl(240, 70%, 50%)',  // Blue
            'hsl(280, 70%, 50%)',  // Purple
            'hsl(200, 70%, 50%)',  // Light Blue
            'hsl(320, 70%, 50%)',  // Pink
            'hsl(180, 70%, 50%)'   // Cyan
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updateBackground() {
        // Update nebula positions
        this.nebulae.forEach(nebula => {
            nebula.x -= this.gameSpeed * nebula.parallaxSpeed;
            if (nebula.x < -nebula.size) {
                nebula.x = this.canvas.width + nebula.size;
                nebula.y = Math.random() * this.canvas.height;
                nebula.color = this.getRandomNebulaeColor();
            }
        });
    }

    loadAssets() {
        // Load seal image
        this.sealImg = new Image();
        this.sealImg.src = 'assets/seal.svg';

        // Load rocket image
        this.rocketImg = new Image();
        this.rocketImg.src = 'assets/rocket.svg';

        // Load background
        this.backgroundImg = new Image();
        this.backgroundImg.src = 'assets/background.svg';
    }

    reset() {
        this.seal = {
            x: 50,
            y: this.canvas.height / 2,
            velocity: 0,
            rotation: 0
        };

        this.rockets = [];
        this.score = 0;
        this.gameActive = false;
        this.isPaused = true;
        this.bubbles = [];
        this.ripples = [];
        this.scorePopups = [];
        this.comets = [];

        // Add initial rocket
        this.addRocket();

        // Update score display
        this.scoreElement.textContent = `Score: ${this.score}`;
        
        // Hide game over screen and pause overlay
        this.gameOverScreen.style.display = 'none';
        this.pauseOverlay.style.display = 'none';
    }

    start() {
        this.gameActive = true;
        this.isPaused = true;
        this.startScreen.style.display = 'none';
        this.pauseOverlay.style.display = 'block';
        this.gameLoop();     
    }

    jump() {
        if (this.isPaused) {
            this.isPaused = false;
            this.soundManager.playMusic(); 
            this.pauseOverlay.style.display = 'none';
            this.seal.velocity = this.jumpForce;
            this.createRipple();
            this.soundManager.playJumpSound();
        } else if (this.gameActive) {
            this.seal.velocity = this.jumpForce;
            this.createRipple();
            this.soundManager.playJumpSound();
        }
    }

    createBubble() {
        if (this.bubbles.length >= this.maxBubbles) return;

        this.bubbles.push({
            x: Math.random() * this.canvas.width,
            y: this.canvas.height + 10,
            size: Math.random() * 4 + 2,
            speed: Math.random() * 2 + 1,
            opacity: Math.random() * 0.5 + 0.1
        });
    }

    createRipple() {
        if (this.ripples.length >= this.maxRipples) return;

        this.ripples.push({
            x: this.seal.x + this.sealSize/2,
            y: this.seal.y + this.sealSize/2,
            size: 14,          // Reduced from 20 by 30%
            opacity: 0.8,
            maxSize: 70,       // Reduced from 100 by 30%
            growthSpeed: 4     // Adjusted growth speed for smaller size
        });
    }

    createComet() {
        if (this.comets.length < this.maxComets) {
            this.comets.push({
                x: this.canvas.width + 50,  // Start from right side
                y: Math.random() * (this.canvas.height * 0.7),  // Start in top 70% of screen
                size: Math.random() * 3 + 2,  // Size between 2-5 pixels
                speed: Math.random() * 4 + 3,  // Speed between 3-7 pixels per frame
                angle: Math.random() * 15 + 15,  // Angle between 15-30 degrees downward
                tailLength: Math.random() * 50 + 30,  // Tail length between 30-80 pixels
                opacity: Math.random() * 0.5 + 0.5  // Opacity between 0.5-1
            });
        }
    }

    createScorePopup() {
        this.scorePopups.push({
            x: this.canvas.width / 2,
            y: 70,
            score: "+1",
            opacity: 1,
            scale: 1.5
        });
    }

    addRocket() {
        const minGapPosition = 50;
        const maxGapPosition = this.canvas.height - 50 - this.rocketGap;
        const gapPosition = Math.random() * (maxGapPosition - minGapPosition) + minGapPosition;

        this.rockets.push({
            x: this.canvas.width,
            gapTop: gapPosition,
            passed: false
        });
    }

    update() {
        this.updateBackground();

        if (!this.gameActive || this.isPaused) {
            // Gentle floating animation while paused
            this.seal.y = this.canvas.height / 2 + Math.sin(Date.now() / 500) * 20;
            this.seal.rotation = Math.sin(Date.now() / 1000) * 5;
            return;
        }

        // Create bubbles randomly
        if (Math.random() < 0.1) {
            this.createBubble();
        }

        // Create comets randomly
        if (Math.random() < 0.05) {  // 5% chance each frame
            this.createComet();
        }

        // Update bubbles
        this.bubbles = this.bubbles.filter(bubble => {
            bubble.y -= bubble.speed;
            return bubble.y + bubble.size > 0;
        });

        // Update ripples
        this.ripples = this.ripples.filter(ripple => {
            ripple.size += ripple.growthSpeed;
            ripple.opacity -= 0.04; // Faster fade out (0.8 / 0.04 = 20 frames ≈ 0.25 seconds at 60fps)
            return ripple.opacity > 0;
        });

        // Update comets
        this.updateComets();

        // Update score popups
        this.scorePopups = this.scorePopups.filter(popup => {
            popup.y -= 1;
            popup.opacity -= 0.02;
            popup.scale -= 0.01;
            return popup.opacity > 0;
        });

        // Update seal
        this.seal.velocity += this.gravity;
        this.seal.y += this.seal.velocity;
        this.seal.rotation = Math.min(Math.max(this.seal.velocity * 2, -30), 30);

        // Update rockets
        for (let rocket of this.rockets) {
            rocket.x -= this.gameSpeed;

            // Check if rocket is passed
            if (!rocket.passed && rocket.x + this.rocketWidth < this.seal.x) {
                rocket.passed = true;
                this.score++;
                this.scoreElement.textContent = `Score: ${this.score}`;
                this.createScorePopup();
            }
        }

        // Add new rocket when needed
        if (this.rockets[this.rockets.length - 1].x < this.canvas.width - 200) {
            this.addRocket();
        }

        // Remove off-screen rockets
        this.rockets = this.rockets.filter(rocket => rocket.x + this.rocketWidth > 0);

        // Check collisions
        if (this.checkCollision()) {
            this.gameOver();
            return;
        }

        // Check boundaries
        if (this.seal.y < 0 || this.seal.y + this.sealSize > this.canvas.height) {
            this.gameOver();
            return;
        }
    }

    updateComets() {
        // Create comets randomly
        if (Math.random() < 0.05) {  // 5% chance each frame
            this.createComet();
        }

        // Update existing comets
        this.comets = this.comets.filter(comet => {
            // Calculate movement based on angle
            const angleRad = (comet.angle * Math.PI) / 180;
            comet.x -= comet.speed * Math.cos(angleRad);
            comet.y += comet.speed * Math.sin(angleRad);
            
            // Remove if off screen (left or bottom)
            return comet.x + comet.tailLength > 0 && comet.y < this.canvas.height + 50;
        });
    }

    checkCollision() {
        const sealBox = {
            x: this.seal.x + this.sealSize * (1 - this.sealHitboxScale.width) / 2,
            y: this.seal.y + this.sealSize * (1 - this.sealHitboxScale.height) / 2,
            width: this.sealSize * this.sealHitboxScale.width,
            height: this.sealSize * this.sealHitboxScale.height
        };

        for (let rocket of this.rockets) {
            // Check collision with top rocket
            if (this.intersects(sealBox, {
                x: rocket.x + 5,  // Add 5px padding to rocket hitbox
                y: 0,
                width: this.rocketWidth - 10,  // Reduce hitbox width by 10px
                height: rocket.gapTop
            })) return true;

            // Check collision with bottom rocket
            if (this.intersects(sealBox, {
                x: rocket.x + 5,  // Add 5px padding to rocket hitbox
                y: rocket.gapTop + this.rocketGap,
                width: this.rocketWidth - 10,  // Reduce hitbox width by 10px
                height: this.canvas.height - (rocket.gapTop + this.rocketGap)
            })) return true;
        }

        return false;
    }

    intersects(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    draw() {
        // Clear canvas first
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw space background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#0a0a2a');    // Dark blue at top
        gradient.addColorStop(0.3, '#1a1a4a');  // Medium blue
        gradient.addColorStop(0.6, '#2a2a6a');  // Lighter blue
        gradient.addColorStop(0.8, '#1a1a4a');  // Back to medium blue
        gradient.addColorStop(1, '#0a0a2a');    // Dark blue at bottom
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw nebulae with parallax
        this.nebulae.forEach(nebula => {
            const gradient = this.ctx.createRadialGradient(
                nebula.x, nebula.y, 0,
                nebula.x, nebula.y, nebula.size
            );
            gradient.addColorStop(0, nebula.color);
            gradient.addColorStop(0.5, this.adjustColorOpacity(nebula.color, 0.5));
            gradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = gradient;
            this.ctx.globalAlpha = nebula.opacity;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1;
        });

        // Draw comets
        this.comets.forEach(comet => {
            // Calculate tail end point based on angle
            const angleRad = (comet.angle * Math.PI) / 180;
            const tailEndX = comet.x + comet.tailLength * Math.cos(angleRad);
            const tailEndY = comet.y - comet.tailLength * Math.sin(angleRad);
            
            // Draw comet tail (gradient)
            const tailGradient = this.ctx.createLinearGradient(
                tailEndX, tailEndY,
                comet.x, comet.y
            );
            tailGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
            tailGradient.addColorStop(1, `rgba(255, 255, 255, ${comet.opacity})`);

            // Save context for rotation
            this.ctx.save();
            this.ctx.translate(comet.x, comet.y);
            this.ctx.rotate(-angleRad);  // Negative angle to rotate clockwise
            this.ctx.translate(-comet.x, -comet.y);

            // Draw tail
            this.ctx.beginPath();
            this.ctx.moveTo(comet.x, comet.y - comet.size/2);
            this.ctx.lineTo(comet.x + comet.tailLength, comet.y);
            this.ctx.lineTo(comet.x, comet.y + comet.size/2);
            this.ctx.fillStyle = tailGradient;
            this.ctx.fill();

            // Draw comet head
            this.ctx.beginPath();
            this.ctx.arc(comet.x, comet.y, comet.size, 0, Math.PI * 2);
            this.ctx.fillStyle = 'white';
            this.ctx.fill();

            this.ctx.restore();
        });

        // Draw bubbles
        this.bubbles.forEach(bubble => {
            this.ctx.beginPath();
            this.ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${bubble.opacity})`;
            this.ctx.fill();
        });

        // Draw ripples
        this.ripples.forEach(ripple => {
            this.ctx.beginPath();
            this.ctx.arc(ripple.x, ripple.y, ripple.size, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.opacity})`;
            this.ctx.lineWidth = 2; // Reduced from 3 for smaller ripples
            this.ctx.stroke();
        });

        // Draw seal with smoother rotation
        this.ctx.save();
        this.ctx.translate(
            this.seal.x + this.sealSize/2,
            this.seal.y + this.sealSize/2
        );
        
        // Limit rotation angle and make it smoother
        const rotationAngle = Math.min(Math.max(this.seal.velocity * 2, -30), 30);
        this.ctx.rotate(rotationAngle * Math.PI / 180);
        
        this.ctx.drawImage(
            this.sealImg,
            -this.sealSize/2,
            -this.sealSize/2,
            this.sealSize,
            this.sealSize
        );
        this.ctx.restore();

        // Draw rockets
        for (let rocket of this.rockets) {
            // Draw top rocket
            this.ctx.save();
            this.ctx.translate(rocket.x, rocket.gapTop);
            this.ctx.scale(1, -1);
            this.ctx.drawImage(this.rocketImg, 0, 0, this.rocketWidth, rocket.gapTop);
            this.ctx.restore();

            // Draw bottom rocket
            this.ctx.drawImage(
                this.rocketImg,
                rocket.x,
                rocket.gapTop + this.rocketGap,
                this.rocketWidth,
                this.canvas.height - (rocket.gapTop + this.rocketGap)
            );
        }

        // Draw score popups
        this.scorePopups.forEach(popup => {
            this.ctx.save();
            this.ctx.fillStyle = `rgba(255, 255, 255, ${popup.opacity})`;
            this.ctx.font = `bold ${24 * popup.scale}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(popup.score, popup.x, popup.y);
            this.ctx.restore();
        });
    }

    adjustColorOpacity(color, opacity) {
        // Convert HSL color to RGBA with opacity
        return color.replace('hsl', 'hsla').replace(')', `, ${opacity})`);
    }

    gameLoop() {
        this.update();
        this.draw();

        if (this.gameActive) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }

    gameOver() {
        this.soundManager.playGameOverSound();
        this.gameActive = false;
        this.finalScoreElement.textContent = this.score;
        this.gameOverScreen.style.display = 'block';
        this.soundManager.playMusic(); 
    }
}

// Game instance
let game;

function toggleMute() {
    const muteButton = document.getElementById('muteButton');
    const isMuted = game.soundManager.toggleMute();
    
    // Update button icon
    muteButton.textContent = isMuted ? '🔇' : '🔊';
}

function toggleMusic() {
    const playButton = document.getElementById('playButton');
    const isMuted = game.soundManager.toggleMusic();
    
    // Update button icon
    playButton.textContent = isMuted ? '⏸️' : '▶️';
}

function startGame() {
    game = new FlappySealGame();
    game.start();
}

function restartGame() {
    game.reset();
    game.start();
}
