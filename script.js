const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameScale = 1;

// Fullscreen handling
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Calculate Scale: Base width 1200px (Desktop standard)
    // On mobile (e.g. 390px), scale will be ~0.33
    gameScale = Math.min(canvas.width / 1200, 1);
    if (gameScale < 0.4) gameScale = 0.4; // Minimum scale for visibility

    // Update Ship Position (Static & Scaled)
    ship.x = canvas.width / 2;
    ship.y = canvas.height - (180 * gameScale);

    // Update Boss Position
    boss.x = canvas.width / 2;
    boss.y = 150 * gameScale;
}
window.addEventListener('resize', resizeCanvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- SOUND MANAGER (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const sounds = {
    playTone: (freq, type, duration, vol = 0.1) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    playNoise: (duration, vol = 0.2) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        noise.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    },
    laserOsc: null,
    laserOsc: null,
    laserOsc2: null, // Second layer for thickness
    laserGain: null,
    startLaserBeam: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (sounds.laserOsc) return; // Already playing

        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // Unified Laser Sound: Very deep, unstable, harsh (Combo Style)
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc1.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.1);

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(75, audioCtx.currentTime); // Sub-bass

        // Slightly louder for combo, but same sound texture
        const volume = isComboMode ? 0.25 : 0.2;
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start();
        osc2.start();

        sounds.laserOsc = osc1;
        sounds.laserOsc2 = osc2;
        sounds.laserGain = gain;
    },
    stopLaserBeam: () => {
        if (sounds.laserOsc) {
            const gain = sounds.laserGain;

            // Fade out
            gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

            sounds.laserOsc.stop(audioCtx.currentTime + 0.1);
            if (sounds.laserOsc2) sounds.laserOsc2.stop(audioCtx.currentTime + 0.1);

            sounds.laserOsc = null;
            sounds.laserOsc2 = null;
            sounds.laserGain = null;
        }
    },
    rocket: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // Create noise buffer
        const bufferSize = audioCtx.sampleRate * 0.5; // 0.5 seconds
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        // Filter for "Whoosh" effect
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(3000, audioCtx.currentTime + 0.3); // Sweep up

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start();
    },
    explosion: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // ULTRA HARD DISTORTION
        const makeDistortionCurve = (amount) => {
            const k = typeof amount === 'number' ? amount : 50;
            const n_samples = 44100;
            const curve = new Float32Array(n_samples);
            const deg = Math.PI / 180;
            for (let i = 0; i < n_samples; ++i) {
                const x = i * 2 / n_samples - 1;
                // Hard clipping curve
                curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
            }
            return curve;
        };

        const dist = audioCtx.createWaveShaper();
        dist.curve = makeDistortionCurve(1000); // MAX DISTORTION
        dist.oversample = '4x';

        // Master Gain
        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(1.5, audioCtx.currentTime); // Overdrive volume
        masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

        dist.connect(masterGain);
        masterGain.connect(audioCtx.destination);

        // 1. The "Kick" (Square Wave for hardness)
        const osc = audioCtx.createOscillator();
        osc.type = 'square'; // Square hits harder than sine/triangle
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.2); // Snap down fast

        osc.connect(dist);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);

        // 2. The "Blast" (Noise)
        const bufferSize = audioCtx.sampleRate * 0.4;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        // Lowpass but open it up more for "crack"
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1500, audioCtx.currentTime); // Higher freq = more crack
        noiseFilter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);

        noise.connect(noiseFilter);
        noiseFilter.connect(dist);
        noise.start();
    },
    lock: () => sounds.playTone(1200, 'sine', 0.1, 0.05),
    correct: () => {
        sounds.playTone(600, 'sine', 0.1, 0.1);
        setTimeout(() => sounds.playTone(800, 'sine', 0.2, 0.1), 100);
    },
    wrong: () => {
        sounds.playTone(300, 'sawtooth', 0.2, 0.1);
        setTimeout(() => sounds.playTone(200, 'sawtooth', 0.3, 0.1), 150);
    },
    bossCharge: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 1.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.5);
    },
    heroCharge: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        // Rising pitch for charging
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.8); // 800ms charge duration

        // Volume ramp up
        gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
    },
    bossFire: () => {
        sounds.playNoise(1.0, 0.4);
        sounds.playTone(100, 'sawtooth', 1.0, 0.2);
    },
    // Music Handling
    bgMusic: new Audio('WhatsApp Audio 2025-12-04 at 10.22.37_ef5b8640.mp3'),
    victorySound: new Audio('mixkit-game-level-completed-2059 (1).wav'),
    loseSound: new Audio('lose-sfx-365579.mp3'),

    playBgMusic: () => {
        sounds.bgMusic.loop = true;
        sounds.bgMusic.volume = 0.7; // Reduced volume
        sounds.bgMusic.play().catch(e => console.log("Audio play failed:", e));
    },
    stopBgMusic: () => {
        sounds.bgMusic.pause();
        sounds.bgMusic.currentTime = 0;
    },
    playVictory: () => {
        sounds.stopBgMusic();
        sounds.victorySound.volume = 0.5;
        sounds.victorySound.play().catch(e => console.log("Audio play failed:", e));
    },
    playLose: () => {
        sounds.stopBgMusic();
        sounds.loseSound.volume = 0.6;
        sounds.loseSound.play().catch(e => console.log("Audio play failed:", e));
    }
};

// --- GAME ASSETS & OBJECTS ---

const ship = {
    x: canvas.width / 2,
    y: canvas.height - 150,
    width: 120,
    height: 160,
    speed: 6, // Max speed
    vx: 0,    // Velocity X
    vy: 0,    // Velocity Y
    friction: 0.92, // Drift factor (lower = slippery)
    acceleration: 0.8,
    tilt: 0   // Visual tilt angle
};

const boss = {
    x: canvas.width / 2,
    y: 150,
    width: 600,
    height: 800,
    health: 100,
    maxHealth: 100,
    scorchMarks: []
};

// Game State Arrays
let bullets = [];
let rockets = [];
let plasmaWaves = [];
let particles = [];
let energyParticles = [];
let engineTrails = [];
let stars = [];
let asteroids = [];
let nebulae = [];

// Visual State
let laserActive = false;
let laserCharging = false;
let laserFiring = false;
let laserChargeTime = 0;
let laserFireTime = 0;
const LASER_CHARGE_DURATION = 800;
const LASER_FIRE_DURATION = 2000; // Increased from 1000 for longer combo attacks

let shieldActive = false;
let shieldDuration = 0;
const SHIELD_DURATION = 2000;

let plasmaBurstActive = false;
let plasmaBurstTime = 0;
const PLASMA_BURST_DURATION = 1500;

let shakeAmount = 0;
let shakeDecay = 0.9;

// Boss Attack State
let bossAttacking = false;
let bossAttackPhase = 0; // 0: idle, 1: charging, 2: firing
let bossChargeTime = 0;
let bossCoreGlow = 0;
const BOSS_CHARGE_DURATION = 1500;
const BOSS_FIRE_DURATION = 500;

// Ship Damage State
let shipBlinking = false;
let shipBlinkTime = 0;
const SHIP_BLINK_DURATION = 1000;

// Combo Attack State
let isComboMode = false;

// Stars Init
// Stars Init (Parallax Layers)
// Layer 1: Distant stars (slow, small)
for (let i = 0; i < 200; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.0,
        speed: Math.random() * 0.2 + 0.1,
        layer: 1,
        alpha: Math.random() * 0.5 + 0.3
    });
}
// Layer 2: Mid-distance stars (medium speed)
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.5 + 0.4,
        layer: 2,
        alpha: Math.random() * 0.6 + 0.4
    });
}
// Layer 3: Close stars (fast, bright)
for (let i = 0; i < 50; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2.0 + 1.0,
        speed: Math.random() * 1.5 + 1.0,
        layer: 3,
        alpha: Math.random() * 0.4 + 0.6
    });
}

// Asteroids Init
for (let i = 0; i < 8; i++) {
    asteroids.push(createAsteroid(true)); // Start randomly on screen
}

