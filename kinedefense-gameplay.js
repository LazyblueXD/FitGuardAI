/**
 * KineDefense Gameplay Systems
 * Integrates with existing pose detection to provide game mechanics
 * 
 * Systems:
 * - Monster System: Spawns and manages monsters
 * - Path System: Generates random paths
 * - Wave System: Manages waves with difficulty scaling
 * - Combat System: Destroys monsters on valid reps
 */

// ===================== GAME STATE =====================
const gameState = {
    isActive: false,
    gameOver: false,
    waveNumber: 0,
    monstersSpawned: 0,
    monstersDestroyed: 0,
    currentWaveMonsters: [],
    pathPoints: [],
    spawnTimer: null,
    waveStartTime: null,
    baseHealth: 1, // No HP system, 1 hit = game over
    monsterSpeed: 1.0,
    difficulty: 1.0,
    lastSpawnTime: 0,
    spawnInterval: 2000, // 2 seconds per monster
    monstersPerWave: 5,
};

// ===================== MONSTER CLASS =====================
class Monster {
    constructor(id, pathPoints, speed) {
        this.id = id;
        this.pathPoints = pathPoints;
        this.speed = speed;
        this.pathIndex = 0;
        this.progress = 0; // 0 to 1 along the path
        this.x = pathPoints[0].x;
        this.y = pathPoints[0].y;
        this.radius = 12;
        this.color = '#ff6577';
        this.glowColor = 'rgba(255, 101, 119, 0.4)';
    }

    update(deltaTime) {
        // Move along path
        const distancePerFrame = (this.speed * deltaTime) / 1000; // pixels per millisecond
        const totalPathLength = this.calculatePathLength();
        
        this.progress += distancePerFrame / totalPathLength;
        
        if (this.progress >= 1) {
            return 'reached_base'; // Monster reached the base
        }
        
        // Calculate current position on path
        const position = this.getPositionOnPath(this.progress);
        this.x = position.x;
        this.y = position.y;
        
        return 'alive';
    }

    calculatePathLength() {
        let length = 0;
        for (let i = 1; i < this.pathPoints.length; i++) {
            const dx = this.pathPoints[i].x - this.pathPoints[i - 1].x;
            const dy = this.pathPoints[i].y - this.pathPoints[i - 1].y;
            length += Math.sqrt(dx * dx + dy * dy);
        }
        return length;
    }

    getPositionOnPath(progress) {
        const totalLength = this.calculatePathLength();
        const targetDistance = progress * totalLength;
        
        let currentDistance = 0;
        for (let i = 1; i < this.pathPoints.length; i++) {
            const p1 = this.pathPoints[i - 1];
            const p2 = this.pathPoints[i];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);
            
            if (currentDistance + segmentLength >= targetDistance) {
                const ratio = (targetDistance - currentDistance) / segmentLength;
                return {
                    x: p1.x + dx * ratio,
                    y: p1.y + dy * ratio
                };
            }
            currentDistance += segmentLength;
        }
        
        return this.pathPoints[this.pathPoints.length - 1];
    }

    draw(ctx) {
        // Glow effect
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = this.glowColor;
        ctx.fill();
        
        // Monster body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // Monster outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Eyes
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + 4, this.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ===================== PATH SYSTEM =====================
function generateRandomPath(canvasWidth, canvasHeight) {
    // Start point: top-center area
    const startX = canvasWidth / 2 + (Math.random() - 0.5) * 100;
    const startY = 20;
    
    // End point: bottom-center (base)
    const endX = canvasWidth / 2 + (Math.random() - 0.5) * 80;
    const endY = canvasHeight - 20;
    
    const pathPoints = [{ x: startX, y: startY }];
    
    // Generate 3-5 waypoints for natural path
    const numWaypoints = 3 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= numWaypoints; i++) {
        const t = i / (numWaypoints + 1);
        const baseX = startX + (endX - startX) * t;
        const baseY = startY + (endY - startY) * t;
        
        // Add random deviation for natural curves
        const deviation = 60 + Math.random() * 60;
        const angle = Math.random() * Math.PI * 2;
        const offsetX = Math.cos(angle) * deviation;
        const offsetY = Math.sin(angle) * deviation;
        
        pathPoints.push({
            x: Math.max(20, Math.min(canvasWidth - 20, baseX + offsetX)),
            y: Math.max(20, Math.min(canvasHeight - 20, baseY + offsetY))
        });
    }
    
    pathPoints.push({ x: endX, y: endY });
    
    // Validate path length (not too short, not too long)
    const pathLength = calculatePathLength(pathPoints);
    const minLength = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight) * 0.6;
    const maxLength = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight) * 1.5;
    
    if (pathLength < minLength || pathLength > maxLength) {
        return generateRandomPath(canvasWidth, canvasHeight); // Regenerate if invalid
    }
    
    return pathPoints;
}

