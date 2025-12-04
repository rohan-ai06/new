
// --- ATTACK OVERLAY SYSTEM ---
let attackOverlay = {
    active: false,
    text: "",
    color: "#fff",
    life: 0,
    scale: 1
};

function showAttackName(type) {
    const info = attackNames[type];
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
    const centerY = canvas.height / 2 - 100;

    // Animation Math
    if (attackOverlay.scale < 1.2) {
        attackOverlay.scale += 0.1; // Zoom in fast
    }

    ctx.translate(centerX, centerY);
    ctx.scale(attackOverlay.scale, attackOverlay.scale);

    // Glitch Offset
    const glitchX = (Math.random() - 0.5) * 10;
    const glitchY = (Math.random() - 0.5) * 5;

    ctx.font = "bold 60px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Shadow/Glow
    ctx.shadowBlur = 30;
    ctx.shadowColor = attackOverlay.color;

    // Draw Text
    ctx.fillStyle = attackOverlay.color;
    ctx.fillText(attackOverlay.text, glitchX, glitchY);

    // Subtext
    ctx.font = "20px 'Rajdhani', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.letterSpacing = "5px";
    ctx.fillText(">>> SYSTEM OVERRIDE ENGAGED <<<", 0, 50);

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
