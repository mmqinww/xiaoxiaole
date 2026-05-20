/**
 * 核心游戏逻辑
 * 处理方块状态、遮挡判定、收集槽、消除逻辑
 * 
 * 遮挡模式：
 * - stack1x1: 上面1张牌遮挡下面1张牌
 * - stack1x2: 上面1张牌遮挡下面2张牌
 * - stack1x4: 上面1张牌遮挡下面4张牌
 * 一张牌只有它上面的所有遮挡牌都被取走后，才能被选中
 */

const Game = {
  // 游戏状态
  currentLevel: 0,
  blocks: [],
  slot: [],          // 收集槽（最多7格）
  maxSlot: 7,
  startTime: 0,
  timerInterval: null,
  elapsedTime: 0,
  
  // 道具状态
  undoUsed: false,
  shuffleUsed: false,
  lastSlotBlock: null, // 上一个放入槽的方块（用于撤回）
  
  // 游戏配置
  blockSize: 44,      // 方块大小（px）
  layerOffset: 3,     // 层间偏移（px），极小偏移让堆叠更紧凑
  
  /**
   * 开始关卡
   */
  startLevel(levelIndex) {
    this.currentLevel = levelIndex;
    this.blocks = generateLevelBlocks(levelIndex);
    this.slot = [];
    this.undoUsed = false;
    this.shuffleUsed = false;
    this.lastSlotBlock = null;
    this.elapsedTime = 0;
    this.startTime = Date.now();
    
    // 启动计时器
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
      UI.updateTimer(this.elapsedTime);
    }, 1000);
    
    // 建立遮挡关系并计算初始状态
    this.buildBlockerRelations();
    this.updateBlockedStatus();
    
    // 渲染
    UI.renderGame(this);
  },
  
  /**
   * 建立遮挡关系：根据每个上层方块的 stackMode，
   * 确定它遮挡了哪些下层方块
   * 
   * 规则：
   * - stack1x1: 遮挡下方重叠的1张牌
   * - stack1x2: 遮挡下方重叠的2张牌
   * - stack1x4: 遮挡下方重叠的4张牌
   */
  buildBlockerRelations() {
    // 清空所有方块的 blockers 列表
    this.blocks.forEach(block => {
      block.blockers = [];
    });
    
    // 按层从高到低排序（高层先处理）
    const sortedBlocks = [...this.blocks].sort((a, b) => b.layer - a.layer);
    
    for (const upperBlock of sortedBlocks) {
      if (upperBlock.removed) continue;
      
      // 获取此方块的遮挡模式能覆盖的下方方块数
      const maxCover = getStackCount(upperBlock.stackMode || 'stack1x1');
      
      // 找到所有在下层且与此方块有位置重叠的方块
      const overlappingBelow = this.blocks.filter(lower => {
        if (lower.removed || lower.id === upperBlock.id) return false;
        if (lower.layer >= upperBlock.layer) return false;
        return this.checkOverlap(lower, upperBlock);
      });
      
      // 按距离排序，取最近的 maxCover 个
      const sorted = overlappingBelow.sort((a, b) => {
        const distA = Math.abs(a.layer - upperBlock.layer);
        const distB = Math.abs(b.layer - upperBlock.layer);
        return distA - distB;
      });
      
      const covered = sorted.slice(0, maxCover);
      
      // 为被遮挡的方块添加 blocker
      for (const lowerBlock of covered) {
        if (!lowerBlock.blockers.includes(upperBlock.id)) {
          lowerBlock.blockers.push(upperBlock.id);
        }
      }
    }
  },
  
  /**
   * 更新方块遮挡状态
   * 一张牌只有它上面的所有 blockers 都被移除后，才能被选中
   */
  updateBlockedStatus() {
    this.blocks.forEach(block => {
      if (block.removed) {
        block.blocked = false;
        return;
      }
      
      // 检查所有 blockers 是否都已被移除
      const activeBlockers = block.blockers.filter(blockerId => {
        const blocker = this.blocks.find(b => b.id === blockerId);
        return blocker && !blocker.removed;
      });
      
      block.blocked = activeBlockers.length > 0;
    });
  },
  
  /**
   * 检查两个方块是否位置重叠
   * 规则：但凡有一点遮挡都不能选中（阈值为0）
   */
  checkOverlap(blockA, blockB) {
    // 计算实际像素位置
    const posA = this.getBlockPosition(blockA);
    const posB = this.getBlockPosition(blockB);
    
    const size = this.blockSize;
    
    const overlapX = Math.max(0, 
      Math.min(posA.x + size, posB.x + size) - Math.max(posA.x, posB.x)
    );
    const overlapY = Math.max(0, 
      Math.min(posA.y + size, posB.y + size) - Math.max(posA.y, posB.y)
    );
    
    // 只要有任何重叠面积就算遮挡
    return overlapX > 0 && overlapY > 0;
  },
  
  /**
   * 获取方块的实际像素位置
   */
  getBlockPosition(block) {
    const offset = block.layer * this.layerOffset;
    return {
      x: block.gridX * (this.blockSize + 4) + offset,
      y: block.gridY * (this.blockSize + 4) + offset,
    };
  },
  
  /**
   * 点击方块
   */
  clickBlock(blockId) {
    const block = this.blocks.find(b => b.id === blockId);
    if (!block || block.removed || block.blocked) return;
    
    // 检查槽位是否已满
    if (this.slot.length >= this.maxSlot) return;
    
    // 记录用于撤回
    this.lastSlotBlock = { ...block, originalIndex: this.slot.length };
    
    // 标记方块为已移除
    block.removed = true;
    
    // 将方块加入槽中（按图案分组插入）
    this.addToSlot(block);
    
    // 更新遮挡关系（移除方块后，被它遮挡的方块可能变为可点击）
    this.updateBlockedStatus();
    
    // 渲染动画
    UI.animateBlockToSlot(block, () => {
      // 检查是否可以消除
      this.checkAndEliminate();
      
      // 检查游戏状态
      this.checkGameState();
      
      // 更新UI
      UI.renderGame(this);
    });
  },
  
  /**
   * 将方块加入收集槽（相同图案相邻放置）
   */
  addToSlot(block) {
    // 找到相同图案的位置，插在旁边
    let insertIndex = this.slot.length;
    for (let i = 0; i < this.slot.length; i++) {
      if (this.slot[i].pattern === block.pattern) {
        // 找到同类，插在最后一个同类后面
        let lastSame = i;
        while (lastSame + 1 < this.slot.length && 
               this.slot[lastSame + 1].pattern === block.pattern) {
          lastSame++;
        }
        insertIndex = lastSame + 1;
        break;
      }
    }
    
    this.slot.splice(insertIndex, 0, {
      id: block.id,
      pattern: block.pattern,
    });
  },
  
  /**
   * 检查并执行消除
   */
  checkAndEliminate() {
    // 统计每种图案的数量
    const patternCount = {};
    this.slot.forEach(item => {
      patternCount[item.pattern] = (patternCount[item.pattern] || 0) + 1;
    });
    
    // 找到数量达到3的图案
    let eliminated = false;
    for (const [pattern, count] of Object.entries(patternCount)) {
      if (count >= 3) {
        // 消除3个
        let removeCount = 3;
        this.slot = this.slot.filter(item => {
          if (item.pattern === pattern && removeCount > 0) {
            removeCount--;
            return false;
          }
          return true;
        });
        eliminated = true;
        UI.playEliminateAnimation(pattern);
        break; // 每次只消除一组
      }
    }
    
    // 如果消除了，可能还能继续消除
    if (eliminated) {
      setTimeout(() => this.checkAndEliminate(), 300);
    }
  },
  
  /**
   * 检查游戏状态（胜利/失败）
   */
  checkGameState() {
    // 检查是否通关：所有方块都被移除
    const remaining = this.blocks.filter(b => !b.removed);
    if (remaining.length === 0 && this.slot.length === 0) {
      this.gameWin();
      return;
    }
    
    // 延迟检查（等消除动画完成）
    setTimeout(() => {
      const remainingAfter = this.blocks.filter(b => !b.removed);
      if (remainingAfter.length === 0 && this.slot.length === 0) {
        this.gameWin();
        return;
      }
      
      // 检查是否失败：槽满且无法消除
      if (this.slot.length >= this.maxSlot) {
        const patternCount = {};
        this.slot.forEach(item => {
          patternCount[item.pattern] = (patternCount[item.pattern] || 0) + 1;
        });
        const canEliminate = Object.values(patternCount).some(c => c >= 3);
        if (!canEliminate) {
          this.gameFail();
        }
      }
    }, 400);
  },
  
  /**
   * 游戏通关
   */
  gameWin() {
    clearInterval(this.timerInterval);
    const time = this.elapsedTime;
    
    // 保存记录
    this.saveBestTime(this.currentLevel, time);
    
    // 显示通关弹窗
    setTimeout(() => {
      UI.showWinModal(this.currentLevel, time);
    }, 500);
  },
  
  /**
   * 游戏失败
   */
  gameFail() {
    clearInterval(this.timerInterval);
    
    setTimeout(() => {
      UI.showFailModal(this.currentLevel);
    }, 500);
  },
  
  /**
   * 道具：撤回
   */
  useUndo() {
    if (this.undoUsed || !this.lastSlotBlock) return;
    
    this.undoUsed = true;
    const block = this.blocks.find(b => b.id === this.lastSlotBlock.id);
    if (block) {
      block.removed = false;
      // 从槽中移除
      this.slot = this.slot.filter(s => s.id !== this.lastSlotBlock.id);
      this.lastSlotBlock = null;
      this.updateBlockedStatus();
      UI.renderGame(this);
    }
  },
  
  /**
   * 道具：洗牌
   */
  useShuffle() {
    if (this.shuffleUsed) return;
    
    this.shuffleUsed = true;
    const level = LEVELS[this.currentLevel];
    
    // 收集未移除的方块
    const remaining = this.blocks.filter(b => !b.removed);
    
    // 重新生成位置
    for (let layer = 0; layer < level.layers; layer++) {
      const layerBlocks = remaining.filter(b => b.layer === layer);
      const positions = generateLayerPositions(
        layerBlocks.length,
        level.gridCols,
        level.gridRows,
        layer
      );
      layerBlocks.forEach((block, i) => {
        block.gridX = positions[i].x;
        block.gridY = positions[i].y;
      });
    }
    
    // 重新建立遮挡关系
    this.buildBlockerRelations();
    this.updateBlockedStatus();
    UI.renderGame(this);
  },
  
  /**
   * 保存最佳时间到本地存储
   */
  saveBestTime(levelIndex, time) {
    const key = 'xiaoxiaole_best_times';
    let bestTimes = JSON.parse(localStorage.getItem(key) || '{}');
    const levelKey = `level_${levelIndex}`;
    
    if (!bestTimes[levelKey] || time < bestTimes[levelKey]) {
      bestTimes[levelKey] = time;
      localStorage.setItem(key, JSON.stringify(bestTimes));
    }
  },
  
  /**
   * 获取最佳时间
   */
  getBestTime(levelIndex) {
    const key = 'xiaoxiaole_best_times';
    const bestTimes = JSON.parse(localStorage.getItem(key) || '{}');
    return bestTimes[`level_${levelIndex}`] || null;
  },
  
  /**
   * 停止游戏
   */
  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },
};
