/**
 * 关卡数据配置
 * 
 * 遮挡模式说明：
 * - stack1x1: 1挡1，放在四周
 * - stack1x2: 1挡2，放在画面中间
 * - stack1x4: 1挡4，放在画面中间
 * 
 * 遮挡规则：但凡有一点遮挡都不能直接选中
 */

// 图案主题配置（12种）
const THEMES = {
  emoji: ['🍎', '🍋', '🍇', '🍊', '🫐', '🍒', '🥝', '🍑', '🍓', '🌽', '🥑', '🍌'],
};
const currentTheme = 'emoji';

// 关卡配置（2关）
const LEVELS = [
  {
    id: 1,
    name: '第1关',
    desc: '热身',
    patternCount: 4,
    totalBlocks: 21,
    layers: 2,
    gridCols: 4,
    gridRows: 4,
    stackModes: { stack1x1: 1 }, // 纯1挡1，简单
  },
  {
    id: 2,
    name: '第2关',
    desc: '💀地狱',
    patternCount: 12,
    totalBlocks: 204,
    layers: 12,        // 更多层，纵向堆叠
    gridCols: 5,       // 进一步缩小网格，确保不超出屏幕
    gridRows: 5,
    stackModes: { stack1x1: 0.2, stack1x2: 0.3, stack1x4: 0.5 },
  },
];

/**
 * 生成关卡方块数据
 */
function generateLevelBlocks(levelIndex) {
  const level = LEVELS[levelIndex];
  const patterns = THEMES[currentTheme].slice(0, level.patternCount);
  
  // 分配每种图案的数量，保证每种都是3的倍数
  let allPatterns = [];
  const base = Math.floor(level.totalBlocks / level.patternCount / 3) * 3;
  let remaining = level.totalBlocks - base * level.patternCount;
  
  for (let i = 0; i < level.patternCount; i++) {
    let count = base;
    if (remaining >= 3) {
      count += 3;
      remaining -= 3;
    }
    for (let j = 0; j < count; j++) {
      allPatterns.push(patterns[i]);
    }
  }
  
  // 如果因为取整导致总数不够，补齐
  while (allPatterns.length < level.totalBlocks) {
    allPatterns.push(patterns[allPatterns.length % level.patternCount]);
  }
  // 如果多了就截断
  allPatterns = allPatterns.slice(0, level.totalBlocks);
  
  // 随机打乱
  shuffleArray(allPatterns);
  
  // 生成方块，根据遮挡模式决定位置布局
  const blocks = [];
  let patternIdx = 0;
  
  if (level.stackModes.stack1x4 || level.stackModes.stack1x2) {
    // 混合模式：1挡1放四周，1挡2和1挡4放中间
    const totalBlocks = level.totalBlocks;
    const ratio1x1 = level.stackModes.stack1x1 || 0;
    const count1x1 = Math.floor(totalBlocks * ratio1x1 / 3) * 3; // 保证3的倍数
    const countCenter = totalBlocks - count1x1;
    
    // 生成四周位置的方块（1挡1模式）
    const edgeBlocks = generateEdgeBlocks(count1x1, level, allPatterns, patternIdx);
    blocks.push(...edgeBlocks);
    patternIdx += count1x1;
    
    // 生成中间位置的方块（1挡2和1挡4模式）
    const centerBlocks = generateCenterBlocks(countCenter, level, allPatterns, patternIdx);
    blocks.push(...centerBlocks);
  } else {
    // 纯1挡1模式（简单关）
    const blocksPerLayer = Math.ceil(level.totalBlocks / level.layers);
    
    for (let layer = 0; layer < level.layers; layer++) {
      const layerBlockCount = Math.min(
        blocksPerLayer,
        level.totalBlocks - patternIdx
      );
      
      const positions = generateLayerPositions(
        layerBlockCount,
        level.gridCols,
        level.gridRows,
        layer
      );
      
      for (let i = 0; i < layerBlockCount; i++) {
        blocks.push({
          id: patternIdx,
          pattern: allPatterns[patternIdx],
          layer: layer,
          gridX: positions[i].x,
          gridY: positions[i].y,
          removed: false,
          stackMode: 'stack1x1',
          blockers: [],
        });
        patternIdx++;
      }
    }
  }
  
  return blocks;
}

/**
 * 生成四周的方块（1挡1模式）
 * 位于网格边缘，但严格控制在网格范围内
 */
