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

function waveText() {
  const el = document.querySelectorAll(".wave-text, .wave-text-in");
  el.forEach((ele, index) => {
    const elText = ele.textContent;
    const elChars = elText.split("");
    ele.innerHTML = `<b>${elChars.join("</b><b>")}</b>`.replaceAll(
      "<b> </b>",
      " ",
    );
  });
}

waveText();

const drawPaths = document.querySelectorAll(
  ".draw-stroke, .draw-stroke-on-enter",
);

drawPaths.forEach((path) => {
  const length = path.getTotalLength();
  // Set the CSS variable --path-length on the individual element
  path.style.setProperty("--path-length", length);
});

const since99 = document.querySelectorAll(".since99");

since99.forEach((span) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const since = currentYear - 1999;

  span.innerText = since;
});

const glCanvas = document.getElementById("goo-background");
const gl = glCanvas.getContext("webgl");

// --- VERTEX SHADER ---
// This simply tells the GPU to draw a flat rectangle across the entire screen
const vsSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// --- FRAGMENT SHADER (THE MAGIC) ---
// This calculates the color of every single pixel on the screen 60 times a second
const fsSource = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;

  // The "Smooth Minimum" function - This replaces the SVG Goo Filter!
  // It calculates the mathematical intersection of two circles and bridges them.
  float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
  }

  void main() {
      // Normalize pixel coordinates (from 0 to 1) and correct aspect ratio
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 st = uv;
      st.x *= u_resolution.x / u_resolution.y;

      float dist = 100.0; // Start with a huge distance

      // Grid definition: 4 columns, 3 rows
      float cols = 4.0;
      float rows = 3.0;

      // Loop to create the 4x3 grid (12 groups total)
      for(float i = 0.0; i < 4.0; i++) {
          for(float j = 0.0; j < 3.0; j++) {
              
              // Center of current grid cell
              vec2 center = vec2((i + 0.5) / cols, (j + 0.5) / rows);
              center.x *= u_resolution.x / u_resolution.y; 

              // Create a unique mathematical seed based on grid position
              float seed = i * 12.3 + j * 45.6;

              // Group rotation (Different speeds and directions based on seed)
              float speed = 0.2 + mod(seed, 0.5);
              float direction = mod(i + j, 2.0) == 0.0 ? 1.0 : -1.0;
              float groupRotation = u_time * speed * direction;

              // Create the 3 circles inside this specific group
              for(float k = 0.0; k < 3.0; k++) {
                  
                  // Space the 3 circles evenly around the center (120 degrees apart)
                  float angle = (k / 3.0) * 6.28318 + groupRotation;
                  
                  // Calculate bobbing distance from the center point
                  float bob = sin(u_time * (1.0 + mod(seed + k, 1.0))) * 0.04 + 0.05;
                  
                  // Calculate exact position of this circle
                  vec2 pos = center + vec2(cos(angle), sin(angle)) * bob;
                  
                  // Distance from the current pixel to this circle
                  float circleRadius = 0.035;
                  float circleDist = length(st - pos) - circleRadius;

                  // THE GOO MATH: Smoothly combine this circle with the others
                  // 0.08 is the "Gooey Factor" - increase it for more melting!
                  dist = smin(dist, circleDist, 0.08); 
              }
          }
      }

      // --- COLOR MIXING ---
      // Anti-aliased edge detection (Is this pixel inside or outside the goo?)
      float alpha = smoothstep(0.001, -0.001, dist);
      
      // Gradient based on depth: Dark Blue -> Light Blue -> White Core
      vec3 blobColor = mix(vec3(0.0), vec3(0.16, 0.32, 0.75), alpha); 
      blobColor = mix(blobColor, vec3(0.29, 0.56, 0.89), smoothstep(-0.01, -0.03, dist));
      blobColor = mix(blobColor, vec3(1.0, 1.0, 1.0), smoothstep(-0.03, -0.06, dist)); 

      // Deep night background color
      vec3 bgColor = vec3(0.02, 0.02, 0.03);
      
      // Final pixel output
      vec3 finalColor = mix(bgColor, blobColor, alpha);
      gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// --- WEBGL COMPILATION & SETUP ---
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

// Create a full-screen rectangle to draw the shader onto
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
  ]),
  gl.STATIC_DRAW,
);

const positionLocation = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

// Get variable locations
const timeLocation = gl.getUniformLocation(program, "u_time");
const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

// Handle Resizing
function resize() {
  glCanvas.width = window.innerWidth;
  glCanvas.height = window.innerHeight;
  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  gl.uniform2f(resolutionLocation, glCanvas.width, glCanvas.height);
}
window.addEventListener("resize", resize);
resize();

// --- ANIMATION LOOP ---
function render(time) {
  time *= 0.001; // Convert to seconds
  gl.uniform1f(timeLocation, time);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
