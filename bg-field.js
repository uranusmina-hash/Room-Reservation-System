// Futuristic "neural network" background: two depth layers of drifting
// nodes, connected by proximity lines, with a subtle cursor parallax.
// Pure canvas, no dependencies. Respects prefers-reduced-motion and
// pauses when the tab isn't visible.
(function () {
    var canvas = document.querySelector(".bg-field");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var W = 0, H = 0, DPR = 1;
    var far = [], near = [];
    var mouseX = 0.5, mouseY = 0.5, px = 0, py = 0;
    var running = true;
    var rafId = null;

    function isLight() {
        return document.documentElement.getAttribute("data-theme") === "light";
    }

    function palette() {
        return isLight()
            ? { a: "232,164,0", b: "27,58,107", lineMax: 0.16, dotNear: 0.6, dotFar: 0.32 }
            : { a: "245,179,1", b: "74,111,165", lineMax: 0.3, dotNear: 0.85, dotFar: 0.5 };
    }

    function makeLayer(count, speed, minR, maxR) {
        var arr = [];
        for (var i = 0; i < count; i++) {
            arr.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * speed,
                vy: (Math.random() - 0.5) * speed,
                r: minR + Math.random() * (maxR - minR)
            });
        }
        return arr;
    }

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        var area = W * H;
        far = makeLayer(Math.min(70, Math.round(area / 24000)), 0.1, 0.9, 1.7);
        near = makeLayer(Math.min(34, Math.round(area / 52000)), 0.22, 1.5, 2.6);
    }

    function step(particles) {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -30) p.x = W + 30; else if (p.x > W + 30) p.x = -30;
            if (p.y < -30) p.y = H + 30; else if (p.y > H + 30) p.y = -30;
        }
    }

    // Bucket lines by opacity band so we can draw each band as ONE path
    // (one stroke() call) instead of one stroke() call per line. This is
    // the main cost cut: thousands of individual draw calls per frame
    // becomes a handful, which is what was stalling the main thread and
    // delaying keystrokes.
    var BUCKETS = 6;

    function linkLayer(particles, maxDist, rgb, alphaMax) {
        var buckets = null; // lazily created, one Path2D per opacity band
        var maxDistSq = maxDist * maxDist;

        for (var i = 0; i < particles.length; i++) {
            for (var j = i + 1; j < particles.length; j++) {
                var dx = particles[i].x - particles[j].x;
                var dy = particles[i].y - particles[j].y;
                var distSq = dx * dx + dy * dy; // skip sqrt until we know it's in range
                if (distSq < maxDistSq) {
                    var d = Math.sqrt(distSq);
                    var t = 1 - d / maxDist; // 0..1 closeness
                    var bucket = Math.min(BUCKETS - 1, Math.floor(t * BUCKETS));

                    if (!buckets) buckets = new Array(BUCKETS);
                    if (!buckets[bucket]) buckets[bucket] = new Path2D();

                    buckets[bucket].moveTo(particles[i].x, particles[i].y);
                    buckets[bucket].lineTo(particles[j].x, particles[j].y);
                }
            }
        }

        if (!buckets) return;
        ctx.lineWidth = 1;
        for (var b = 0; b < BUCKETS; b++) {
            if (!buckets[b]) continue;
            var bandAlpha = ((b + 0.5) / BUCKETS) * alphaMax;
            ctx.strokeStyle = "rgba(" + rgb + "," + bandAlpha + ")";
            ctx.stroke(buckets[b]);
        }
    }

    function dots(particles, rgb, alpha) {
        ctx.fillStyle = "rgba(" + rgb + "," + alpha + ")";
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        var pal = palette();

        ctx.save();
        ctx.translate(px * 0.4, py * 0.4);
        linkLayer(far, 105, pal.a, pal.lineMax * 0.7);
        dots(far, pal.a, pal.dotFar);
        ctx.restore();

        ctx.save();
        ctx.translate(px, py);
        linkLayer(near, 150, pal.b, pal.lineMax);
        dots(near, pal.b, pal.dotNear);
        ctx.restore();
    }

    function tick() {
        if (!running) return;
        step(far);
        step(near);
        px += ((mouseX - 0.5) * 16 - px) * 0.04;
        py += ((mouseY - 0.5) * 12 - py) * 0.04;
        draw();
        rafId = requestAnimationFrame(tick);
    }

    function start() {
        if (rafId) return;
        running = true;
        if (reduceMotion) {
            draw();
        } else {
            tick();
        }
    }

    function stop() {
        running = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    window.addEventListener("resize", function () {
        resize();
        draw();
    });

    window.addEventListener("mousemove", function (e) {
        mouseX = e.clientX / window.innerWidth;
        mouseY = e.clientY / window.innerHeight;
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else start();
    });

    // Pause the animation while the user is typing into any field. This is
    // the main fix for input lag: the canvas was repainting ~60x/sec on
    // the same main thread that handles keystrokes, so every keypress had
    // to wait its turn behind a frame of canvas work.
    function isTypingTarget(el) {
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }

    document.addEventListener("focusin", function (e) {
        if (isTypingTarget(e.target)) stop();
    });

    document.addEventListener("focusout", function (e) {
        if (isTypingTarget(e.target) && !document.hidden) start();
    });

    // Repaint immediately with the new palette when the theme toggles.
    document.addEventListener("themechange", draw);

    resize();
    draw();
    if (!reduceMotion) start();
})();
