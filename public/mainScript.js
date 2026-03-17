// --- Setup Canvas ---
const canvas = document.getElementById('cnv_element');
const ctx = canvas.getContext('2d');
let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// --- Game Variables ---
let player = { x: width / 2, y: height / 2 };
let target = { x: 0, y: 0 };
let gameStarted = false;

// Movement variables (Accelerometers are noisy, so we use "friction" to stabilize)
let posX = 0; 
let posY = 0;
let velX = 0;
let velY = 0;

// --- Audio Setup ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let oscillator = null;
let gainNode = null;

function initAudio() {
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime); // Start silent
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
}

// --- Target Logic ---
function setRandomTarget() {
    const minDistance = 200;
    let tx, ty, dist;
    
    do {
        tx = Math.random() * width;
        ty = Math.random() * height;
        let dx = tx - (width / 2);
        let dy = ty - (height / 2);
        dist = Math.sqrt(dx * dx + dy * dy);
    } while (dist < minDistance); // Keep picking until it's far enough away

    target.x = tx;
    target.y = ty;
}

// --- Motion Handling ---
function handleMotion(event) {
    if (!gameStarted) return;

    // acc.x is left/right, acc.y is forward/back
    let acc = event.acceleration; // Use .acceleration (excludes gravity)
    
    // Basic physics: Velocity += Acceleration
    // We add a heavy "friction" (0.9) so the player doesn't fly off screen
    velX = (velX + acc.x) * 0.9;
    velY = (velY - acc.y) * 0.9; // Y is inverted on screens

    posX += velX;
    posY += velY;

    // Map the relative movement to the screen center
    player.x = (width / 2) + (posX * 20); // Multiply by 20 for sensitivity
    player.y = (height / 2) + (posY * 20);
}

// --- Interaction (The "Start" Button) ---
document.getElementById('start_button').addEventListener('click', async () => {
    // 1. Request iOS Permissions
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const state = await DeviceMotionEvent.requestPermission();
        if (state !== 'granted') return alert("Permission needed!");
    }

    // 2. Resume Audio
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    initAudio();
    gainNode.gain.setTargetAtTime(0.1, audioCtx.currentTime, 0.1);

    // 3. Initialize Game
    setRandomTarget();
    window.addEventListener('devicemotion', handleMotion);
    gameStarted = true;
    document.getElementById('start_button').style.display = 'none';
    draw();
});

// --- Main Loop ---
function draw() {
    if (!gameStarted) return;
    requestAnimationFrame(draw);

    // Clear background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    // Draw Target (Optional: remove if you want it truly "blind")
    ctx.beginPath();
    ctx.arc(target.x, target.y, 20, 0, Math.PI * 2);
    ctx.strokeStyle = 'lime';
    ctx.stroke();

    // Draw Player
    ctx.beginPath();
    ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    // Distance & Sound Logic
    let dx = player.x - target.x;
    let dy = player.y - target.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    let maxDist = Math.sqrt(width**2 + height**2);

    // Higher pitch as distance gets smaller
    let freq = map(distance, 0, maxDist, 1200, 150);
    oscillator.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);

    // Check for Win
    if (distance < 25) {
        ctx.fillStyle = "white";
        ctx.font = "30px Arial";
        ctx.fillText("TARGET FOUND!", width/2 - 100, height/2);
    }
}

function map(val, a1, a2, b1, b2) {
    return b1 + (b2 - b1) * (val - a1) / (a2 - a1);
}