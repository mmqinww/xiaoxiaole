/**
 * 关卡数据配置
 * 每个关卡定义：图案种类数、方块总数、层数、网格大小
 * 重要：方块总数必须是3的倍数，每种图案数量也必须是3的倍数
 */

// 图案主题配置
const THEMES = {
  emoji: ['🍎', '🍋', '🍇', '🍊', '🫐', '🍒', '🥝', '🍑'],
};
const currentTheme = 'emoji';

// 关卡配置
const LEVELS = [
  {
    id: 1,
    name: '第1关',
    desc: '教学关',
    patternCount: 3,   // 图案种类
    totalBlocks: 12,   // 方块总数（3的倍数）
    layers: 2,         // 层数
    gridCols: 3,       // 网格列数
    gridRows: 3,       // 网格行数
  },
  {
    id: 2,
    name: '第2关',
    desc: '热身',
    patternCount: 4,
    totalBlocks: 18,
    layers: 2,
    gridCols: 4,
    gridRows: 4,
  },
  {
    id: 3,
    name: '第3关',
    desc: '入门',
    patternCount: 5,
    totalBlocks: 27,
    layers: 3,
    gridCols: 4,
    gridRows: 4,
  },
  {
    id: 4,
    name: '第4关',
    desc: '过渡',
    patternCount: 6,
    totalBlocks: 36,
    layers: 3,
    gridCols: 5,
    gridRows: 5,
  },
  {
    id: 5,
    name: '第5关',
    desc: '💀地狱',
    patternCount: 8,
    totalBlocks: 48,
    layers: 4,
    gridCols: 5,
    gridRows: 5,
  },
];

/**
 * 生成关卡方块数据
 * @param {number} levelIndex - 关卡索引 (0-based)
 * @returns {Array} 方块数组
 */
function generateLevelBlocks(levelIndex) {
  const level = LEVELS[levelIndex];
  const patterns = THEMES[currentTheme].slice(0, level.patternCount);
  
  // 分配每种图案的数量，保证每种都是3的倍数
  // 算法：先每种分配 floor(total/patternCount) 向下取到3的倍数
  // 然后把剩余的按3个一组分给前面的图案
  let allPatterns = [];
  const base = Math.floor(level.totalBlocks / level.patternCount / 3) * 3; // 基础数量（3的倍数）
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
  
  // 随机打乱
  shuffleArray(allPatterns);
  
  // 将方块分配到各层
  const blocks = [];
  const blocksPerLayer = Math.ceil(level.totalBlocks / level.layers);
  let patternIdx = 0;
  
  for (let layer = 0; layer < level.layers; layer++) {
    const layerBlockCount = Math.min(
      blocksPerLayer,
      level.totalBlocks - patternIdx
    );
    
    // 为当前层生成随机位置
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
      });
      patternIdx++;
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
  
  // 如果位置不够，允许一些重叠（增加难度）
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
 * Fisher-Yates 洗牌算法
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