// Nebulae Init
for (let i = 0; i < 3; i++) {
    nebulae.push(createNebula());
}

// --- QUIZ DATA ---
// --- QUIZ DATA POOLS ---
const questionsEasy = [
    { q: "What is AWS?", options: ["A social media platform", "A cloud service provider", "A mobile operating system", "A programming framework"], a: 1 },
    { q: "What is cloud computing?", options: ["Running programs offline", "Delivering IT resources over the internet", "Buying physical servers for local use", "A way to store emails only"], a: 1 },
    { q: "What is an AWS Region?", options: ["A single data center", "A group of Availability Zones", "A private network", "A type of storage"], a: 1 },
    { q: "What is an Availability Zone (AZ)?", options: ["A networking tool", "A physical data center inside a Region", "A type of EC2 instance", "A billing category"], a: 1 },
    { q: "What is Amazon EC2 used for?", options: ["Creating databases", "Running virtual servers", "Managing billing", "Storing objects"], a: 1 },
    { q: "What does S3 store?", options: ["Virtual machines", "Object data like images, files, videos", "SQL queries", "Lambda functions"], a: 1 },
    { q: "Which AWS service is serverless?", options: ["EC2", "Lambda", "EBS", "CloudFront"], a: 1 },
    { q: "What is Auto Scaling used for?", options: ["Encrypting data", "Automatically adding or removing EC2 instances", "Creating IAM users", "Running SQL databases"], a: 1 },
    { q: "Which service provides NoSQL storage?", options: ["RDS", "DynamoDB", "Redshift", "EFS"], a: 1 },
    { q: "What does IAM stand for?", options: ["Internal Access Management", "Identity and Access Management", "Internet Allocation Module", "Instance Access Monitoring"], a: 1 },
    { q: "What is the purpose of a Security Group?", options: ["To monitor billing", "To control inbound/outbound traffic for EC2", "To increase storage capacity", "To create VPCs"], a: 1 },
    { q: "What is RDS used for?", options: ["Running NoSQL queries", "Hosting managed relational databases", "Storing images", "Running container apps"], a: 1 },
    { q: "What does EBS provide?", options: ["Block storage for EC2", "Object storage for files", "SQL reporting", "Networking firewalls"], a: 0 },
    { q: "Which AWS service allows uploading code without managing servers?", options: ["S3", "Lambda", "CloudWatch", "Gateway"], a: 1 },
    { q: "What does VPC stand for?", options: ["Virtual Private Cloud", "Virtual Processing Center", "Visual Private Console", "Virtual Packet Container"], a: 0 },
    { q: "What is EFS mainly used for?", options: ["Long-term archival", "Shared file storage across multiple EC2 instances", "Storing IAM users", "Creating DNS zones"], a: 1 },
    { q: "What is the benefit of multiple Availability Zones?", options: ["Easier billing", "High availability and fault tolerance", "Faster IAM creation", "Free storage"], a: 1 }
];

const questionsMedium = [
    { q: "Which AWS model describes how responsibilities are shared?", options: ["Pay-as-you-go Model", "Multi-AZ Model", "Shared Responsibility Model", "Elasticity Model"], a: 2 },
    { q: "Which EC2 pricing option is best for long-term, steady workloads?", options: ["Spot Instances", "On-Demand", "Reserved Instances", "Dedicated Hosts"], a: 2 },
    { q: "What is the main purpose of an Elastic Load Balancer (ELB)?", options: ["Running SQL queries", "Distributing incoming traffic across resources", "Encrypting data", "Storing backups"], a: 1 },
    { q: "For unpredictable workloads, which compute option is most efficient?", options: ["Reserved Instances", "Lambda", "On-Prem Servers", "Dedicated Hosts"], a: 1 },
    { q: "Which AWS storage option provides shared file storage for multiple EC2 instances?", options: ["EBS", "EFS", "S3 Glacier", "IAM"], a: 1 },
    { q: "What does DynamoDB automatically manage for you?", options: ["Index creation only", "Scaling, backups, and performance", "EC2 instance launching", "SQL optimization"], a: 1 },
    { q: "What type of database engine does RDS NOT support?", options: ["MySQL", "PostgreSQL", "Oracle", "MongoDB"], a: 3 },
    { q: "What does S3 Versioning help with?", options: ["Reducing storage cost", "Recovering accidentally deleted or overwritten files", "Encrypting objects", "Faster upload speed"], a: 1 },
    { q: "What is the purpose of a NAT Gateway?", options: ["Provides internet access to public subnets", "Allows instances in private subnets to access the internet", "Blocks all internet traffic", "Creates IAM policies"], a: 1 },
    { q: "What does it mean that Security Groups are stateful?", options: ["They remember past logins", "Return traffic is automatically allowed", "They block all outbound traffic", "They encrypt all data"], a: 1 },
    { q: "In Lambda, what causes a 'cold start'?", options: ["Low storage space", "Creating a new execution environment", "High traffic load", "Incorrect IAM permissions"], a: 1 },
    { q: "What is the advantage of S3 Intelligent-Tiering?", options: ["It automatically moves data to cheaper storage tiers", "It increases object size limits", "It encrypts all objects", "It improves upload speed"], a: 0 },
    { q: "Which AWS service manages Docker containers without provisioning EC2 servers?", options: ["EC2", "Fargate", "ECR", "CloudFront"], a: 1 },
    { q: "What is a benefit of Multi-AZ deployment in RDS?", options: ["Faster development", "Automatic failover during outages", "Lower cost", "No backups required"], a: 1 },
    { q: "What does a Route Table in a VPC do?", options: ["Controls how traffic is directed in the network", "Manages IAM roles", "Stores DNS records", "Encrypts packets"], a: 0 },
    { q: "What AWS service is best suited for caching frequently accessed data?", options: ["S3 Glacier", "ElastiCache", "DynamoDB Streams", "EBS"], a: 1 }
];

const questionsHard = [
    { q: "Which scenario BEST fits using Spot Instances?", options: ["Running critical production apps", "Running fault-tolerant workloads like batch processing", "Hosting a relational database", "Storing long-term backups"], a: 1 },
    { q: "What is a major cause of high latency in Lambda cold starts?", options: ["IAM misconfiguration", "The function must initialize a new runtime environment", "Lack of S3 storage", "Network ACL restrictions"], a: 1 },
    { q: "DynamoDB distributes data across partitions based on:", options: ["Object size", "Sort key", "Partition key", "Lambda triggers"], a: 2 },
    { q: "What is a common use of VPC Peering?", options: ["To connect two VPCs privately without going over the internet", "To reduce S3 storage cost", "To auto-scale EC2 instances", "To manage IAM roles"], a: 0 },
    { q: "What is the key difference between Security Groups and NACLs?", options: ["Security Groups are stateless; NACLs are stateful", "Security Groups are stateful; NACLs are stateless", "Both are stateless", "Both are stateful"], a: 1 },
    { q: "Why is Aurora faster than traditional RDS engines?", options: ["It uses a NoSQL architecture", "It stores data across a distributed storage layer separate from compute", "It runs only on EC2 Spot Instances", "It uses Lambda behind the scenes"], a: 1 },
    { q: "S3 Glacier Deep Archive is ideal for:", options: ["Real-time AI workloads", "Data accessed once a week", "Rarely accessed data with retrieval times of hours", "Running container apps"], a: 2 },
    { q: "What is the main benefit of using AWS Fargate over ECS with EC2?", options: ["Higher memory capacity", "Zero server management—AWS handles the compute layer", "Guaranteed lowest cost", "Easier IAM configuration"], a: 1 },
    { q: "What happens during an RDS failover in Multi-AZ deployments?", options: ["Database becomes read-only", "DNS automatically switches to a standby replica", "You must restart the database manually", "All data must be restored from backup"], a: 1 },
    { q: "What is the purpose of a VPC Endpoint for S3?", options: ["Encrypt S3 objects", "Provide private access to S3 without using the public internet", "Increase S3 bucket storage", "Accelerate downloads"], a: 1 },
    { q: "Which AWS service automatically provisions and manages container clusters?", options: ["S3", "IAM", "EKS", "EFS"], a: 2 },
    { q: "What is the main advantage of DynamoDB Global Tables?", options: ["Lower storage cost", "Multi-region, fully active replication for low-latency access", "Automatic SQL query optimization", "Faster Lambda cold starts"], a: 1 },
    { q: "What happens when an S3 bucket has versioning enabled and an object is deleted?", options: ["S3 removes it permanently", "A delete marker is added, and older versions remain", "All versions are deleted", "Objects are moved to Glacier automatically"], a: 1 },
    { q: "What is AWS Transit Gateway used for?", options: ["Running serverless code", "Centralized connectivity between multiple VPCs and on-prem networks", "Managing RDS backups", "Encrypting Lambda functions"], a: 1 }
];

