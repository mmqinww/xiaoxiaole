/**
 * 关卡数据配置
 * 每个关卡定义：图案种类数、方块总数、层数、网格大小
 * 重要：方块总数必须是3的倍数，每种图案数量也必须是3的倍数
 * 
 * 遮挡模式说明：
 * - stack1x1: 1挡1，传统模式，一张牌挡住下面一张牌
 * - stack1x2: 1挡2，一张牌挡住下面2张牌
 * - stack1x4: 1挡4，一张牌挡住下面4张牌
 * 
 * stackModes 配置每种模式的比例权重，在同一关卡中可以混合使用
 */

// 图案主题配置（扩展到12种）
const THEMES = {
  emoji: ['🍎', '🍋', '🍇', '🍊', '🫐', '🍒', '🥝', '🍑', '🍓', '🌽', '🥑', '🍌'],
};
const currentTheme = 'emoji';

// 关卡配置
const LEVELS = [
  {
    id: 1,
    name: '第1关',
    desc: '教学关',
    patternCount: 4,
    totalBlocks: 60,
    layers: 3,
    gridCols: 6,
    gridRows: 6,
    stackModes: { stack1x1: 1 }, // 纯1挡1
  },
  {
    id: 2,
    name: '第2关',
    desc: '热身',
    patternCount: 6,
    totalBlocks: 90,
    layers: 4,
    gridCols: 7,
    gridRows: 7,
    stackModes: { stack1x1: 0.7, stack1x2: 0.3 }, // 引入1挡2
  },
  {
    id: 3,
    name: '第3关',
    desc: '入门',
    patternCount: 8,
    totalBlocks: 120,
    layers: 5,
    gridCols: 7,
    gridRows: 7,
    stackModes: { stack1x1: 0.5, stack1x2: 0.3, stack1x4: 0.2 }, // 引入1挡4
  },
  {
    id: 4,
    name: '第4关',
    desc: '过渡',
    patternCount: 10,
    totalBlocks: 150,
    layers: 5,
    gridCols: 8,
    gridRows: 8,
    stackModes: { stack1x1: 0.3, stack1x2: 0.4, stack1x4: 0.3 },
  },
  {
    id: 5,
    name: '第5关',
    desc: '💀地狱',
    patternCount: 12,
    totalBlocks: 204,
    layers: 6,
    gridCols: 9,
    gridRows: 9,
    stackModes: { stack1x1: 0.2, stack1x2: 0.3, stack1x4: 0.5 }, // 大量1挡4
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
  
  // 建立遮挡关系（基于stackModes）
  buildBlockRelations(blocks, level);
  
  return blocks;
}

/**
 * 建立方块之间的遮挡关系
 * 根据关卡的stackModes配置，为每个上层方块设置其遮挡的下层方块列表
 */
function buildBlockRelations(blocks, level) {
  const modes = level.stackModes || { stack1x1: 1 };
  
  // 按层从高到低遍历，为每个上层方块分配遮挡模式
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    // 随机选择一个遮挡模式
    block.stackMode = pickStackMode(modes);
    // blockedBy 将在 updateBlockedStatus 中动态计算
    block.blockers = []; // 记录遮挡此方块的上层方块id列表
  }
}

/**
 * 根据权重随机选择遮挡模式
 */
function pickStackMode(modes) {
  const entries = Object.entries(modes);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * total;
  for (const [mode, weight] of entries) {
    rand -= weight;
    if (rand <= 0) return mode;
  }
  return entries[0][0];
}

/**
 * 获取一个遮挡模式对应的最大遮挡下方方块数
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
