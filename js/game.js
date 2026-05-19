/**
 * 核心游戏逻辑
 * 处理方块状态、遮挡判定、收集槽、消除逻辑
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
  blockSize: 52,      // 方块大小（px）
  layerOffset: 8,     // 层间偏移（px）
  
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
    
    // 计算遮挡关系
    this.updateBlockedStatus();
    
    // 渲染
    UI.renderGame(this);
  },
  
  /**
   * 更新方块遮挡状态
   * 如果上层方块与下层方块有位置重叠，则下层方块被遮挡
   */
  updateBlockedStatus() {
    const level = LEVELS[this.currentLevel];
    
    this.blocks.forEach(block => {
      block.blocked = false;
      if (block.removed) return;
      
      // 检查是否有更高层的方块遮挡当前方块
      this.blocks.forEach(other => {
        if (other.removed || other.id === block.id) return;
        if (other.layer <= block.layer) return; // 只检查上层
        
        // 判断位置是否重叠（考虑偏移）
        const overlap = this.checkOverlap(block, other);
        if (overlap) {
          block.blocked = true;
        }
      });
    });
  },
  
  /**
   * 检查两个方块是否位置重叠
   */
  checkOverlap(blockA, blockB) {
    // 计算实际像素位置
    const posA = this.getBlockPosition(blockA);
    const posB = this.getBlockPosition(blockB);
    
    const size = this.blockSize;
    const overlapThreshold = size * 0.3; // 30% 重叠即认为遮挡
    
    const overlapX = Math.max(0, 
      Math.min(posA.x + size, posB.x + size) - Math.max(posA.x, posB.x)
    );
    const overlapY = Math.max(0, 
      Math.min(posA.y + size, posB.y + size) - Math.max(posA.y, posB.y)
    );
    
    return overlapX > overlapThreshold && overlapY > overlapThreshold;
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
    
    // 更新遮挡关系
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
    const allPositions = [];
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