let currentSessionDeck = [];

function generateSessionDeck() {
    const getRandom = (arr, n) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    };

    return [
        ...getRandom(questionsEasy, 4).map(q => ({ ...q, difficulty: 'EASY' })),
        ...getRandom(questionsMedium, 3).map(q => ({ ...q, difficulty: 'MEDIUM' })),
        ...getRandom(questionsHard, 3).map(q => ({ ...q, difficulty: 'HARD' }))
    ];
}

// --- BOSS VOICE SYSTEM ---
const bossVoiceLines = {
    intro: [
        "Intruder detected. Preparing to delete.",
        "Your cloud skills will be tested.",
        "I am the root user here."
    ],
    wrongEasy: [
        "My micro chip is sma (1).mp3",
        "Latency detected in .mp3",
        "Waste of RAM .mp3",
        "Bold choice For dyin.mp3"

    ],
    wrongHard: [
        "Scaling down your li.mp3",
        "Deployment failed .mp3",
        "Brain missing .mp3"
    ],
    streak: [
        "Warning. Traffic spike detected.",
        "Rerouting power to defenses.",
        "You are consuming too many resources.",
        "Do not think you can scale past me."
    ],
    win: [
        "System... shutting... down...",
        "Critical... failure...",
        "You have... root... access..."
    ],
    lose: [
        "Garbage collection complete.",
        "Brain cache cleared .mp3",
        "Your session has exp.mp3"
    ]
};

const voiceSubtitles = {
    "My micro chip is sma (1).mp3": "MY MICROCHIP IS SMARTER THAN YOU",
    "Latency detected in .mp3": "LATENCY DETECTED IN YOUR BRAIN",
    "Waste of RAM .mp3": "WASTE OF RAM",
    "Bold choice For dyin.mp3": "BOLD CHOICE FOR DYING EARLY",
    "Scaling down your li.mp3": "SCALING DOWN YOUR LIFE EXPECTANCY",
    "Deployment failed .mp3": "DEPLOYMENT FAILED",
    "Brain missing .mp3": "BRAIN MISSING",
    "Brain cache cleared .mp3": "BRAIN CACHE CLEARED",
    "Your session has exp.mp3": "YOUR SESSION HAS EXPIRED"
};

let lastBossLine = ""; // Track last played line

function speakBoss(category) {
    if (isMuted) return; // Respect mute button

    // Pick random line (which is now a filename)
    const lines = bossVoiceLines[category];
    // If no lines for this category, or empty array, do nothing
    if (!lines || lines.length === 0) return;

    let filename;
    let attempts = 0;
    // Try to pick a new line that isn't the same as the last one
    do {
        filename = lines[Math.floor(Math.random() * lines.length)];
        attempts++;
    } while (filename === lastBossLine && lines.length > 1 && attempts < 10);

    lastBossLine = filename; // Update history

    // If the line is just text (legacy fallback), ignore it or use old method
    // But we assume they are filenames now like "file.mp3"
    if (!filename.endsWith('.mp3') && !filename.endsWith('.wav')) {
        console.log("Skipping TTS line:", filename);
        return;
    }

    // Show Subtitle
    const subtitleText = voiceSubtitles[filename];
    if (subtitleText) {
        // Use a "Vigorous" Red color for boss speech
        showAttackName(null, subtitleText, "#ff0033");
    }

    // Audio Ducking (Lower music while speaking)
    if (sounds.bgMusic && !sounds.bgMusic.paused) {
        sounds.bgMusic.volume = 0.2;
    }

    const voiceAudio = new Audio(filename);
    voiceAudio.volume = 1.0;

    voiceAudio.play().catch(e => console.error("Voice play failed:", e));

    voiceAudio.onended = () => {
        if (sounds.bgMusic && !sounds.bgMusic.paused) {
            sounds.bgMusic.volume = 0.7;
        }
    };

    voiceAudio.onerror = () => {
        console.error("Error playing voice file:", filename);
        if (sounds.bgMusic) sounds.bgMusic.volume = 0.7;
    };
}

// --- ATTACK VISUALS ---
const attackNames = {
    laser: { text: "EC2 ELASTIC BEAM", color: "#ffaa00" },
    rockets: { text: "LAMBDA SWARM", color: "#ff4400" },
    combo: { text: "BEDROCK COMBO", color: "#d900ff" }
};

let attackOverlay = {
    active: false,
    text: "",
    color: "#fff",
    life: 0,
    scale: 1
};

// --- LOGIC STATE ---
let gameState = {
    score: 0,
    lives: 3,
    bossHP: 100,
    maxBossHP: 100,
    currentQuestion: 0,
    isQuizActive: true,
    gameOver: false,
    streak: 0
};

// DOM Elements
const quizOverlay = document.getElementById('quizOverlay');
const questionText = document.getElementById('questionText');
const optionsGrid = document.getElementById('optionsGrid');
const feedbackText = document.getElementById('feedbackText');
const scoreText = document.getElementById('scoreText');
const livesContainer = document.getElementById('livesContainer');
const bossHpText = document.getElementById('bossHpText');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const gameOverTitle = document.getElementById('gameOverTitle');
const finalScore = document.getElementById('finalScore');

// --- QUIZ FUNCTIONS ---

function initQuiz() {
    currentSessionDeck = generateSessionDeck();
    gameState.currentQuestion = 0;
    showQuestion();
    updateStats();
}

function showQuestion() {
    if (gameState.currentQuestion >= currentSessionDeck.length) {
        currentSessionDeck = generateSessionDeck();
        gameState.currentQuestion = 0;
    }

    const q = currentSessionDeck[gameState.currentQuestion];

    // Difficulty Color
    let diffColor = '#00ff88';
    if (q.difficulty === 'MEDIUM') diffColor = '#ffaa00';
    if (q.difficulty === 'HARD') diffColor = '#ff4444';

    questionText.innerHTML = `<span style="color:${diffColor}; font-size: 16px; display:block; margin-bottom:10px; letter-spacing:4px;">// ${q.difficulty} PROTOCOL</span>${q.q}`;
    optionsGrid.innerHTML = '';
    feedbackText.textContent = '';

    q.options.forEach((opt, idx) => {
        const btn = document.createElement('div');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswer(idx, btn);
        optionsGrid.appendChild(btn);
    });

    gameState.isQuizActive = true;
    quizOverlay.style.display = 'block';
}

function handleAnswer(selectedIndex, btnElement) {
    if (!gameState.isQuizActive) return;
    gameState.isQuizActive = false;

    const q = currentSessionDeck[gameState.currentQuestion];
    const isCorrect = selectedIndex === q.a;

    if (isCorrect) {
        sounds.correct();
        gameState.streak++;
        btnElement.classList.add('correct');

        if (gameState.streak % 4 === 0) {
            feedbackText.textContent = "4 STREAK! COMBO ATTACK!";
            feedbackText.style.color = "#ff00ff";
            speakBoss('streak'); // Boss reacts to streak
        } else {
            feedbackText.textContent = "CORRECT! ATTACKING BOSS!";
            feedbackText.style.color = "#00ff88";
        }

        gameState.score += 100;
        setTimeout(() => {
            quizOverlay.style.display = 'none';
            triggerHeroAttack();
        }, 1000);
    } else {
        sounds.wrong();
        gameState.streak = 0;
        btnElement.classList.add('wrong');
        // Highlight correct one
        const correctBtn = optionsGrid.children[q.a];
        correctBtn.classList.add('correct');

        // Smart Roast
        if (q.difficulty === 'EASY') {
            speakBoss('wrongEasy');
        } else {
            speakBoss('wrongHard');
        }

        feedbackText.textContent = "WRONG! INCOMING ATTACK!";
        feedbackText.style.color = "#ff4444";
        setTimeout(() => {
            quizOverlay.style.display = 'none';
            triggerBossAttack();
        }, 1500);
    }

    gameState.currentQuestion++;
    updateStats();
}

