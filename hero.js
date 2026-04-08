const POINT_COUNT = 8;
const RADIUS = 180;
const SPRING = 0.16;
const FRICTION = 0.69;
const WANDER_SPEED = 0.075;
const IDLE_TIMEOUT = 500;
const DECAY_TIME = 250;
const REMIND_TIME = 1000;
const REMIND_DURATION = 3000;
const SCALE_FACTOR = 1.133;

const JITTER_SPEED = 0.001;
const JITTER_RANGE = 60;

const canvas = document.getElementById("hero-canvas");
const ctx = canvas.getContext("2d");

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastMouseTime = Date.now();
let isIdle = true;
let blobScale = 1; // Multiplier for the radius (0 to 1)

let wanderTarget = {
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
};

class Point {
  constructor(index) {
    this.x = mouse.x;
    this.y = mouse.y;
    this.vx = 0;
    this.vy = 0;
    this.index = index;
    this.subPointCount = Math.max(1, POINT_COUNT - index);
    this.seeds = Array.from(
      { length: this.subPointCount },
      () => Math.random() * 100,
    );
  }

  update(targetX, targetY) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    this.vx += dx * SPRING;
    this.vy += dy * SPRING;
    this.vx *= FRICTION;
    this.vy *= FRICTION;
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(context, baseRadius, time) {
    if (baseRadius <= 1) return; // Don't draw if effectively invisible

    for (let i = 0; i < this.subPointCount; i++) {
      const offsetX =
        Math.cos(time * JITTER_SPEED + this.seeds[i]) * JITTER_RANGE;
      const offsetY =
        Math.sin(time * JITTER_SPEED * 1.1 + this.seeds[i]) * JITTER_RANGE;

      context.beginPath();
      context.arc(
        this.x + offsetX,
        this.y + offsetY,
        baseRadius * 0.8,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
}

const points = Array.from({ length: POINT_COUNT }, (_, i) => new Point(i));

const blobCanvas = document.createElement("canvas");
const blobCtx = blobCanvas.getContext("2d");
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");

const imgFront = new Image();
imgFront.crossOrigin = "anonymous";
imgFront.src =
  "https://raw.githubusercontent.com/michaelmonetized/michaelmonetized/master/landscape-wireframe.jpg";

const handleResize = () => {
  canvas.width = blobCanvas.width = maskCanvas.width = window.innerWidth;
  canvas.height = blobCanvas.height = maskCanvas.height = window.innerHeight;
};

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  lastMouseTime = Date.now();
  isIdle = false;
});

window.addEventListener("resize", handleResize);
handleResize();

function updateWander() {
  if (Date.now() - lastMouseTime > IDLE_TIMEOUT) isIdle = true;
  if (isIdle) {
    const dist = Math.hypot(wanderTarget.x - mouse.x, wanderTarget.y - mouse.y);
    if (dist < 100) {
      wanderTarget.x = Math.random() * window.innerWidth;
      wanderTarget.y = Math.random() * window.innerHeight;
    }
    mouse.x = lerp(mouse.x, wanderTarget.x, WANDER_SPEED);
    mouse.y = lerp(mouse.y, wanderTarget.y, WANDER_SPEED);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawImageCover(context, img) {
  if (!img.complete || img.naturalWidth === 0) return;
  const w = context.canvas.width;
  const h = context.canvas.height;
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let rw, rh, x, y;

  if (canvasRatio > imgRatio) {
    rw = w;
    rh = w / imgRatio;
    x = 0;
    y = h - rh;
  } else {
    rw = h * imgRatio;
    rh = h;
    x = 0;
    y = 0;
  }
  context.drawImage(img, x, y, rw, rh);
}

function animate(time) {
  updateWander();

  // --- Visibility Logic ---
  const idleTime = Date.now() - lastMouseTime;
  let targetScale = 1;

  if (isIdle) {
    if (idleTime > DECAY_TIME) {
      targetScale = 0; // Start decaying
    }

    // Reminder Logic
    const reminderStart = DECAY_TIME + REMIND_TIME;
    const reminderEnd = reminderStart + REMIND_DURATION;

    if (idleTime > reminderStart && idleTime < reminderEnd) {
      targetScale = 1; // Reappear
    }
  }

  // Smoothly transition scale for a "breath" effect
  blobScale = lerp(blobScale, targetScale, 0.05);

  // 1. Update Physics
  points[0].update(mouse.x, mouse.y);
  for (let i = 1; i < points.length; i++) {
    points[i].update(points[i - 1].x, points[i - 1].y);
  }

  // 2. Draw the Gelatinous Blobs
  blobCtx.clearRect(0, 0, blobCanvas.width, blobCanvas.height);
  blobCtx.fillStyle = "white";

  points.forEach((p, i) => {
    let r;
    // Apply the global blobScale to the radius calculation
    const currentMaxRadius = RADIUS * blobScale;

    if (SCALE_FACTOR === 0) {
      r = currentMaxRadius * (1 - i / (POINT_COUNT - 1));
    } else {
      r = currentMaxRadius / Math.pow(SCALE_FACTOR, i);
    }
    p.draw(blobCtx, r, time);
  });

  // 3. Masking
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskCtx.filter = "url(#gooey)";
  maskCtx.drawImage(blobCanvas, 0, 0);
  maskCtx.filter = "none";
  maskCtx.globalCompositeOperation = "source-in";
  drawImageCover(maskCtx, imgFront);
  maskCtx.globalCompositeOperation = "source-over";

  // 4. Final Composition
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(maskCanvas, 0, 0);

  requestAnimationFrame(animate);
}

animate(0);
