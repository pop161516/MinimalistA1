// html elements
const player = document.getElementById('player');
const target = document.getElementById('target');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');
const endlessToggle = document.getElementById('endless-toggle');
const tiltToggle = document.getElementById('tilt-toggle');
const controls = document.querySelector('.controls');

// variables
let playerPos = { x: window.innerWidth/2, y: window.innerHeight/2 };
let targetPos = { x: 0, y: 0 };
let rawGPSPos = { x: window.innerWidth/2, y: window.innerHeight/2 };
let tiltOffset = { x: 0, y: 0 }; 
let originCoords = null;
let noiseOffset = 0;

const SENSITIVITY = 1000000; 
const SMOOTHING = 0.08;      

const PLAYER_SIZE = 15; 
const SUCCESS_DIST = 45; 
let isInsideTarget = false;

let audioCtx, filter, mainGain;
let oscillators = [];

// --- HIDDEN DEV MODE LOGIC ---
// Double tap to show/hide the control panel
let lastTap = 0;
document.addEventListener('touchend', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
        // Toggle UI visibility
        const isHidden = controls.style.display === 'none' || controls.style.display === '';
        controls.style.display = isHidden ? 'flex' : 'none';
        e.preventDefault(); 
    }
    lastTap = currentTime;
});

function handleTilt(e) {
    if (tiltToggle && tiltToggle.checked) {
        tiltOffset.x += e.gamma * 0.5; 
        tiltOffset.y += e.beta * 0.5;
    }
}

// Reset tilt if unticked
tiltToggle.addEventListener('change', () => {
    if (!tiltToggle.checked) tiltOffset = { x: 0, y: 0 };
});

function triggerHaptics() {
    if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]); 
    }
}

function playSuccessPing() {
    if (!audioCtx) return;
    const pingOsc = audioCtx.createOscillator();
    const pingGain = audioCtx.createGain();
    pingOsc.type = 'sine';
    pingOsc.frequency.setValueAtTime(1046.50, audioCtx.currentTime); 
    pingGain.gain.setValueAtTime(0, audioCtx.currentTime);
    pingGain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    pingGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
    pingOsc.connect(pingGain);
    pingGain.connect(audioCtx.destination);
    pingOsc.start();
    pingOsc.stop(audioCtx.currentTime + 0.8);
}

function initAngelicAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    filter = audioCtx.createBiquadFilter();
    mainGain = audioCtx.createGain();

    const harmonics = [1.0, 1.5, 2.0]; 
    harmonics.forEach((ratio, index) => {
        let osc = audioCtx.createOscillator();
        let oscGain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 220 * ratio; 
        oscGain.gain.value = 0.15 / (index + 1); 
        osc.connect(oscGain);
        oscGain.connect(filter);
        oscillators.push(osc);
        osc.start();
    });

    filter.type = 'lowpass';
    filter.frequency.value = 600; 
    mainGain.gain.value = 0.5; 
    filter.connect(mainGain);
    mainGain.connect(audioCtx.destination);
}

function moveTarget() {
    const padding = 50;
    targetPos.x = Math.random() * (window.innerWidth - (padding * 2)) + padding;
    targetPos.y = Math.random() * (window.innerHeight - (padding * 2)) + padding;
    target.style.left = `${targetPos.x}px`;
    target.style.top = `${targetPos.y}px`;
}

function update() {
    if (endlessToggle.checked) {
        noiseOffset += 0.005;
        let nextX = targetPos.x + Math.sin(noiseOffset) * 0.9;
        let nextY = targetPos.y + Math.cos(noiseOffset * 0.7) * 0.9;
        const pad = 40;
        if (nextX > pad && nextX < window.innerWidth - pad) targetPos.x = nextX;
        if (nextY > pad && nextY < window.innerHeight - pad) targetPos.y = nextY;
        target.style.left = `${targetPos.x}px`;
        target.style.top = `${targetPos.y}px`;
    }

    // Combined GPS + Tilt
    let combinedX = rawGPSPos.x + tiltOffset.x;
    let combinedY = rawGPSPos.y + tiltOffset.y;

    playerPos.x += (combinedX - playerPos.x) * SMOOTHING;
    playerPos.y += (combinedY - playerPos.y) * SMOOTHING;

    playerPos.x = Math.max(PLAYER_SIZE, Math.min(window.innerWidth - PLAYER_SIZE, playerPos.x));
    playerPos.y = Math.max(PLAYER_SIZE, Math.min(window.innerHeight - PLAYER_SIZE, playerPos.y));

    player.style.left = `${playerPos.x}px`;
    player.style.top = `${playerPos.y}px`;
    
    if (oscillators.length > 0) {
        const dist = Math.sqrt(Math.pow(playerPos.x - targetPos.x, 2) + Math.pow(playerPos.y - targetPos.y, 2));
        const proximity = Math.max(0, 1 - (dist / 600)); 

        const baseFreq = 220 + (proximity * 220);
        oscillators[0].frequency.setTargetAtTime(baseFreq, audioCtx.currentTime, 0.2);
        oscillators[1].frequency.setTargetAtTime(baseFreq * 1.5, audioCtx.currentTime, 0.2);
        oscillators[2].frequency.setTargetAtTime(baseFreq * 2.0, audioCtx.currentTime, 0.2);

        filter.frequency.setTargetAtTime(400 + (proximity * 3000), audioCtx.currentTime, 0.2);
        mainGain.gain.setTargetAtTime(0.3 + (proximity * 0.6), audioCtx.currentTime, 0.2);

        if (dist < SUCCESS_DIST) {
            if (!isInsideTarget) {
                // 1. Logic for Standard vs Endless
                if (!endlessToggle.checked) {
                    playSuccessPing();
                    moveTarget();
                }

                // 2. TRIGGER THE VIBRATION HERE
                triggerHaptics(); 

                isInsideTarget = true;
                player.style.boxShadow = "0 0 40px #fff, 0 0 80px #4db8ff";
            }
        } else {
            isInsideTarget = false;
            player.style.boxShadow = "0 0 15px rgba(255,255,255,0.4)";
        }
    }
    requestAnimationFrame(update);
}

function handleLocation(position) {
    const { latitude, longitude } = position.coords;
    if (!originCoords) {
        originCoords = { lat: latitude, lng: longitude };
        return;
    }
    const dy = (originCoords.lat - latitude) * SENSITIVITY;
    const dx = (longitude - originCoords.lng) * SENSITIVITY;
    rawGPSPos.x = (window.innerWidth / 2) + dx;
    rawGPSPos.y = (window.innerHeight / 2) + dy;
}

startBtn.addEventListener('click', async () => {
    initAngelicAudio();
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
    moveTarget();

    // iOS Orientation Permission
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const res = await DeviceOrientationEvent.requestPermission();
            if (res === 'granted') window.addEventListener('deviceorientation', handleTilt);
        } catch (e) {}
    } else {
        window.addEventListener('deviceorientation', handleTilt);
    }

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(handleLocation, null, { enableHighAccuracy: true, maximumAge: 0 });
    }
    overlay.style.display = 'none';
    requestAnimationFrame(update);
});