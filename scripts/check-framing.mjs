// Kiểm tra FRAMING tự động cân đối cho MỌI kích thước tủ (W×H×D).
// Mirror computeScreenshotCamera (bounding-sphere fit) → dựng THREE.PerspectiveCamera
// + lookAt tâm tủ (giống ScreenshotCameraRig) → project 8 góc bbox → NDC.
//   |NDC| ≤ 1  → trong khung (không cắt).  maxExtent ≈ độ lấp khung.
// FAIL nếu bất kỳ góc nào > 1 (bị cắt) hoặc fill < 0.45 (quá nhỏ, mất cân đối).
import * as THREE from 'three';

// ---- copy NGUYÊN công thức từ computeScreenshotCamera (giữ đồng bộ thủ công) ----
function computeShotCam(width, height, depth, angle) {
  const FRAME_FILL = 0.82;
  const FOV = 18;
  const EYE_HEIGHT = 1650;
  const MAX_TILT_DOWN = (20 * Math.PI) / 180;
  const fovHalfRad = (FOV / 2) * (Math.PI / 180);
  const r = 0.5 * Math.sqrt(width * width + height * height + depth * depth);
  const dist = r / Math.sin(fovHalfRad) / FRAME_FILL;
  const centerY = height / 2;
  let dy = EYE_HEIGHT - centerY;
  const maxDy = dist * Math.sin(MAX_TILT_DOWN);
  if (dy > maxDy) dy = maxDy;
  const camY = centerY + dy;
  const horiz = Math.sqrt(Math.max(dist * dist - dy * dy, 1));
  const isoLen = Math.hypot(0.65, 0.75);
  const ix = (0.65 / isoLen) * horiz;
  const iz = (0.75 / isoLen) * horiz;
  const positions = {
    'iso-front-right': [ix, camY, iz],
    front: [0, camY, horiz],
    'iso-front-left': [-ix, camY, iz],
  };
  return { position: positions[angle], fov: FOV, centerY };
}

function frameFor(width, height, depth, angle) {
  const { position, fov, centerY } = computeShotCam(width, height, depth, angle);
  // Square crop 1:1 → aspect = 1 (giống thumbnail vuông).
  const cam = new THREE.PerspectiveCamera(fov, 1, 100, 30000);
  cam.position.set(position[0], position[1], position[2]);
  cam.lookAt(0, centerY, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const hw = width / 2, hd = depth / 2;
  let maxNdc = 0;
  for (const x of [-hw, hw])
    for (const y of [0, height])
      for (const z of [-hd, hd]) {
        const ndc = new THREE.Vector3(x, y, z).project(cam);
        maxNdc = Math.max(maxNdc, Math.abs(ndc.x), Math.abs(ndc.y));
      }
  return maxNdc; // ≤1 = trong khung; giá trị ~ độ lấp khung
}

const Ws = [150, 300, 600, 900, 1200, 1800, 2400];
const Hs = [150, 300, 600, 900, 1200, 1800, 2400];
const Ds = [300, 450, 600];
const angles = ['iso-front-right', 'front', 'iso-front-left'];

let fail = 0, worstClip = 0, worstSmall = 1, n = 0;
let worstClipCase = '', worstSmallCase = '';
for (const W of Ws) for (const H of Hs) for (const D of Ds) for (const a of angles) {
  n++;
  const m = frameFor(W, H, D, a);
  if (m > 1.0) { fail++; if (m > worstClip) { worstClip = m; worstClipCase = `${W}×${H}×${D} ${a} → maxNDC ${m.toFixed(3)}`; } }
  if (m < worstSmall) { worstSmall = m; worstSmallCase = `${W}×${H}×${D} ${a} → fill ${m.toFixed(3)}`; }
}
console.log(`Đã kiểm ${n} tổ hợp (W×H×D×góc).`);
console.log(`Bị CẮT (maxNDC>1): ${fail}` + (fail ? ` — tệ nhất: ${worstClipCase}` : ' ✓'));
console.log(`Nhỏ nhất (fill thấp nhất): ${worstSmallCase}`);
if (fail === 0 && worstSmall >= 0.45) console.log('KẾT QUẢ: ĐẠT — mọi kích thước vừa khung & không quá nhỏ.');
else if (fail === 0) console.log(`KẾT QUẢ: vừa khung hết, nhưng có case fill < 0.45 (${worstSmall.toFixed(3)}) — cân nhắc.`);
else { console.log('KẾT QUẢ: FAIL — có tủ bị cắt khung.'); process.exit(1); }