function updateStats() {
    scoreText.textContent = gameState.score;
    // Update Boss HP Bar Width
    const hpPercent = (gameState.bossHP / gameState.maxBossHP) * 100;
    document.getElementById('bossHpFill').style.width = `${hpPercent}%`;

    // Update Lives with Shield Icons
    livesContainer.textContent = '🛡️'.repeat(gameState.lives);
}

// Mute Logic
let isMuted = false;
const muteBtn = document.getElementById('muteBtn');
muteBtn.onclick = () => {
    isMuted = !isMuted;
    if (isMuted) {
        sounds.bgMusic.muted = true;
        sounds.victorySound.muted = true;
        muteBtn.textContent = "🔇 MUSIC OFF";
        muteBtn.style.color = "#ff4444";
        muteBtn.style.borderColor = "#ff4444";
    } else {
        sounds.bgMusic.muted = false;
        sounds.victorySound.muted = false;
        muteBtn.textContent = "🔊 MUSIC ON";
        muteBtn.style.color = "#00ff88";
        muteBtn.style.borderColor = "#00ff88";
    }
};

function endGame(victory) {
    gameState.gameOver = true;
    gameOverOverlay.style.display = 'flex';
    gameOverTitle.textContent = victory ? "MISSION ACCOMPLISHED" : "MISSION FAILED";
    gameOverTitle.style.color = victory ? "#00ff88" : "#ff4444";
    finalScore.textContent = `Final Score: ${gameState.score}`;

    if (victory) {
        sounds.playVictory();
        speakBoss('win');
    } else {
        sounds.playLose();
        speakBoss('lose');
    }
}

// --- COMBAT SEQUENCES ---

function triggerHeroAttack() {
    const isCombo = gameState.streak > 0 && gameState.streak % 4 === 0;
    isComboMode = isCombo; // Set combo mode for visual effects

    let attackType = 'laser'; // Default

    if (isCombo) {
        attackType = 'combo';
        // Combo: Fire Everything
        fireLaser();
        setTimeout(fireRockets, 300);
        setTimeout(plasmaBurst, 600);
        shakeAmount = 20;
    } else {
        // Single: Randomly fire Laser OR Rockets
        if (Math.random() > 0.5) {
            attackType = 'laser';
            fireLaser();
        } else {
            attackType = 'rockets';
            fireRockets();
        }
    }

    showAttackName(attackType);

    // Damage Logic
    setTimeout(() => {
        gameState.bossHP -= 10; // 10 hits to kill
        if (gameState.bossHP <= 0) gameState.bossHP = 0;
        updateStats();

        // Visual Impact on Boss (Fallback if collision missed)
        shakeAmount = 10;

        if (gameState.bossHP <= 0) {
            // Delay end game for dramatic explosion
            setTimeout(() => endGame(true), 2000);
        } else {
            // Delay next question to let animations finish
            setTimeout(showQuestion, 2000);
        }
    }, 2000); // Wait 2s for projectiles to hit first
}

function triggerBossAttack() {
    // Start Boss Attack Sequence: "THE HELLSTORM"
    bossAttacking = true;
    bossAttackPhase = 1; // Charging phase
    bossChargeTime = 0;
    bossCoreGlow = 0;

    sounds.bossCharge();

    // 1. SIDE ARMOR CHARGE
    // Particles flow from side armor to core
    const scale = 1.3 * gameScale;
    const leftArmorX = boss.x - 220 * scale;
    const rightArmorX = boss.x + 220 * scale;
    const armorY = boss.y + 20 * scale;
    const coreX = boss.x;
    const coreY = boss.y + 45 * scale;

    for (let i = 0; i < 60; i++) {
        setTimeout(() => {
            // From left armor
            energyParticles.push({
                x: leftArmorX + (Math.random() - 0.5) * 40,
                y: armorY + (Math.random() - 0.5) * 40,
                targetX: coreX,
                targetY: coreY,
                speed: Math.random() * 5 + 8,
                radius: Math.random() * 3 + 2,
                color: '#ff0000'
            });

            // From right armor
            energyParticles.push({
                x: rightArmorX + (Math.random() - 0.5) * 40,
                y: armorY + (Math.random() - 0.5) * 40,
                targetX: coreX,
                targetY: coreY,
                speed: Math.random() * 5 + 8,
                radius: Math.random() * 3 + 2,
                color: '#ff0000'
            });
        }, i * 20);
    }

    // 2. CHAOS BARRAGE (Fire)
    setTimeout(() => {
        bossAttackPhase = 2; // Firing phase
        shakeAmount = 40; // Violent shake
        sounds.bossFire();
        sounds.explosion(); // Add explosion sound for impact

        // A. Triple Laser Blast
        const beamColors = ['#ff0000', '#8b0000', '#ff4400'];
        for (let b = 0; b < 3; b++) {
            // 3 Beams: Center, Left-Angled, Right-Angled
            const angleOffset = (b - 1) * 0.3;
            const endX = ship.x + (b - 1) * (110 * gameScale);

            for (let i = 0; i < 150; i++) {
                const t = i / 150;
                particles.push({
                    x: coreX + (endX - coreX) * t + (Math.random() - 0.5) * (10 * gameScale),
                    y: coreY + (ship.y - coreY) * t + (Math.random() - 0.5) * (10 * gameScale),
                    vx: (Math.random() - 0.5) * 10, // Chaotic spray
                    vy: (Math.random() - 0.5) * 10,
                    life: 1.5,
                    decay: 0.03,
                    radius: Math.random() * 6 + 3,
                    color: beamColors[b]
                });
            }
        }

        // B. Ring of Death (Projectiles)
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            plasmaWaves.push({
                x: coreX,
                y: coreY,
                radius: 10 * gameScale, // Scale radius
                speed: 8 * gameScale,   // Scale speed
                vx: Math.cos(angle) * 10 * gameScale,
                vy: Math.sin(angle) * 10 * gameScale,
                alpha: 1,
                color: '#ff0000'
            });
        }

        // CLEAR CHARGE PARTICLES to prevent lingering dots
        energyParticles = [];

        // Impact on ship
        setTimeout(() => {
            shakeAmount = 50;
            gameState.lives--;
            updateStats();

            // Activate ship blinking
            shipBlinking = true;
            shipBlinkTime = 0;

            // Massive explosion on ship
            for (let i = 0; i < 100; i++) {
                particles.push(createParticle(ship.x, ship.y, '#ff0000', 8));
                particles.push(createParticle(ship.x, ship.y, '#000000', 6));
            }

            if (gameState.lives <= 0) {
                setTimeout(() => endGame(false), 2000);
            } else {
                setTimeout(showQuestion, 3000); // Wait for chaos to clear
            }
        }, 1000); // Allow beam to travel fully
    }, 1500);
}



// --- HELPER FUNCTIONS ---
function createParticle(x, y, color, speed = 1) {
    if (particles.length > 300) particles.shift();
    return {
        x: x, y: y,
        vx: (Math.random() - 0.5) * speed * 4,
        vy: (Math.random() - 0.5) * speed * 4,
        life: 1, decay: 0.02,
        radius: Math.random() * 3 + 1,
        color: color
    };
}

