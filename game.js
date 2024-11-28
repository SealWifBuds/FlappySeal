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

    createSound(frequency, duration = 0.1, volume = 0.1, type = 'sine') {
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
                this.backgroundMusic.volume = 1;
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

        // Time-based update variables
        this.lastTime = 0;
        this.deltaTime = 0;
        this.targetFPS = 60;
        this.timeStep = 1000 / this.targetFPS;

        // Game settings
        this.baseSpeed = 60; // Reduced from 90
        this.gravity = 600; // Adjusted for better fall speed
        this.jumpForce = -300; // Adjusted for better jump height
        this.rocketGap = 180;
        this.rocketWidth = 50;
        this.sealSize = 50;
        this.gameSpeed = 2;
        
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
        this.flames = []; 
        this.rocketFlames = []; 
        this.rocketStreams = []; 
        this.isShootingFire = false; 
        this.maxBubbles = 20;
        this.maxRipples = 3;
        this.maxComets = 5;  // Maximum number of comets on screen
        this.maxFlames = 8; // Increased to create continuous line
        this.flameWidth = 100; // Width of each flame
        this.flameHeight = 60; // Height of the flames
        this.fireShootTimer = 0;
        this.fireShootDuration = 30; // 30 frames = 0.5 seconds at 60fps

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
        this.flames = []; 
        this.rocketFlames = []; 
        this.rocketStreams = []; 
        this.isShootingFire = false; 
        this.fireShootTimer = 0;
        // Initialize flames ahead of visible area
        this.initializeFlames();

        // Add initial rocket
        this.addRocket();

        // Update score display
        this.scoreElement.textContent = `Score: ${this.score}`;
        
        // Hide game over screen and pause overlay
        this.gameOverScreen.style.display = 'none';
        this.pauseOverlay.style.display = 'none';
    }

    initializeFlames() {
        // Calculate how many flames we need to cover the screen plus buffer
        const totalWidth = this.canvas.width + this.flameWidth * 4; // Extra buffer
        const numFlames = Math.ceil(totalWidth / (this.flameWidth * 0.7)) + 1; // Overlap flames by 30%

        // Create initial flames
        for (let i = 0; i < numFlames; i++) {
            this.flames.push({
                x: this.canvas.width + (i * this.flameWidth * 0.7), // Start from right edge with overlap
                y: this.canvas.height,
                width: this.flameWidth,
                height: this.flameHeight,
                frameCount: Math.random() * 100, // Randomize initial frame for varied animation
                speed: this.gameSpeed
            });
        }
    }

    createRocketFlame(x, y) {
        const numParticles = 5;
        for (let i = 0; i < numParticles; i++) {
            const speed = Math.random() * 3 + 5;
            const size = Math.random() * 10 + 5;
            const lifetime = Math.random() * 20 + 10;
            
            this.rocketFlames.push({
                x: x,
                y: y,
                vx: -speed, // Always shoot left
                vy: (Math.random() - 0.5) * 2, // Slight vertical spread
                size: size,
                lifetime: lifetime,
                maxLifetime: lifetime,
                color: `hsl(${Math.random() * 30}, 100%, 50%)`
            });
        }
    }

    createRocketStream(x, y, direction) {
        const numParticles = 5; // More particles for wider stream
        for (let i = 0; i < numParticles; i++) {
            const speed = Math.random() * 3; // Slightly faster for shorter stream
            const size = Math.random() * 12 + 8; // Bigger particles (8-20px instead of 4-12px)
            const lifetime = Math.random() * 10 + 10; // Shorter lifetime (10-20 frames instead of 15-35)
            const spread = Math.random() * 20 - 10; // Horizontal spread of ±10px
            
            this.rocketStreams.push({
                x: x + spread,  // Add spread to x position
                y: y,
                vx: -this.gameSpeed,
                vy: speed * direction,
                size: size,
                lifetime: lifetime,
                maxLifetime: lifetime,
                color: `hsl(${Math.random() * 40}, 100%, 50%)` // Blue colors (200-240 hue)
            });
        }
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
                speed: Math.random() * 1 + 2,  // Speed between 3-7 pixels per frame
                angle: Math.random() * 15 + 15,  // Angle between 15-30 degrees downward
                tailLength: Math.random() * 50 + 30,  // Tail length between 30-80 pixels
                opacity: Math.random() * 0.5 + 0.5  // Opacity between 0.5-1
            });
        }
    }

    createFlame() {
        // Calculate the rightmost flame's position
        let rightmostX = -Infinity;
        this.flames.forEach(flame => {
            rightmostX = Math.max(rightmostX, flame.x);
        });

        // Create new flame next to the rightmost one, with overlap
        this.flames.push({
            x: rightmostX + this.flameWidth * 0.7, // Overlap flames by 30%
            y: this.canvas.height,
            width: this.flameWidth,
            height: this.flameHeight,
            frameCount: Math.random() * 100,
            speed: this.gameSpeed
        });
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
        if(this.gameActive) {
            if (this.isPaused) {
                // Gentle floating animation while paused
                this.seal.y = this.canvas.height / 2 + Math.sin(Date.now() / 500) * 20;
                this.seal.rotation = Math.sin(Date.now() / 1000) * 5;
                return;
            }

            // Convert deltaTime from milliseconds to seconds for physics calculations
            const dt = this.deltaTime / 1000;

            // Update fire shoot timer
            if (this.isShootingFire) {
                this.fireShootTimer++;
                if (this.fireShootTimer >= this.fireShootDuration) {
                    this.isShootingFire = false;
                    this.fireShootTimer = 0;
                }
            }

            // Create bubbles randomly
            if (Math.random() < 0.1 * (dt * this.targetFPS)) {
                this.createBubble();
            }

            // Check if we need more flames ahead
            const rightmostFlame = Math.max(...this.flames.map(flame => flame.x), -Infinity);
            if (rightmostFlame < this.canvas.width + this.flameWidth * 3) {
                this.createFlame();
            }

            // Update bubbles
            this.bubbles = this.bubbles.filter(bubble => {
                bubble.y -= bubble.speed * (dt * 60);
                return bubble.y + bubble.size > 0;
            });

            // Update ripples
            this.ripples = this.ripples.filter(ripple => {
                ripple.size += ripple.growthSpeed * (dt * 60);
                ripple.opacity -= 0.04 * (dt * 60);
                return ripple.opacity > 0;
            });

            // Update comets
            this.updateComets();

            // Update score popups
            this.scorePopups = this.scorePopups.filter(popup => {
                popup.y -= 60 * dt; // 60 pixels per second
                popup.opacity -= 1.2 * dt;
                popup.scale -= 0.6 * dt;
                return popup.opacity > 0;
            });

            // Update flames
            this.flames = this.flames.filter(flame => {
                flame.x -= this.baseSpeed * this.gameSpeed * dt;
                flame.frameCount += 1;
                return flame.x + flame.width > -this.flameWidth;
            });

            // Update rocket flames
            this.rocketFlames = this.rocketFlames.filter(flame => {
                flame.lifetime--;
                flame.x += flame.vx * (dt * 60);
                flame.y += flame.vy * (dt * 60);
                return flame.lifetime > 0;
            });

            // Update rocket streams
            this.rocketStreams = this.rocketStreams.filter(stream => {
                stream.lifetime--;
                stream.x += stream.vx * (dt * 60);
                stream.y += stream.vy * (dt * 60);
                return stream.lifetime > 0;
            });

            // Update seal physics
            this.seal.velocity += this.gravity * dt;
            this.seal.y += this.seal.velocity * dt;
            this.seal.rotation = Math.min(Math.max(this.seal.velocity * 0.1, -30), 30);

            // Update rockets
            for (let rocket of this.rockets) {
                rocket.x -= this.baseSpeed * this.gameSpeed * dt;

                // Check if rocket is passed
                if (!rocket.passed && rocket.x + this.rocketWidth < this.seal.x) {
                    rocket.passed = true;
                    this.score++;
                    this.scoreElement.textContent = `Score: ${this.score}`;
                    this.createScorePopup();
                    this.isShootingFire = true;
                    this.fireShootTimer = 0;
                }

                // Create fire streams for all rockets if enabled
                if (this.isShootingFire && Math.random() < 0.4) {
                    // Increase particle frequency during short duration
                    const numBursts = 2; // Create multiple bursts per frame for more intense effect
                    for (let i = 0; i < numBursts; i++) {
                        // Top rocket shoots down
                        this.createRocketStream(rocket.x + this.rocketWidth/2, rocket.gapTop + 25, 1);
                        // Bottom rocket shoots up
                        this.createRocketStream(rocket.x + this.rocketWidth/2, rocket.gapTop + this.rocketGap - 25, -1);
                    }
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
    }

    updateComets() {
        // Create comets randomly
        if (Math.random() < 0.02) {  // 5% chance each frame
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

        // Check rocket collisions
        for (let rocket of this.rockets) {
            if (this.intersects(sealBox, {
                x: rocket.x + 5,
                y: 0,
                width: this.rocketWidth - 10,
                height: rocket.gapTop
            })) return true;

            if (this.intersects(sealBox, {
                x: rocket.x + 5,
                y: rocket.gapTop + this.rocketGap,
                width: this.rocketWidth - 10,
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
        gradient.addColorStop(0, '#0a0a2a');
        gradient.addColorStop(0.3, '#1a1a4a');
        gradient.addColorStop(0.6, '#2a2a6a');
        gradient.addColorStop(0.8, '#1a1a4a');
        gradient.addColorStop(1, '#0a0a2a');
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
        const rotationAngle = Math.min(Math.max(this.seal.velocity * 0.1, -30), 30);
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

        // Draw flames
        this.flames.forEach(flame => {
            // Create flame gradient
            const flameGradient = this.ctx.createLinearGradient(
                flame.x, flame.y,
                flame.x, flame.y - flame.height
            );
            
            // Animate flame colors
            const offset = Math.sin(flame.frameCount * 0.1) * 0.1;
            flameGradient.addColorStop(0, '#FF4500');  // Red-orange base
            flameGradient.addColorStop(0.4 + offset, '#FFA500');  // Orange middle
            flameGradient.addColorStop(1, '#FFD700');  // Yellow top
            
            this.ctx.fillStyle = flameGradient;
            
            // Draw multiple flame tips for each flame section
            const numTips = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(flame.x, flame.y);
            
            // Create base points
            for (let i = 0; i <= numTips; i++) {
                const x = flame.x + (flame.width * i) / numTips;
                const waveOffset = Math.sin((flame.frameCount + i * 30) * 0.3) * 8;
                const heightVariation = Math.sin((flame.frameCount + i * 20) * 0.2) * 10;
                
                if (i === 0) {
                    this.ctx.moveTo(x, flame.y);
                } else {
                    // Create flame tips
                    const midX = x - flame.width / (numTips * 2);
                    const tipHeight = flame.height + heightVariation;
                    this.ctx.quadraticCurveTo(
                        midX, flame.y - tipHeight + waveOffset,
                        x, flame.y
                    );
                }
            }
            
            this.ctx.closePath();
            
            // Add glow effect
            this.ctx.shadowColor = '#FF4500';
            this.ctx.shadowBlur = 20;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Draw rocket flames
        this.rocketFlames.forEach(flame => {
            const alpha = flame.lifetime / flame.maxLifetime;
            this.ctx.beginPath();
            this.ctx.fillStyle = flame.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
            this.ctx.arc(flame.x, flame.y, flame.size * (1 + (1 - alpha) * 0.5), 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw rocket streams
        this.rocketStreams.forEach(stream => {
            const alpha = stream.lifetime / stream.maxLifetime;
            this.ctx.beginPath();
            this.ctx.fillStyle = stream.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
            // Draw elongated flame particle
            this.ctx.ellipse(
                stream.x, 
                stream.y, 
                stream.size * 0.5, // width
                stream.size * (1 + (1 - alpha)), // height - gets longer as it fades
                0, 0, Math.PI * 2
            );
            this.ctx.fill();
        });

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

    gameLoop(currentTime) {
        if (!this.lastTime) this.lastTime = currentTime;
        
        // Calculate delta time in milliseconds
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Cap deltaTime to prevent huge jumps
        if (this.deltaTime > 100) this.deltaTime = 100;

        this.update();
        this.draw();
        requestAnimationFrame((time) => this.gameLoop(time));
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
