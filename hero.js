const POINT_COUNT = 8;
const RADIUS = 240;
const SPRING = 0.16;
const FRICTION = 0.69;
const WANDER_SPEED = 0.075;
const IDLE_TIMEOUT = 1000;
const SCALE_FACTOR = 0;

// NEW: Gelatinous Settings
const JITTER_SPEED = 0.006; // How fast the blob undulates
const JITTER_RANGE = 60; // Max distance sub-points move from center
// -----------------------

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastMouseTime = Date.now();
let isIdle = true;
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
    // Each point has its own sub-points for the "gelatinous" look
    // Point 0 gets POINT_COUNT sub-points, Point 1 gets POINT_COUNT-1, etc.
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
    if (baseRadius <= 0) return;

    // Draw the cluster of sub-points
    for (let i = 0; i < this.subPointCount; i++) {
      // Create organic movement using Sine/Cosine and the unique seed
      const offsetX =
        Math.cos(time * JITTER_SPEED + this.seeds[i]) * JITTER_RANGE;
      const offsetY =
        Math.sin(time * JITTER_SPEED * 1.1 + this.seeds[i]) * JITTER_RANGE;

      context.beginPath();
      // We divide the radius slightly so the cluster feels like one mass
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

const imgBack = new Image();
const imgFront = new Image();
imgBack.crossOrigin = imgFront.crossOrigin = "anonymous";
imgBack.src = "./hero-back.png";
imgFront.src = "./hero-front.png";

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
    y = (h - rh) / 2;
  } else {
    rw = h * imgRatio;
    rh = h;
    x = (w - rw) / 2;
    y = 0;
  }
  context.drawImage(img, x, y, rw, rh);
}

function animate(time) {
  updateWander();

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
    if (SCALE_FACTOR === 0) {
      r = RADIUS * (1 - i / (POINT_COUNT - 1));
    } else {
      r = RADIUS / Math.pow(SCALE_FACTOR, i);
    }
    // Call the new internal draw method for the cluster
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
  drawImageCover(ctx, imgBack);
  ctx.drawImage(maskCanvas, 0, 0);

  requestAnimationFrame(animate);
}

animate(0);