function createEnergyParticle(targetX, targetY) {
    if (energyParticles.length > 100) energyParticles.shift();
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 250 + 150;
    return {
        x: targetX + Math.cos(angle) * distance,
        y: targetY + Math.sin(angle) * distance,
        targetX: targetX, targetY: targetY,
        speed: Math.random() * 4 + 3,
        radius: Math.random() * 3 + 1,
        color: `hsl(${Math.random() * 60 + 280}, 100%, 60%)`
    };
}

function showAttackName(type, customText = null, customColor = null) {
    if (customText) {
        // Custom Text Mode (for Boss Speech)
        attackOverlay.active = true;
        attackOverlay.text = customText;
        attackOverlay.color = customColor || "#ffffff";
        attackOverlay.life = 2.0; // Slightly longer for reading
        attackOverlay.scale = 0.5;
        return;
    }

    const info = attackNames[type];
    if (!info) return;
    attackOverlay.active = true;
    attackOverlay.text = info.text;
    attackOverlay.color = info.color;
    attackOverlay.life = 1.5; // Seconds
    attackOverlay.scale = 0.5;
}

function drawAttackOverlay() {
    if (!attackOverlay.active) return;

    ctx.save();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - (150 * gameScale);

    // Animation Math
    if (attackOverlay.scale < 1.2) {
        attackOverlay.scale += 0.05; // Zoom in
    }

    ctx.translate(centerX, centerY);
    ctx.scale(attackOverlay.scale, attackOverlay.scale);

    // Glitch Offset
    const glitchX = (Math.random() - 0.5) * 10;
    const glitchY = (Math.random() - 0.5) * 5;

    // Adaptive Font Size for Long Text
    let fontSize = 60 * gameScale;
    if (attackOverlay.text.length > 20) {
        fontSize *= 0.6; // Shrink for long sentences
    }
    ctx.font = `bold ${fontSize}px 'Orbitron', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Shadow/Glow
    ctx.shadowBlur = 30;
    ctx.shadowColor = attackOverlay.color;

    // Draw Text
    ctx.fillStyle = attackOverlay.color;
    ctx.fillText(attackOverlay.text, glitchX, glitchY);

    ctx.restore();
}

function updateAttackOverlay(dt) {
    if (attackOverlay.active) {
        attackOverlay.life -= dt / 1000;
        if (attackOverlay.life <= 0) {
            attackOverlay.active = false;
        }
    }
}

// --- DRAWING FUNCTIONS ---

function drawBoss() {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.scale(1.3 * gameScale, 1.3 * gameScale); // Scaled size

    // Damage flash
    const damageFlash = (boss.maxHealth - boss.health) / boss.maxHealth * 0.3;
    ctx.shadowBlur = 40;
    ctx.shadowColor = `rgba(255, 0, 0, ${damageFlash})`;

    // Main curved hull
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-200, -50);
    ctx.quadraticCurveTo(-250, -30, -280, 20);
    ctx.lineTo(-260, 80);
    ctx.lineTo(-150, 100);
    ctx.lineTo(150, 100);
    ctx.lineTo(260, 80);
    ctx.lineTo(280, 20);
    ctx.quadraticCurveTo(250, -30, 200, -50);
    ctx.lineTo(0, -80);
    ctx.closePath();
    ctx.fill();

    // Massive hull outline
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 10;
    ctx.stroke();

    // --- LARGE REAR THRUSTERS ---
    const time = Date.now() * 0.01;
    const drawThruster = (x, y, width, height) => {
        // Nozzle
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.rect(x - width / 2, y - height, width, height);
        ctx.fill();
        ctx.stroke();

        // Animated Flame
        const flicker = Math.sin(time * 2) * 0.2 + Math.random() * 0.3 + 0.8;
        const flameHeight = height * 2.5 * flicker;

        ctx.save();
        // Inner Core (White/Yellow)
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ffaa00';
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x - width * 0.3, y - height);
        ctx.lineTo(x + width * 0.3, y - height);
        ctx.lineTo(x, y - height - flameHeight * 0.6);
        ctx.fill();

        // Outer Flame (Orange/Red)
        ctx.fillStyle = 'rgba(255, 68, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(x - width * 0.4, y - height);
        ctx.lineTo(x + width * 0.4, y - height);
        ctx.lineTo(x, y - height - flameHeight);
        ctx.fill();
        ctx.restore();
    };

    // Draw 2 Main Thrusters at the back
    drawThruster(-100, -60, 40, 30);
    drawThruster(100, -60, 40, 30);
    // Draw 2 Secondary Thrusters
    drawThruster(-180, -40, 25, 20);
    drawThruster(180, -40, 25, 20);

    // Curved blade section
    ctx.fillStyle = '#0d0d0d';
    ctx.beginPath();
    ctx.moveTo(-120, -50);
    ctx.lineTo(120, -50);
    ctx.lineTo(100, -20);
    ctx.lineTo(-100, -20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Central ram
    ctx.fillStyle = '#330000';
    ctx.beginPath();
    ctx.moveTo(-60, -80);
    ctx.lineTo(60, -80);
    ctx.lineTo(40, -40);
    ctx.lineTo(-40, -40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Side curved armor plates
    ctx.fillStyle = '#2a0000';
    ctx.beginPath();
    ctx.arc(-220, 20, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(220, 20, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Heavy armor segmentation
    ctx.fillStyle = '#330000';
    for (let i = -120; i <= 120; i += 60) {
        ctx.beginPath();
        ctx.ellipse(i, -30, 25, 20, 0, 0, Math.PI * 2);
        ctx.fill();
    }


    // Rocket launcher arrays
    ctx.fillStyle = '#660000';
    const drawLauncher = (x) => {
        const drawPod = (px, py, w, h) => {
            ctx.beginPath();
            ctx.moveTo(px, py);           // Top Left
            ctx.lineTo(px + w, py);       // Top Right
            ctx.lineTo(px + w / 2, py + h); // Bottom Tip
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 3;

        drawPod(x, -40, 40, 25);
        drawPod(x, -8, 40, 25);
        drawPod(x, 25, 40, 25);
        drawPod(x, 58, 40, 25);
    };
    drawLauncher(-290);
    drawLauncher(250);

    // Main engine section (Spikes)
    ctx.fillStyle = '#990000';
    const drawSpike = (x, y, w, h) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w / 2, y + h);
        ctx.closePath();
        ctx.fill();
    };

    // Increased height from 50 to 70 for a sharper look
    drawSpike(-120, 80, 30, 60);
    drawSpike(-70, 80, 30, 60);
    drawSpike(-20, 80, 30, 60);
    drawSpike(30, 80, 30, 60);
    drawSpike(80, 80, 30, 60);

    // Central energy core
    ctx.fillStyle = '#990000';
    ctx.beginPath();
    ctx.ellipse(0, 45, 50, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Core glow effect when charging
    if (bossAttackPhase === 1) {
        const glowIntensity = bossCoreGlow;
        ctx.shadowBlur = 40 * glowIntensity;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = `rgba(255, ${100 - glowIntensity * 100}, 0, ${glowIntensity})`;
        ctx.beginPath();
        ctx.ellipse(0, 45, 50 + glowIntensity * 10, 25 + glowIntensity * 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.ellipse(0, 45, 35, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawScorchMarks() {
    boss.scorchMarks.forEach(mark => {
        ctx.save();
        ctx.translate(boss.x + mark.relX, boss.y + mark.relY);
        ctx.fillStyle = 'rgba(10, 0, 0, 0.9)';
        ctx.beginPath();
        // Scale the radius dynamically
        const scaledRadius = mark.baseRadius * gameScale;
        ctx.arc(0, 0, scaledRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 60, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(100, 20, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(0, 0, scaledRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function updateBossDamageEffects() {
    boss.scorchMarks.forEach(mark => {
        if (!mark.hasSmoke) return;
        const absX = boss.x + mark.relX;
        const absY = boss.y + mark.relY;

        // Increased Smoke
        const scaledRadius = mark.baseRadius * gameScale;
        if (Math.random() < 0.4) {
            particles.push(createParticle(
                absX + (Math.random() - 0.5) * scaledRadius,
                absY + (Math.random() - 0.5) * scaledRadius,
                '#444444', 0.8
            ));
        }
        // Increased Fire
        if (Math.random() < 0.15) {
            particles.push(createParticle(
                absX + (Math.random() - 0.5) * scaledRadius,
                absY + (Math.random() - 0.5) * scaledRadius,
                '#ff4400', 1.5
            ));
        }
    });
}

function drawShip() {
    // Skip drawing if blinking and on "off" phase
    if (shipBlinking && Math.floor(shipBlinkTime / 100) % 2 === 0) {
        return; // Don't draw ship during blink "off" frames
    }

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.tilt); // Apply tilt rotation
    const scale = 1.5 * gameScale; // Scaled

    if (laserCharging) {
        const glowIntensity = laserChargeTime / LASER_CHARGE_DURATION;
        ctx.shadowBlur = 40 * glowIntensity;
        ctx.shadowColor = isComboMode ? '#8b0000' : '#ff00ff';
    }

    ctx.fillStyle = '#0d2818';
    ctx.fillRect(-15 * scale, -30 * scale, 30 * scale, 70 * scale);

    // Darker colors when charging in combo mode
    const chargeColor = isComboMode ? '#8b0000' : '#ff00ff';
    ctx.fillStyle = laserCharging ? chargeColor : '#00ff88';
    ctx.shadowBlur = 15;
    ctx.shadowColor = laserCharging ? chargeColor : '#00ff88';
    ctx.beginPath();
    ctx.moveTo(0, -45 * scale);
    ctx.lineTo(-12 * scale, -30 * scale);
    ctx.lineTo(12 * scale, -30 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#003311';
    ctx.fillRect(-8 * scale, -25 * scale, 16 * scale, 15 * scale);

    ctx.fillStyle = '#1a4d2e';
    ctx.beginPath();
    ctx.moveTo(-15 * scale, -15 * scale);
    ctx.lineTo(-55 * scale, 15 * scale);
    ctx.lineTo(-55 * scale, 30 * scale);
    ctx.lineTo(-15 * scale, 25 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(15 * scale, -15 * scale);
    ctx.lineTo(55 * scale, 15 * scale);
    ctx.lineTo(55 * scale, 30 * scale);
    ctx.lineTo(15 * scale, 25 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0d2818';
    ctx.fillRect(-50 * scale, 15 * scale, 30 * scale, 10 * scale);
    ctx.fillRect(20 * scale, 15 * scale, 30 * scale, 10 * scale);

    if (laserCharging || laserFiring) {
        const chargeGlow = laserCharging ? laserChargeTime / LASER_CHARGE_DURATION : 1;
        // Darker colors in combo mode
        if (isComboMode) {
            ctx.fillStyle = `rgba(139, 0, 0, ${chargeGlow})`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#8b0000';
        } else {
            ctx.fillStyle = `rgba(255, 0, 255, ${chargeGlow})`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff00ff';
        }
    } else {
        ctx.fillStyle = '#00ff88';
    }
    ctx.fillRect(-58 * scale, 15 * scale, 8 * scale, 20 * scale);
    ctx.fillRect(50 * scale, 15 * scale, 8 * scale, 20 * scale);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff4444';
    ctx.fillRect(-45 * scale, 5 * scale, 6 * scale, 8 * scale);
    ctx.fillRect(39 * scale, 5 * scale, 6 * scale, 8 * scale);

    ctx.fillStyle = '#2d7a4f';
    ctx.fillRect(-5 * scale, -20 * scale, 10 * scale, 50 * scale);

    ctx.fillStyle = '#00ccff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ccff';
    ctx.fillRect(-12 * scale, 40 * scale, 8 * scale, 12 * scale);
    ctx.fillRect(4 * scale, 40 * scale, 8 * scale, 12 * scale);

    ctx.fillRect(-25 * scale, 35 * scale, 6 * scale, 10 * scale);
    ctx.fillRect(19 * scale, 35 * scale, 6 * scale, 10 * scale);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-15 * scale, 0);
    ctx.lineTo(15 * scale, 0);
    ctx.stroke();

    ctx.fillStyle = '#003311';
    ctx.fillRect(-15 * scale, 10 * scale, 8 * scale, 15 * scale);
    ctx.fillRect(7 * scale, 10 * scale, 8 * scale, 15 * scale);

    ctx.restore();
}

function drawShield() {
    if (!shieldActive) return;
    ctx.save();
    const remainingPct = 1 - (shieldDuration / SHIELD_DURATION);
    ctx.strokeStyle = `rgba(77, 171, 247, ${remainingPct})`;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#4dabf7';
    ctx.beginPath();
    ctx.ellipse(ship.x, ship.y, 140, 140, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(77, 171, 247, ${remainingPct * 0.6})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(ship.x, ship.y, 150, 150, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawRockets() {
    rockets.forEach(rocket => {
        ctx.save();
        ctx.translate(rocket.x, rocket.y);
        ctx.rotate(rocket.angle);
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff4444';
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-6, -35, 12, 60);
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(-6, -35);
        ctx.lineTo(0, -50);
        ctx.lineTo(6, -35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(-6, -15, 12, 3);
        ctx.fillRect(-6, 5, 12, 3);
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(-5, 25, 10, 8);
        const flameHeight = 18 + Math.sin(Date.now() * 0.01) * 6;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(-5, 33);
        ctx.lineTo(-12, 33 + flameHeight);
        ctx.lineTo(12, 33 + flameHeight);
        ctx.lineTo(5, 33);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-3, 33);
        ctx.lineTo(-8, 33 + flameHeight * 0.7);
        ctx.lineTo(8, 33 + flameHeight * 0.7);
        ctx.lineTo(3, 33);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        for (let i = 0; i < 2; i++) {
            particles.push(createParticle(rocket.x, rocket.y + 35, '#ffaa00', 1));
        }
    });
}



function drawPlasmaWaves() {
    plasmaWaves.forEach(wave => {
        ctx.save();
        ctx.globalAlpha = wave.alpha;
        // Darker colors in combo mode
        ctx.strokeStyle = isComboMode ? '#8b0000' : '#ffaa00';
        ctx.lineWidth = 5;
        ctx.shadowBlur = 20;
        ctx.shadowColor = isComboMode ? '#8b0000' : '#ffaa00';
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, wave.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });
}

function drawLaser() {
    if (!laserFiring) return;
    const leftWingX = ship.x - 54 * 1.5; // Updated scale
    const rightWingX = ship.x + 54 * 1.5;
    const wingY = ship.y + 25 * 1.5;
    const targetY = boss.y + 40; // Hit center/bottom of boss

    ctx.save();

    // Beam Gradient - Different colors for combo mode
    const gradient = ctx.createLinearGradient(0, wingY, 0, targetY);
    if (isComboMode) {
        // Darker, harsher colors for combo
        gradient.addColorStop(0, 'rgba(139, 0, 0, 0.9)');      // Dark red
        gradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.8)');    // Blood red
        gradient.addColorStop(1, 'rgba(80, 0, 0, 1)');         // Very dark red/black
    } else {
        // Normal colors
        gradient.addColorStop(0, 'rgba(255, 0, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 0, 255, 0.9)');
    }

    ctx.fillStyle = gradient;
    ctx.shadowBlur = isComboMode ? 40 : 30;
    ctx.shadowColor = isComboMode ? '#8b0000' : '#ff00ff';

    // Draw Beams stopping at targetY
    ctx.fillRect(leftWingX - 8, targetY, 16, wingY - targetY);
    ctx.fillRect(rightWingX - 8, targetY, 16, wingY - targetY);

    // Core beam
    if (isComboMode) {
        ctx.fillStyle = 'rgba(139, 0, 0, 0.95)'; // Dark red core
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // White core
    }
    ctx.fillRect(leftWingX - 3, targetY, 6, wingY - targetY);
    ctx.fillRect(rightWingX - 3, targetY, 6, wingY - targetY);

    // Impact Flares
    ctx.fillStyle = isComboMode ? '#8b0000' : '#ffffff';
    ctx.beginPath();
    ctx.arc(leftWingX, targetY, 20 + Math.random() * 10, 0, Math.PI * 2);
    ctx.arc(rightWingX, targetY, 20 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();

    // Impact Glow
    ctx.shadowBlur = 50;
    ctx.fillStyle = isComboMode ? '#ff0000' : '#ff00ff';
    ctx.beginPath();
    ctx.arc(leftWingX, targetY, 30, 0, Math.PI * 2);
    ctx.arc(rightWingX, targetY, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawEnergyParticles() {
    energyParticles.forEach(p => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawEngineTrails() {
    engineTrails.forEach(trail => {
        ctx.save();
        // Rotate trails around ship center if they are fresh
        // For simplicity, we just draw them at their world position
        // A more complex system would rotate their spawn point
        ctx.globalAlpha = trail.life;
        ctx.fillStyle = trail.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = trail.color;
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawStars() {
    ctx.fillStyle = '#ffffff';
    stars.forEach(star => {
        ctx.save();
        ctx.globalAlpha = star.alpha || 1;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

// --- UPDATE FUNCTIONS ---

function updateRockets() {
    rockets = rockets.filter(rocket => {
        // Homing Logic
        if (rocket.target) {
            const dx = rocket.target.x - rocket.x;
            const dy = rocket.target.y - rocket.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Steer towards target
            const targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
            // Simple easing for rotation
            let angleDiff = targetAngle - rocket.angle;
            // Normalize angle
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            rocket.angle += angleDiff * 0.1; // Turn speed

            // Acceleration
            if (rocket.speed < rocket.maxSpeed) {
                rocket.speed += rocket.acceleration;
            }
        }

        rocket.x += Math.sin(rocket.angle) * rocket.speed;
        rocket.y -= Math.cos(rocket.angle) * rocket.speed;
        return rocket.y > -100 && rocket.x > -100 && rocket.x < canvas.width + 100;
    });
}



function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        return p.life > 0;
    });
}

function updateEngineTrails() {
    engineTrails = engineTrails.filter(trail => {
        trail.y += trail.speed;
        trail.life -= 0.03;
        return trail.life > 0;
    });
}

function updateEnergyParticles() {
    energyParticles = energyParticles.filter(p => {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) return false;
        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;
        return true;
    });
}

function updatePlasmaWaves() {
    plasmaWaves = plasmaWaves.filter(wave => {
        wave.radius += wave.speed;
        wave.alpha -= 0.02;
        return wave.alpha > 0;
    });
}

function updateStars() {
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
        }
    });
}

function addEngineTrails() {
    const scale = 1.5;

    // Helper to rotate point around ship center
    const rotatePoint = (x, y) => {
        const cos = Math.cos(ship.tilt);
        const sin = Math.sin(ship.tilt);
        return {
            x: ship.x + x * cos - y * sin,
            y: ship.y + x * sin + y * cos
        };
    };

    // Engine offsets relative to ship center (unrotated)
    const offsets = [
        { x: -8 * scale, y: 46 * scale, color: '#00ccff', r: 2 },
        { x: 8 * scale, y: 46 * scale, color: '#00ccff', r: 2 },
        { x: -22 * scale, y: 40 * scale, color: '#00aacc', r: 1.5 },
        { x: 22 * scale, y: 40 * scale, color: '#00aacc', r: 1.5 }
    ];

    offsets.forEach(off => {
        const p = rotatePoint(off.x, off.y);
        engineTrails.push({
            x: p.x + (Math.random() - 0.5) * 4,
            y: p.y + (Math.random() - 0.5) * 4,
            radius: Math.random() * off.r + 1,
            life: 1,
            speed: 2,
            color: off.color
        });
    });
}

function applyScreenShake() {
    if (shakeAmount > 0) {
        const offsetX = (Math.random() - 0.5) * shakeAmount;
        const offsetY = (Math.random() - 0.5) * shakeAmount;
        canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        shakeAmount *= shakeDecay;
        if (shakeAmount < 0.5) {
            shakeAmount = 0;
            canvas.style.transform = 'translate(0, 0)';
        }
    }
}

// --- ACTION TRIGGERS ---

function fireLaser() {
    laserActive = true;
    laserCharging = true;
    laserChargeTime = 0;
    sounds.heroCharge(); // Play charging sound
    // sounds.laser(); // Removed single shot, now using continuous beam
    for (let i = 0; i < 20; i++) {
        energyParticles.push(createEnergyParticle(ship.x, ship.y - 30));
    }
}

function fireRockets() {
    // Define hardpoints on the boss (relative to center)
    const hardpoints = [
        { x: -200, y: 20 }, { x: 200, y: 20 }, // Wings
        { x: -80, y: 80 }, { x: 80, y: 80 },   // Engines
        { x: 0, y: 0 },                      // Core
        { x: -290, y: 0 }, { x: 250, y: 0 }    // Launchers
    ];

    // Pick random targets - more rockets in combo mode
    const rocketCount = isComboMode ? 12 : 6; // Double rockets in combo
    const selectedTargets = [];
    for (let i = 0; i < rocketCount; i++) {
        const pt = hardpoints[Math.floor(Math.random() * hardpoints.length)];
        // Add some randomness to the exact spot
        const targetX = boss.x + (pt.x * gameScale) + (Math.random() - 0.5) * 40;
        const targetY = boss.y + (pt.y * gameScale) + (Math.random() - 0.5) * 40;

        selectedTargets.push({ x: targetX, y: targetY });
    }

    // Fire Rockets Sequence
    const rocketConfig = { speed: 4, acceleration: 0.6, maxSpeed: 18 }; // Slightly slower accel

    selectedTargets.forEach((target, i) => {
        setTimeout(() => {
            const isLeft = i % 2 === 0;
            const xOffset = isLeft ? -90 : 90;
            // Initial angle flares out slightly
            const startAngle = isLeft ? -0.5 : 0.5;

            sounds.rocket();

            rockets.push({
                x: ship.x + xOffset,
                y: ship.y + 10,
                angle: startAngle,
                target: target, // Assign target
                ...rocketConfig
            });
        }, i * 200 + 800); // Increased delay: 800ms start delay, 200ms between shots
    });
}

function plasmaBurst() {
    if (plasmaBurstActive) return;
    plasmaBurstActive = true;
    plasmaBurstTime = 0;
    shakeAmount = 12;
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            plasmaWaves.push({
                radius: 50,
                speed: 8,
                alpha: 0.8
            });
        }, i * 200);
    }
}

function activateShield() {
    shieldActive = true;
    shieldDuration = 0;
}

function checkCollisions() {
    // Visual Only Collisions

    // Rockets
    rockets.forEach((rocket, idx) => {
        // Check distance to target if it exists
        let hit = false;
        if (rocket.target) {
            const dx = rocket.x - rocket.target.x;
            const dy = rocket.y - rocket.target.y;
            if (Math.sqrt(dx * dx + dy * dy) < 30) {
                hit = true;
            }
        } else {
            // Fallback to hitbox
            const dx = rocket.x - boss.x;
            const dy = rocket.y - boss.y;
            if (Math.abs(dx) < 390 * gameScale && Math.abs(dy) < 160 * gameScale) hit = true;
        }

        if (hit) {
            // Remove rocket visually
            rockets.splice(idx, 1);

            // Add visual damage
            boss.scorchMarks.push({
                relX: (rocket.x - boss.x) / 1.3, // Adjust for scale
                relY: (rocket.y - boss.y) / 1.3,
                baseRadius: Math.random() * 15 + 20, // Store BASE radius, not scaled
                hasSmoke: Math.random() < 0.2
            });

            // Explosion particles
            shakeAmount = 20;
            sounds.explosion();
            for (let i = 0; i < 30; i++) {
                particles.push(createParticle(rocket.x, rocket.y, '#ff4400', 4));
                particles.push(createParticle(rocket.x, rocket.y, '#ffff00', 3));
            }
        }
    });

    // Laser
    if (laserFiring) {
        const leftWingX = ship.x - 54 * 1.5 * gameScale;
        const rightWingX = ship.x + 54 * 1.5 * gameScale;
        const targetY = boss.y + 40 * gameScale;

        // Increased hitbox for bigger boss
        if (Math.abs(boss.x - leftWingX) < 325 * gameScale || Math.abs(boss.x - rightWingX) < 325 * gameScale) {
            // Intense Impact Particles
            for (let i = 0; i < 8; i++) {
                // Sparks - darker colors in combo mode
                particles.push(createParticle(
                    (Math.random() > 0.5 ? leftWingX : rightWingX) + (Math.random() - 0.5) * 20,
                    targetY + (Math.random() - 0.5) * 20,
                    isComboMode ? '#8b0000' : '#ff00ff',
                    4
                ));
            }

            // Smoke at impact - darker in combo mode
            if (Math.random() < 0.5) {
                particles.push(createParticle(
                    (Math.random() > 0.5 ? leftWingX : rightWingX),
                    targetY,
                    isComboMode ? '#4a0000' : '#ffffff',
                    2
                ));
            }

            if (Math.random() < 0.2) {
                boss.scorchMarks.push({
                    relX: ((Math.random() > 0.5 ? leftWingX : rightWingX) - boss.x) / 1.3 + (Math.random() - 0.5) * 20,
                    relY: (40 + (Math.random() - 0.5) * 30) / 1.3,
                    baseRadius: Math.random() * 8 + 4, // Store BASE radius
                    hasSmoke: Math.random() < 0.1
                });
            }
        }
    }
}

function updateCombatLogic(deltaTime) {
    // Laser Logic
    if (laserCharging) {
        laserChargeTime += deltaTime;
        if (laserChargeTime >= LASER_CHARGE_DURATION) {
            laserCharging = false;
            laserFiring = true;
            laserFireTime = 0;
            shakeAmount = 8;
            sounds.startLaserBeam(); // Start continuous sound
        }
    }
    if (laserFiring) {
        laserFireTime += deltaTime;
        shakeAmount = 15;
        if (laserFireTime >= LASER_FIRE_DURATION) {
            laserFiring = false;
            laserActive = false;
            sounds.stopLaserBeam(); // Stop continuous sound
        }
    }

    // Shield Logic
    if (shieldActive) {
        shieldDuration += deltaTime;
        if (shieldDuration >= SHIELD_DURATION) {
            shieldActive = false;
        }
    }

    // Plasma Logic
    if (plasmaBurstActive) {
        plasmaBurstTime += deltaTime;
        if (plasmaBurstTime >= PLASMA_BURST_DURATION) {
            plasmaBurstActive = false;
        }
    }

    // Boss Attack Charging Logic
    if (bossAttackPhase === 1) {
        bossChargeTime += deltaTime;
        bossCoreGlow = Math.min(1, bossChargeTime / BOSS_CHARGE_DURATION);
    }

    // Ship Blink Logic
    if (shipBlinking) {
        shipBlinkTime += deltaTime;
        if (shipBlinkTime >= SHIP_BLINK_DURATION) {
            shipBlinking = false;
            shipBlinkTime = 0;
        }
    }
}

// --- MAIN LOOP ---
let lastTime = Date.now();

function gameLoop() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Physics Update
    // Apply Friction
    ship.vx *= ship.friction;
    ship.vy *= ship.friction;

    // Update Position
    ship.x += ship.vx;
    ship.y += ship.vy;

    // Boundary Checks
    if (ship.x < 50) { ship.x = 50; ship.vx = 0; }
    if (ship.x > canvas.width - 50) { ship.x = canvas.width - 50; ship.vx = 0; }
    if (ship.y < 50) { ship.y = 50; ship.vy = 0; }
    if (ship.y > canvas.height - 50) { ship.y = canvas.height - 50; ship.vy = 0; }

    // Calculate Tilt based on X velocity
    const targetTilt = ship.vx * 0.05; // Max tilt
    ship.tilt = ship.tilt * 0.9 + targetTilt * 0.1; // Smooth transition

    // Background Parallax
    // Stars move faster when ship moves down (flying up), slower when ship moves up
    // Also slight horizontal parallax
    stars.forEach(star => {
        star.y += star.speed + (ship.vy > 0 ? -0.5 : 0.5) * star.layer * 0.5;
        star.x -= ship.vx * star.layer * 0.05;

        // Wrap around
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
        if (star.y < 0) {
            star.y = canvas.height;
            star.x = Math.random() * canvas.width;
        }
        if (star.x > canvas.width) star.x = 0;
        if (star.x < 0) star.x = canvas.width;
    });

    // Update Background Elements
    updateNebulae();
    updateAsteroids();

    // --- DRAWING ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background Layers
    drawNebulae();
    drawStars();
    drawAsteroids();

    // Boss
    drawBoss();
    drawScorchMarks();
    updateBossDamageEffects();

    // Hero
    drawEngineTrails();
    updateEngineTrails();
    drawShip();
    drawShield();
    addEngineTrails();

    // Projectiles
    drawRockets();
    updateRockets();
    drawLaser();
    drawPlasmaWaves();
    updatePlasmaWaves();

    // Effects
    drawParticles();
    updateParticles();
    drawEnergyParticles();
    drawEnergyParticles();
    updateEnergyParticles();
    drawAttackOverlay();

    // Logic
    checkCollisions(); // Visual collisions
    updateCombatLogic(deltaTime);
    updateAttackOverlay(deltaTime);
    applyScreenShake();

    // Movement Input (Physics)


    requestAnimationFrame(gameLoop);
}

// --- BACKGROUND OBJECTS FUNCTIONS ---

function createAsteroid(randomY = false) {
    const size = Math.random() * 40 + 20;
    const vertices = [];
    const numVertices = Math.floor(Math.random() * 5) + 7;
    for (let i = 0; i < numVertices; i++) {
        const angle = (i / numVertices) * Math.PI * 2;
        const r = size * (0.7 + Math.random() * 0.6); // Jaggedness
        vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    return {
        x: Math.random() * canvas.width,
        y: randomY ? Math.random() * canvas.height : -100,
        vx: (Math.random() - 0.5) * 0.5,
        vy: Math.random() * 1.5 + 0.5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        vertices: vertices,
        color: Math.random() > 0.5 ? '#555' : '#666',
        size: size
    };
}

function updateAsteroids() {
    asteroids.forEach(a => {
        a.x += a.vx;
        a.y += a.vy;
        a.rotation += a.rotationSpeed;

        // Wrap or Respawn
        if (a.y > canvas.height + 100) {
            Object.assign(a, createAsteroid(false)); // Reset as new asteroid
        }
        if (a.x > canvas.width + 100) a.x = -100;
        if (a.x < -100) a.x = canvas.width + 100;
    });
}

function drawAsteroids() {
    asteroids.forEach(a => {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);

        ctx.fillStyle = '#222';
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(a.vertices[0].x, a.vertices[0].y);
        a.vertices.forEach(v => ctx.lineTo(v.x, v.y));
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        // Add some "crater" detail (simple dots)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(a.size * 0.3, a.size * 0.2, a.size * 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

function createNebula() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 300 + 200,
        color: Math.random() > 0.5 ? 'rgba(100, 0, 255, 0.05)' : 'rgba(0, 100, 255, 0.05)',
        vx: (Math.random() - 0.5) * 0.2,
        vy: 0.1
    };
}

function updateNebulae() {
    nebulae.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.y > canvas.height + n.radius) {
            n.y = -n.radius;
            n.x = Math.random() * canvas.width;
        }
    });
}

function drawNebulae() {
    nebulae.forEach(n => {
        ctx.save();
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
        grad.addColorStop(0, n.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill screen with gradient blend
        ctx.restore();
    });
}

// Input Handling
const keys = {};
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);

// Start
// Start
initQuiz();
// Start music on first user interaction (browser policy) or immediately if allowed
window.addEventListener('click', () => {
    sounds.playBgMusic();
    // Initialize voices (some browsers need a click to load voice list)
    window.speechSynthesis.getVoices();
}, { once: true });
gameLoop();
