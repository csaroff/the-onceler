// The pen. The scene is drawn in flat colour, then every outline and crease is inked on top with a slightly unsteady line.
import * as THREE from 'three';

// Things on this layer get no ink line: smoke, sparks, water.
export const NO_INK = 1;

const fragmentShader = /* glsl */ `
  #include <packing>
  uniform sampler2D tColor, tNormal, tDepth;
  uniform vec2 texel;
  uniform float near, far, time, ruin;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  // One over distance: a flat surface is a straight line in this, so only real steps show up as edges.
  float inverseDistance(vec2 uv) { return -1.0 / perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
  vec3 normalAt(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

  void main() {
    // The pen wobbles, and re-wobbles a few times a second.
    float tick = floor(time * 5.0);
    vec2 wobble = vec2(noise(vUv / texel / 34.0 + tick * 7.3), noise(vUv / texel / 34.0 + 50.0 + tick * 3.1)) - 0.5;
    vec2 uv = vUv + wobble * texel * 2.2;

    float q = inverseDistance(uv);
    float distance = 1.0 / q;
    vec2 o = texel * clamp(26.0 / distance, 0.75, 2.4); // a fat line up close, a thin one far away

    float ql = inverseDistance(uv - vec2(o.x, 0.0)), qr = inverseDistance(uv + vec2(o.x, 0.0));
    float qd = inverseDistance(uv - vec2(0.0, o.y)), qu = inverseDistance(uv + vec2(0.0, o.y));
    float step = max(abs(ql + qr - 2.0 * q), abs(qd + qu - 2.0 * q)) / max(q, max(max(ql, qr), max(qd, qu)));
    float outline = smoothstep(0.035, 0.09, step);

    vec3 n = normalAt(uv);
    float bend = max(max(1.0 - dot(n, normalAt(uv - vec2(o.x, 0.0))), 1.0 - dot(n, normalAt(uv + vec2(o.x, 0.0)))),
                     max(1.0 - dot(n, normalAt(uv - vec2(0.0, o.y))), 1.0 - dot(n, normalAt(uv + vec2(0.0, o.y)))));
    float crease = smoothstep(0.35, 0.7, bend) * (1.0 - smoothstep(60.0, 140.0, distance));

    float ink = max(outline * (1.0 - smoothstep(300.0, 470.0, distance)), crease * 0.85);

    vec3 color = texture2D(tColor, vUv).rgb;
    // Paper grain, and the colour draining out as the place is ruined.
    color *= 0.955 + 0.045 * noise(vUv / texel / 2.5);
    float grey = dot(color, vec3(0.3, 0.59, 0.11));
    color = mix(color, vec3(grey) * vec3(1.02, 0.94, 0.8), ruin * 0.45);
    color = mix(color, vec3(0.012, 0.008, 0.006), ink * 0.93);
    float corner = length(vUv - 0.5);
    color *= 1.0 - smoothstep(0.45, 0.95, corner) * (0.25 + ruin * 0.3);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createInk(renderer) {
  const normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null }, tNormal: { value: null }, tDepth: { value: null },
      texel: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 1000 }, time: { value: 0 }, ruin: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene().add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let colorTarget = null, normalTarget = null;
  const size = new THREE.Vector2(), clear = new THREE.Color();

  function resize() {
    renderer.getDrawingBufferSize(size);
    colorTarget?.dispose();
    normalTarget?.dispose();
    colorTarget = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4 });
    normalTarget = new THREE.WebGLRenderTarget(size.x, size.y, { depthTexture: new THREE.DepthTexture(size.x, size.y) });
    material.uniforms.tColor.value = colorTarget.texture;
    material.uniforms.tNormal.value = normalTarget.texture;
    material.uniforms.tDepth.value = normalTarget.depthTexture;
    material.uniforms.texel.value.set(1 / size.x, 1 / size.y);
  }

  function render(scene, camera, time = 0, ruin = 0) {
    renderer.getDrawingBufferSize(size);
    if (!colorTarget || colorTarget.width !== size.x || colorTarget.height !== size.y) resize();

    renderer.setRenderTarget(colorTarget);
    renderer.render(scene, camera);

    // Second look at the same scene, recording only shape (which way each surface faces, and how far away it is).
    const background = scene.background, layers = camera.layers.mask;
    renderer.getClearColor(clear);
    const alpha = renderer.getClearAlpha();
    scene.background = null;
    scene.overrideMaterial = normalMaterial;
    camera.layers.set(0);
    renderer.setRenderTarget(normalTarget);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.render(scene, camera);
    scene.background = background;
    scene.overrideMaterial = null;
    camera.layers.mask = layers;
    renderer.setClearColor(clear, alpha);

    material.uniforms.near.value = camera.near;
    material.uniforms.far.value = camera.far;
    material.uniforms.time.value = time;
    material.uniforms.ruin.value = ruin;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCamera);
  }

  return { render };
}