function calculatePathLength(pathPoints) {
    let length = 0;
    for (let i = 1; i < pathPoints.length; i++) {
        const dx = pathPoints[i].x - pathPoints[i - 1].x;
        const dy = pathPoints[i].y - pathPoints[i - 1].y;
        length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
}

// ===================== WAVE SYSTEM =====================
function startNewWave(canvasWidth, canvasHeight) {
    gameState.waveNumber++;
    gameState.monstersSpawned = 0;
    gameState.currentWaveMonsters = [];
    gameState.waveStartTime = Date.now();
    
    // Generate new path for this wave
    gameState.pathPoints = generateRandomPath(canvasWidth, canvasHeight);
    
    // Increase difficulty every 10 waves
    if (gameState.waveNumber % 10 === 0) {
        gameState.monsterSpeed *= 1.15; // 15% speed increase
        gameState.difficulty *= 1.1;
    }
    
    // Start spawning monsters
    spawnNextMonster();
}

function spawnNextMonster() {
    if (gameState.monstersSpawned >= gameState.monstersPerWave) {
        return; // Wave complete, wait for all monsters to be destroyed
    }
    
    const now = Date.now();
    if (now - gameState.lastSpawnTime < gameState.spawnInterval) {
        return; // Not time to spawn yet
    }
    
    const monster = new Monster(
        gameState.monstersSpawned,
        gameState.pathPoints,
        gameState.monsterSpeed
    );
    
    gameState.currentWaveMonsters.push(monster);
    gameState.monstersSpawned++;
    gameState.lastSpawnTime = now;
    
    // Schedule next spawn
    if (gameState.monstersSpawned < gameState.monstersPerWave) {
        gameState.spawnTimer = setTimeout(spawnNextMonster, gameState.spawnInterval);
    }
}

// ===================== COMBAT SYSTEM =====================
function destroyMonster(monsterId) {
    const index = gameState.currentWaveMonsters.findIndex(m => m.id === monsterId);
    if (index !== -1) {
        gameState.currentWaveMonsters.splice(index, 1);
        gameState.monstersDestroyed++;
        return true;
    }
    return false;
}

function destroyRandomMonster() {
    if (gameState.currentWaveMonsters.length === 0) return false;
    
    // Destroy the first monster (closest to base)
    const monster = gameState.currentWaveMonsters[0];
    destroyMonster(monster.id);
    
    // Check if wave is complete
    if (gameState.monstersSpawned >= gameState.monstersPerWave && 
        gameState.currentWaveMonsters.length === 0) {
        startNewWave(gameState.canvasWidth, gameState.canvasHeight);
    }
    
    return true;
}

// ===================== GAME LOOP =====================
let lastFrameTime = Date.now();

function updateGameLogic() {
    if (!gameState.isActive || gameState.gameOver) return;
    
    const now = Date.now();
    const deltaTime = now - lastFrameTime;
    lastFrameTime = now;
    
    // Spawn monsters
    spawnNextMonster();
    
    // Update monsters
    const monstersToRemove = [];
    for (let i = gameState.currentWaveMonsters.length - 1; i >= 0; i--) {
        const monster = gameState.currentWaveMonsters[i];
        const status = monster.update(deltaTime);
        
        if (status === 'reached_base') {
            // Game Over
            endGame(false);
            return;
        }
    }
}

function drawGameCanvas(ctx, canvasWidth, canvasHeight) {
    if (!gameState.isActive) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw path (optional visualization)
    if (gameState.pathPoints.length > 1) {
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gameState.pathPoints[0].x, gameState.pathPoints[0].y);
        for (let i = 1; i < gameState.pathPoints.length; i++) {
            ctx.lineTo(gameState.pathPoints[i].x, gameState.pathPoints[i].y);
        }
        ctx.stroke();
    }
    
    // Draw base (end point)
    if (gameState.pathPoints.length > 0) {
        const basePoint = gameState.pathPoints[gameState.pathPoints.length - 1];
        ctx.fillStyle = 'rgba(124, 255, 107, 0.3)';
        ctx.beginPath();
        ctx.arc(basePoint.x, basePoint.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(124, 255, 107, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Draw monsters
    gameState.currentWaveMonsters.forEach(monster => {
        monster.draw(ctx);
    });
    
    // Draw HUD
    drawGameHUD(ctx, canvasWidth, canvasHeight);
}

function drawGameHUD(ctx, canvasWidth, canvasHeight) {
    // Wave number
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Wave: ${gameState.waveNumber}`, 20, 30);
    
    // Monsters remaining
    ctx.fillText(`Monsters: ${gameState.currentWaveMonsters.length}/${gameState.monstersPerWave}`, 20, 60);
    
    // Score
    ctx.fillText(`Destroyed: ${gameState.monstersDestroyed}`, 20, 90);
    
    // Difficulty
    ctx.fillStyle = 'rgba(255, 213, 107, 0.9)';
    ctx.fillText(`Speed: ${(gameState.monsterSpeed * 100).toFixed(0)}%`, canvasWidth - 200, 30);
}

// ===================== GAME START/END =====================
function startGame(canvasWidth, canvasHeight) {
    gameState.isActive = true;
    gameState.gameOver = false;
    gameState.waveNumber = 0;
    gameState.monstersDestroyed = 0;
    gameState.monsterSpeed = 1.0;
    gameState.difficulty = 1.0;
    gameState.canvasWidth = canvasWidth;
    gameState.canvasHeight = canvasHeight;
    gameState.lastSpawnTime = Date.now();
    
    lastFrameTime = Date.now();
    
    startNewWave(canvasWidth, canvasHeight);
}

function endGame(won) {
    gameState.isActive = false;
    gameState.gameOver = true;
    
    if (won) {
        console.log(`🎉 Victory! Completed ${gameState.waveNumber} waves!`);
    } else {
        console.log(`💀 Game Over! Monster reached the base at Wave ${gameState.waveNumber}`);
    }
    
    // Clear timers
    if (gameState.spawnTimer) {
        clearTimeout(gameState.spawnTimer);
    }
}

// ===================== INTEGRATION WITH POSE DETECTION =====================
// Call this function when a valid rep is detected
function onValidRepDetected() {
    if (!gameState.isActive || gameState.gameOver) return;
    
    // Destroy one monster per rep
    destroyRandomMonster();
}

// ===================== EXPORT FOR GLOBAL USE =====================
window.KineDefenseGame = {
    gameState,
    startGame,
    endGame,
    onValidRepDetected,
    updateGameLogic,
    drawGameCanvas,
    Monster,
    generateRandomPath,
    destroyRandomMonster
};