function generateEdgeBlocks(count, level, allPatterns, startIdx) {
  const blocks = [];
  const cols = level.gridCols;
  const rows = level.gridRows;
  
  // 四周位置：只使用网格边缘一圈（不超出gridCols x gridRows）
  const edgePositions = [];
  for (let x = 0; x < cols; x++) {
    edgePositions.push({ x, y: 0 });
    if (rows > 1) edgePositions.push({ x, y: rows - 1 });
  }
  for (let y = 1; y < rows - 1; y++) {
    edgePositions.push({ x: 0, y });
    if (cols > 1) edgePositions.push({ x: cols - 1, y });
  }
  shuffleArray(edgePositions);
  
  // 分配到2层（浅层叠）
  const layers = 2;
  const perLayer = Math.ceil(count / layers);
  let idx = startIdx;
  
  for (let layer = 0; layer < layers && idx < startIdx + count; layer++) {
    const layerCount = Math.min(perLayer, startIdx + count - idx);
    for (let i = 0; i < layerCount; i++) {
      const pos = edgePositions[(idx - startIdx) % edgePositions.length];
      blocks.push({
        id: idx,
        pattern: allPatterns[idx],
        layer: layer,
        gridX: pos.x,
        gridY: pos.y,
        removed: false,
        stackMode: 'stack1x1',
        blockers: [],
      });
      idx++;
    }
  }
  
  return blocks;
}

/**
 * 生成中间区域的方块（1挡2和1挡4模式）
 * 
 * 布局策略：交替使用3种网格位置
 * - A层（整数坐标）：牌在 (1,1) (1,2) (2,1) (2,2) ...
 * - B层（水平半格偏移）：牌在 (1.5,1) (1.5,2) ... → 每张盖住左右两张A层牌的各一半（1挡2）
 * - C层（双向半格偏移）：牌在 (1.5,1.5) ... → 每张盖住四张下层牌的各1/4（1挡4）
 * 
 * 循环：A → B → C → A → B → C ...
 * 这样从视觉上能清晰看到1挡2和1挡4的堆叠效果
 */
function generateCenterBlocks(count, level, allPatterns, startIdx) {
  const blocks = [];
  const cols = level.gridCols;
  const rows = level.gridRows;
  
  // 中心区域范围（留出边缘给1挡1的牌）
  const margin = 1;
  const centerMinX = margin;
  const centerMaxX = cols - margin - 1;
  const centerMinY = margin;
  const centerMaxY = rows - margin - 1;
  
  const layers = level.layers;
  const perLayer = Math.ceil(count / layers);
  let idx = startIdx;
  
  for (let layer = 0; layer < layers && idx < startIdx + count; layer++) {
    const layerCount = Math.min(perLayer, startIdx + count - idx);
    const layerType = layer % 3; // 0=A(整数), 1=B(水平偏移), 2=C(双向偏移)
    
    const layerPositions = [];
    
    if (layerType === 0) {
      // A层：整数网格位置
      for (let x = centerMinX; x <= centerMaxX; x++) {
        for (let y = centerMinY; y <= centerMaxY; y++) {
          layerPositions.push({ x, y });
        }
      }
    } else if (layerType === 1) {
      // B层：水平偏移半格（1挡2效果 - 盖住左右两张）
      for (let x = centerMinX; x < centerMaxX; x++) {
        for (let y = centerMinY; y <= centerMaxY; y++) {
          layerPositions.push({ x: x + 0.5, y });
        }
      }
    } else {
      // C层：双向偏移半格（1挡4效果 - 盖住四角四张）
      for (let x = centerMinX; x < centerMaxX; x++) {
        for (let y = centerMinY; y < centerMaxY; y++) {
          layerPositions.push({ x: x + 0.5, y: y + 0.5 });
        }
      }
    }
    
    shuffleArray(layerPositions);
    
    for (let i = 0; i < layerCount; i++) {
      const pos = layerPositions[i % layerPositions.length];
      const mode = layerType === 0 ? 'stack1x1' : (layerType === 1 ? 'stack1x2' : 'stack1x4');
      
      blocks.push({
        id: idx,
        pattern: allPatterns[idx],
        layer: layer + 2,
        gridX: pos.x,
        gridY: pos.y,
        removed: false,
        stackMode: mode,
        blockers: [],
      });
      idx++;
    }
  }
  
  return blocks;
}

/**
 * 为某一层生成不重复的网格位置
 */
function generateLayerPositions(count, cols, rows, layer) {
  const positions = [];
  const allPositions = [];
  
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      allPositions.push({ x, y });
    }
  }
  
  shuffleArray(allPositions);
  
  for (let i = 0; i < Math.min(count, allPositions.length); i++) {
    positions.push(allPositions[i]);
  }
  
  while (positions.length < count) {
    const extraPos = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows),
    };
    positions.push(extraPos);
  }
  
  return positions;
}

/**
 * 获取遮挡模式对应的最大遮挡下方方块数
 */
function getStackCount(mode) {
  switch (mode) {
    case 'stack1x4': return 4;
    case 'stack1x2': return 2;
    case 'stack1x1':
    default: return 1;
  }
}

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
