import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BRAND_LOGO_PATH } from '../lib/utils';

interface Logo3DLoaderProps {
  visible: boolean;
  logoUrl?: string;
  siteName?: string;
  language?: 'bn' | 'en';
}

function drawEmblemCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement | null
): void {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);

  // Crisp porcelain-matte coin face (zero glow, pure high-contrast surface)
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.495, 0, Math.PI * 2);
  ctx.fill();

  // Subtle architectural pinstripe ring
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = size * 0.016;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.445, 0, Math.PI * 2);
  ctx.stroke();

  if (img && img.complete && img.naturalWidth > 0) {
    const padding = size * 0.14;
    const maxDraw = size - padding * 2;
    const aspect = img.naturalWidth / img.naturalHeight;
    let drawW = maxDraw;
    let drawH = maxDraw;
    if (aspect > 1) {
      drawH = maxDraw / aspect;
    } else {
      drawW = maxDraw * aspect;
    }
    const dx = (size - drawW) / 2;
    const dy = (size - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  } else {
    // Immediate crisp vector placeholder until the PNG decodes
    ctx.strokeStyle = '#172554';
    ctx.lineWidth = size * 0.042;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#172554';
    ctx.font = `800 ${Math.round(size * 0.24)}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ASA', size / 2, size / 2);
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.09)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const Logo3DLoader: React.FC<Logo3DLoaderProps> = ({
  visible,
  logoUrl,
  siteName = 'ASA,LEARN',
  language = 'en',
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(visible);
  const [fadingOut, setFadingOut] = useState(false);
  const [useFallback2D, setUseFallback2D] = useState(false);

  const resolvedLogo = (logoUrl && logoUrl.trim()) || BRAND_LOGO_PATH;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      setFadingOut(false);
    } else if (shouldRender) {
      setFadingOut(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
      }, 380);
      return () => window.clearTimeout(timer);
    }
  }, [visible, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const container = stageRef.current;
    if (!container || prefersReducedMotion) {
      setUseFallback2D(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setUseFallback2D(true);
      return;
    }

    setUseFallback2D(false);
    const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(maxDpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const width = Math.max(container.clientWidth, 200);
    const height = Math.max(container.clientHeight, 200);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(0, 0.18, 5.1);
    camera.lookAt(0, -0.04, 0);

    // Subtle physical studio environment lighting (zero glow / zero bloom / zero emissive)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.72;
    envScene.dispose();
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.75);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(3.4, 4.6, 5.2);
    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.65);
    fillLight.position.set(-4.0, -1.2, 3.0);
    const rimLight = new THREE.DirectionalLight(0xf1f5f9, 0.7);
    rimLight.position.set(0.2, 3.2, -4.5);
    scene.add(hemiLight, keyLight, fillLight, rimLight);

    // Logo canvas texture (front + back faces of 3D medallion)
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 768;
    logoCanvas.height = 768;
    drawEmblemCanvas(logoCanvas, null);

    const emblemTexture = new THREE.CanvasTexture(logoCanvas);
    emblemTexture.colorSpace = THREE.SRGBColorSpace;
    emblemTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.onload = () => {
      drawEmblemCanvas(logoCanvas, logoImg);
      emblemTexture.needsUpdate = true;
    };
    logoImg.src = resolvedLogo;

    // Composite 3D Medallion Group
    const medallionGroup = new THREE.Group();

    const coreGeo = new THREE.CylinderGeometry(1.06, 1.06, 0.16, 64);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x172554,
      roughness: 0.46,
      metalness: 0.28,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.rotation.x = Math.PI / 2;
    medallionGroup.add(coreMesh);

    const bezelGeo = new THREE.TorusGeometry(1.07, 0.055, 24, 72);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.34,
      metalness: 0.7,
    });
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    medallionGroup.add(bezelMesh);

    const innerTrimGeo = new THREE.TorusGeometry(0.95, 0.018, 16, 64);
    const innerTrimMat = new THREE.MeshStandardMaterial({
      color: 0x263b91,
      roughness: 0.48,
      metalness: 0.36,
    });
    const frontTrim = new THREE.Mesh(innerTrimGeo, innerTrimMat);
    frontTrim.position.z = 0.082;
    const backTrim = new THREE.Mesh(innerTrimGeo, innerTrimMat);
    backTrim.position.z = -0.082;
    medallionGroup.add(frontTrim, backTrim);

    const faceGeo = new THREE.CircleGeometry(0.94, 64);
    const faceMat = new THREE.MeshStandardMaterial({
      map: emblemTexture,
      roughness: 0.42,
      metalness: 0.08,
    });
    const frontFace = new THREE.Mesh(faceGeo, faceMat);
    frontFace.position.z = 0.084;
    const backFace = new THREE.Mesh(faceGeo, faceMat);
    backFace.position.z = -0.084;
    backFace.rotation.y = Math.PI;
    medallionGroup.add(frontFace, backFace);

    scene.add(medallionGroup);

    // Secondary Precision Architectural Orbit Ring + 12 Instanced Markers (zero glow)
    const orbitGroup = new THREE.Group();
    const orbitRingGeo = new THREE.TorusGeometry(1.44, 0.02, 16, 96);
    const orbitRingMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.4,
      metalness: 0.56,
    });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitGroup.add(orbitRing);

    const tickCount = 12;
    const tickGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
    const tickMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.38,
      metalness: 0.62,
    });
    const tickInstanced = new THREE.InstancedMesh(tickGeo, tickMat, tickCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < tickCount; i += 1) {
      const angle = (i / tickCount) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 1.44, Math.sin(angle) * 1.44, 0);
      dummy.rotation.set(0, 0, angle);
      dummy.updateMatrix();
      tickInstanced.setMatrixAt(i, dummy.matrix);
    }
    tickInstanced.instanceMatrix.needsUpdate = true;
    orbitGroup.add(tickInstanced);
    orbitGroup.rotation.x = 0.34;
    scene.add(orbitGroup);

    // Matte Dark Contact Shadow Disc Below Coin (NOT a glow)
    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.52;
    scene.add(shadowMesh);

    const clock = new THREE.Clock();
    let frameId = 0;
    let checkedSoftwareGl = false;
    let isDisposed = false;

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      if (!isDisposed) setUseFallback2D(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = Math.max(container.clientWidth, 160);
      const h = Math.max(container.clientHeight, 160);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const animate = () => {
      if (isDisposed) return;
      frameId = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      // Smooth 3D turntable & architectural tilt
      medallionGroup.rotation.y += delta * 1.65;
      medallionGroup.rotation.x = Math.sin(elapsed * 1.6) * 0.14;
      const bob = Math.sin(elapsed * 2.4) * 0.07;
      medallionGroup.position.y = bob;

      // Counter-rotating precision orbit ring
      orbitGroup.rotation.z -= delta * 0.55;
      orbitGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.28;
      orbitGroup.position.y = bob * 0.4;

      // Matte ground contact shadow subtly scales with elevation
      const shadowScale = 1 - bob * 0.65;
      shadowMesh.scale.set(shadowScale, shadowScale, 1);

      renderer.render(scene, camera);

      if (!checkedSoftwareGl) {
        checkedSoftwareGl = true;
        try {
          const gl = renderer.getContext();
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          const gpu = dbg
            ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
            : String(gl.getParameter(gl.RENDERER) || '');
          if (/SwiftShader|llvmpipe|Software/i.test(gpu)) {
            renderer.setPixelRatio(1);
            tickInstanced.visible = false;
          }
        } catch {
          // ignore probe restrictions
        }
      }
    };

    animate();

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

      coreGeo.dispose();
      coreMat.dispose();
      bezelGeo.dispose();
      bezelMat.dispose();
      innerTrimGeo.dispose();
      innerTrimMat.dispose();
      faceGeo.dispose();
      faceMat.dispose();
      orbitRingGeo.dispose();
      orbitRingMat.dispose();
      tickGeo.dispose();
      tickMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      emblemTexture.dispose();
      shadowTex.dispose();
      envRT.dispose();
      renderer.dispose();
    };
  }, [shouldRender, resolvedLogo]);

  if (!shouldRender) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${siteName}`}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F5F9FF] px-6 transition-all duration-300 ease-out dark:bg-[#070E24] ${
        fadingOut ? 'pointer-events-none scale-[0.985] opacity-0' : 'opacity-100'
      }`}
    >
      {/* 3D Medallion Stage (strictly zero glow effects) */}
      <div className="relative flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60">
        {!useFallback2D ? (
          <div ref={stageRef} className="h-full w-full" />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-[#172554] bg-[#F8FAFC] p-4 shadow-md dark:border-[#CBD5E1]">
            <img
              src={resolvedLogo}
              alt={`${siteName} logo`}
              className="h-full w-full object-contain"
            />
          </div>
        )}
      </div>

      {/* Crisp Editorial Wordmark & Solid Progress Bar (no glow) */}
      <div className="mt-2 flex flex-col items-center text-center">
        <p className="font-display text-xl font-extrabold tracking-tight text-[#172554] dark:text-[#F8FAFC] sm:text-2xl">
          {siteName}
        </p>
        <p className="mt-1 text-xs font-medium text-[#64748B] dark:text-slate-400">
          {language === 'bn'
            ? 'পাঠ্যক্রম ও প্রোফাইল লোড হচ্ছে...'
            : 'Preparing your lessons & workspace...'}
        </p>

        <div className="mt-4 h-1.5 w-44 overflow-hidden rounded-full bg-[#172554]/10 dark:bg-white/10">
          <div className="h-full w-1/2 animate-[loaderSlide_1.15s_ease-in-out_infinite] rounded-full bg-[#172554] dark:bg-[#BFE8FF]" />
        </div>
      </div>

      <style>{`
        @keyframes loaderSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </div>
  );
};
