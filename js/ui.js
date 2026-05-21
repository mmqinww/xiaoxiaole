/**
 * UI交互、动画、分享
 * 处理页面切换、渲染、动画效果
 */

const UI = {
  // 页面元素缓存
  pages: {},
  
  /**
   * 初始化UI
   */
  init() {
    this.pages = {
      start: document.getElementById('page-start'),
      levels: document.getElementById('page-levels'),
      game: document.getElementById('page-game'),
    };
    
    // 绑定开始按钮
    document.getElementById('btn-start').addEventListener('click', () => {
      this.showPage('levels');
      this.renderLevelSelect();
    });
    
    // 绑定返回按钮
    document.getElementById('btn-back').addEventListener('click', () => {
      Game.stop();
      this.showPage('levels');
      this.renderLevelSelect();
    });
    
    // 绑定道具按钮
    document.getElementById('btn-undo').addEventListener('click', () => {
      Game.useUndo();
    });
    document.getElementById('btn-shuffle').addEventListener('click', () => {
      Game.useShuffle();
    });
    
    // 显示开始页面
    this.showPage('start');
  },
  
  /**
   * 切换页面
   */
  showPage(pageName) {
    Object.values(this.pages).forEach(p => p.classList.remove('active'));
    this.pages[pageName].classList.add('active');
  },
  
  /**
   * 渲染关卡选择
   */
  renderLevelSelect() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';

    // Group levels into rows of 2 per shelf
    const COLS = 2;
    for (let i = 0; i < LEVELS.length; i += COLS) {
      const row = document.createElement('div');
      row.className = 'shelf-row';

      const rowLevels = LEVELS.slice(i, i + COLS);
      rowLevels.forEach((level, j) => {
        const index = i + j;
        const bestTime = Game.getBestTime(index);
        const bestTimeText = bestTime ? `🏆 ${bestTime}s` : '🏆 --';
        const basketAsset = level.basket || 'basket-1';

        const card = document.createElement('div');
        card.className = 'level-card';
        card.dataset.levelId = level.id;

        card.innerHTML = `
          <div class="level-basket">
            <img src="assets/${basketAsset}.png" alt="" class="basket-img">
            <div class="level-badge">${level.name}</div>
            <div class="level-best">${bestTimeText}</div>
          </div>
        `;

        card.addEventListener('click', () => {
          this.showPage('game');
          Game.startLevel(index);
        });

        row.appendChild(card);
      });

      const plank = document.createElement('div');
      plank.className = 'shelf-plank';
      row.appendChild(plank);

      grid.appendChild(row);
    }
  },
  
  /**
   * 渲染游戏界面
   */
  renderGame(game) {
    this.renderBlocks(game);
    this.renderSlot(game);
    this.updatePowerups(game);
    this.updateLevelInfo(game);
  },
  
  /**
   * 渲染方块区域
   */
  renderBlocks(game) {
    const container = document.getElementById('blocks-container');
    container.innerHTML = '';
    
    const level = LEVELS[game.currentLevel];
    
    // 计算容器的原始大小（基于最大可能坐标）
    // 需要考虑半格偏移的牌，最大坐标可能是 gridCols - 0.5
    const gap = 2;
    const step = game.blockSize + gap;
    const containerWidth = (level.gridCols) * step + game.blockSize;
    const containerHeight = (level.gridRows) * step + game.blockSize;
    
    // 获取可用空间，确保不超出手机屏幕
    const blocksArea = document.querySelector('.blocks-area');
    const availableWidth = blocksArea.clientWidth - 16; // 留点边距
    const availableHeight = blocksArea.clientHeight - 16;
    
    // 计算缩放比例，确保整个牌堆在可视区域内
    const scaleX = availableWidth / containerWidth;
    const scaleY = availableHeight / containerHeight;
    const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小
    
    container.style.width = containerWidth + 'px';
    container.style.height = containerHeight + 'px';
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'center center';
    
    // 按层排序渲染（低层先渲染）
    const sortedBlocks = [...game.blocks]
      .filter(b => !b.removed)
      .sort((a, b) => a.layer - b.layer);
    
    sortedBlocks.forEach(block => {
      const pos = game.getBlockPosition(block);
      const el = document.createElement('div');
      el.className = 'block';
      el.dataset.id = block.id;
      
      if (block.blocked) {
        el.classList.add('blocked');
      } else {
        el.classList.add('clickable');
        el.addEventListener('click', () => {
          Game.clickBlock(block.id);
        });
      }
      
      // 设置层级（z-index）
      el.style.zIndex = block.layer * 10 + 1;
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.style.width = game.blockSize + 'px';
      el.style.height = game.blockSize + 'px';
      
      el.innerHTML = `<span class="block-emoji">${block.pattern}</span>`;
      
      container.appendChild(el);
    });
  },
  
  /**
   * 渲染收集槽
   */
  renderSlot(game) {
    const slotContainer = document.getElementById('slot-container');
    slotContainer.innerHTML = '';
    
    for (let i = 0; i < game.maxSlot; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'slot-item';
      
      if (game.slot[i]) {
        slotEl.classList.add('filled');
        slotEl.innerHTML = `<span class="slot-emoji">${game.slot[i].pattern}</span>`;
      }
      
      slotContainer.appendChild(slotEl);
    }
  },
  
  /**
   * 更新道具按钮状态
   */
  updatePowerups(game) {
    const undoBtn = document.getElementById('btn-undo');
    const shuffleBtn = document.getElementById('btn-shuffle');
    
    undoBtn.disabled = game.undoUsed;
    shuffleBtn.disabled = game.shuffleUsed;
    
    if (game.undoUsed) undoBtn.classList.add('used');
    else undoBtn.classList.remove('used');
    
    if (game.shuffleUsed) shuffleBtn.classList.add('used');
    else shuffleBtn.classList.remove('used');
  },
  
  /**
   * 更新关卡信息
   */
  updateLevelInfo(game) {
    const level = LEVELS[game.currentLevel];
    document.getElementById('level-title').textContent = level.name + ' ' + level.desc;
    
    const remaining = game.blocks.filter(b => !b.removed).length;
    document.getElementById('blocks-remaining').textContent = `剩余: ${remaining}`;
  },
  
  /**
   * 更新计时器
   */
  updateTimer(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    document.getElementById('timer').textContent = 
      `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  },
  
  /**
   * 方块飞入槽位动画
   */
  animateBlockToSlot(block, callback) {
    const blockEl = document.querySelector(`.block[data-id="${block.id}"]`);
    if (!blockEl) {
      callback();
      return;
    }
    
    const slotContainer = document.getElementById('slot-container');
    const slotRect = slotContainer.getBoundingClientRect();
    const blockRect = blockEl.getBoundingClientRect();
    
    // 创建飞行克隆
    const clone = blockEl.cloneNode(true);
    clone.classList.add('flying');
    clone.style.position = 'fixed';
    clone.style.left = blockRect.left + 'px';
    clone.style.top = blockRect.top + 'px';
    clone.style.zIndex = '1000';
    clone.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    document.body.appendChild(clone);
    
    // 隐藏原方块
    blockEl.style.opacity = '0';
    
    // 飞向槽位
    requestAnimationFrame(() => {
      clone.style.left = (slotRect.left + slotRect.width / 2 - 20) + 'px';
      clone.style.top = (slotRect.top) + 'px';
      clone.style.transform = 'scale(0.7)';
    });
    
    setTimeout(() => {
      clone.remove();
      callback();
    }, 350);
  },
  
  /**
   * 播放消除动画
   */
  playEliminateAnimation(pattern) {
    const slotItems = document.querySelectorAll('.slot-item.filled');
    slotItems.forEach(item => {
      if (item.querySelector('.slot-emoji')?.textContent === pattern) {
        item.classList.add('eliminating');
      }
    });
    
    setTimeout(() => {
      document.querySelectorAll('.eliminating').forEach(el => {
        el.classList.remove('eliminating');
      });
    }, 400);
  },
  
  /**
   * 显示通关弹窗
   */
  showWinModal(levelIndex, time) {
    const level = LEVELS[levelIndex];
    const shareText = `我${time}秒通关了「消了个消」${level.name} 🏆\n说实话这关有点难，你应该过不了…\n试试看？👉 https://mmqinww.github.io/xiaoxiaole/`;
    
    this.showModal({
      title: '🎉 恭喜通关！',
      content: `
        <div class="modal-result win">
          <div class="modal-emoji">🎊</div>
          <div class="modal-time">用时 ${time} 秒</div>
          <div class="modal-level">${level.name} ${level.desc}</div>
        </div>
      `,
      shareText: shareText,
      buttons: [
        { text: '再来一次', action: () => { this.closeModal(); Game.startLevel(levelIndex); } },
        { text: '下一关', action: () => { 
          this.closeModal();
          if (levelIndex < LEVELS.length - 1) {
            Game.startLevel(levelIndex + 1);
          } else {
            this.showPage('levels');
            this.renderLevelSelect();
          }
        }},
        { text: '返回', action: () => { this.closeModal(); this.showPage('levels'); this.renderLevelSelect(); } },
      ]
    });
  },
  
  /**
   * 显示失败弹窗
   */
  showFailModal(levelIndex) {
    const level = LEVELS[levelIndex];
    const shareText = `我卡在「消了个消」${level.name}了 😤\n这关真的有点阴间，但我不信你能过…\n来试试？👉 https://mmqinww.github.io/xiaoxiaole/`;
    
    this.showModal({
      title: '😵 游戏结束',
      content: `
        <div class="modal-result fail">
          <div class="modal-emoji">💔</div>
          <div class="modal-level">${level.name} ${level.desc}</div>
          <div class="modal-tip">收集槽已满，无法消除</div>
        </div>
      `,
      shareText: shareText,
      buttons: [
        { text: '再试一次', action: () => { this.closeModal(); Game.startLevel(levelIndex); } },
        { text: '返回', action: () => { this.closeModal(); this.showPage('levels'); this.renderLevelSelect(); } },
      ]
    });
  },
  
  /**
   * 显示通用弹窗
   */
  showModal({ title, content, shareText, buttons }) {
    // 移除旧弹窗
    this.closeModal();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'game-modal';
    
    let buttonsHtml = buttons.map((btn, i) => 
      `<button class="modal-btn ${i === 0 ? 'primary' : ''}" data-index="${i}">${btn.text}</button>`
    ).join('');
    
    let shareHtml = shareText ? `
      <div class="share-section">
        <textarea class="share-text" readonly>${shareText}</textarea>
        <button class="share-btn" id="btn-copy-share">📋 复制分享文案</button>
      </div>
    ` : '';
    
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">${title}</div>
        ${content}
        ${shareHtml}
        <div class="modal-buttons">${buttonsHtml}</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // 绑定按钮事件
    overlay.querySelectorAll('.modal-btn').forEach(btn => {
      const index = parseInt(btn.dataset.index);
      btn.addEventListener('click', buttons[index].action);
    });
    
    // 绑定复制按钮
    const copyBtn = overlay.querySelector('#btn-copy-share');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const textarea = overlay.querySelector('.share-text');
        textarea.select();
        document.execCommand('copy');
        copyBtn.textContent = '✅ 已复制!';
        setTimeout(() => { copyBtn.textContent = '📋 复制分享文案'; }, 2000);
      });
    }
    
    // 动画进入
    requestAnimationFrame(() => overlay.classList.add('show'));
  },
  
  /**
   * 关闭弹窗
   */
  closeModal() {
    const modal = document.getElementById('game-modal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 200);
    }
  },
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  UI.init();
});
