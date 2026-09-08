/* 启航 CareerStart Web 客户端全功能交互控制 (大屏+实时渲染增强) */

const app = {
  currentTab: 'home',
  selectedPlan: 'quarter',
  assessStep: 0,
  userAnswers: {
    persona: '',
    interests: [],
    skills: [],
    traits: { logic: 5, creative: 5, social: 5, exec: 5, leader: 5, handcraft: 5 },
    prefs: []
  },
  userData: {
    isVip: false,
    vipPlan: null,
    vipExpiry: null,
    assessmentHistory: [],
    resumeHistory: [],
    interviewHistory: [],
    lastAssessment: null,
    usage: {
      resumeCheck: 0,  // 已使用简历诊断次数
      interview: 0     // 已使用模拟面试次数
    }
  },

  init() {
    this.loadUserData();
    this.checkAuth();
    this.updateAuthUI();
    this.bindEvents();
    this.renderHomePraises();
    this.renderCourses('all');
    this.renderAssessStep();
    this.updateUserDisplay();
    this.updateHomePreview();
    this.updateHomeCoaching();
    this.initShareButtons();

    // 移除防闪烁内联样式
    const antiFlash = document.getElementById('anti-flash');
    if (antiFlash) antiFlash.remove();

    // 刷新后从hash恢复当前页面
    const validTabs = ['home','assess','tools','coaching','me'];
    const hash = location.hash.replace('#','');
    const initialTab = validTabs.includes(hash) ? hash : 'home';
    this.switchTab(initialTab);

    // 监听浏览器前进/后退
    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#','');
      const tab = validTabs.includes(h) ? h : 'home';
      if (tab !== this.currentTab) this.switchTab(tab);
    });
  },

  // 初始化分享按钮
  initShareButtons() {
    const shareData = {
      title: '启航 CareerStart - 35+女性与宝妈职业启航平台',
      text: '专为35+女性与全职宝妈打造的职业启航平台。6维AI测评、年龄友好岗位库、免费技能课程。',
      url: 'https://logos6.github.io/careerstart-web/'
    };

    // 小红书分享
    window.shareToXiaohongshu = function() {
      const text = encodeURIComponent(`${shareData.title}\n\n${shareData.text}\n\n👉 ${shareData.url}`);
      window.open(`https://www.xiaohongshu.com/share?text=${text}`, '_blank');
    };

    // 知乎分享
    window.shareToZhihu = function() {
      const title = encodeURIComponent(shareData.title);
      const url = encodeURIComponent(shareData.url);
      window.open(`https://www.zhihu.com/share?url=${url}&title=${title}`, '_blank');
    };

    // 微信分享（复制链接）
    window.shareToWechat = function() {
      navigator.clipboard.writeText(shareData.url).then(() => {
        alert('链接已复制！请粘贴到微信分享给好友');
      }).catch(() => {
        prompt('请复制链接分享到微信：', shareData.url);
      });
    };

    // 微博分享
    window.shareToWeibo = function() {
      const text = encodeURIComponent(`${shareData.title} ${shareData.url}`);
      window.open(`https://service.weibo.com/share/share.php?title=${text}`, '_blank');
    };
  },

  // 加载用户数据
  loadUserData() {
    try {
      const saved = localStorage.getItem('careerstart_user_data');
      if (saved) {
        this.userData = { ...this.userData, ...JSON.parse(saved) };
      }
      const answers = localStorage.getItem('careerstart_answers');
      if (answers) {
        this.userAnswers = { ...this.userAnswers, ...JSON.parse(answers) };
      }
    } catch (e) {
      console.log('加载用户数据失败:', e);
    }
  },

  // 保存用户数据
  saveUserData() {
    try {
      localStorage.setItem('careerstart_user_data', JSON.stringify(this.userData));
      localStorage.setItem('careerstart_answers', JSON.stringify(this.userAnswers));
    } catch (e) {
      console.log('保存用户数据失败:', e);
    }
  },

  // 更新用户显示
  updateUserDisplay() {
    const levelEl = document.getElementById('me-level');
    const vipTag = document.getElementById('me-vip-tag');
    const statAssess = document.getElementById('stat-assess');
    const statResume = document.getElementById('stat-resume');
    const historyList = document.getElementById('me-history-list');
    const nicknameEl = document.querySelector('.p-info-main h2');
    
    // 更新昵称显示
    if (this.currentUser) {
      if (nicknameEl) nicknameEl.innerText = this.currentUser.nickname || '启航用户';
    } else {
      if (nicknameEl) nicknameEl.innerText = '启航用户（未登录）';
    }
    
    if (this.userData.isVip) {
      if (levelEl) levelEl.innerText = 'Lv.2 启航会员';
      if (vipTag) {
        vipTag.innerText = `${this.getPlanName(this.userData.vipPlan)} (生效中)`;
        vipTag.style.background = '#fbbf24';
        vipTag.style.color = '#1e293b';
      }
    }

    // 更新统计数据
    if (statAssess) statAssess.innerText = this.userData.assessmentHistory.length;
    if (statResume) statResume.innerText = this.userData.resumeHistory.length;

    // 渲染历史记录
    if (historyList && this.userData.assessmentHistory.length > 0) {
      const recent = this.userData.assessmentHistory.slice(-5).reverse();
      historyList.innerHTML = recent.map(h => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:8px; margin-bottom:8px;">
          <div>
            <strong>${h.topJob}</strong>
            <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">${new Date(h.date).toLocaleDateString('zh-CN')}</span>
          </div>
          <span style="color:var(--primary); font-weight:600;">${h.score}% 匹配</span>
        </div>
      `).join('');
    }
  },

  // 更新首页右侧预览卡片（用真实测评数据替换默认示范）
  updateHomePreview() {
    try {
      if (!this.userData.assessmentHistory || this.userData.assessmentHistory.length === 0) return;

      const latest = this.userData.assessmentHistory[this.userData.assessmentHistory.length - 1];
      const report = CareerEngine.buildReport(latest.answers || {});
      const top1 = report.top[0];
      const topTags = report.top.slice(0, 3);

      const scoreEl = document.getElementById('home-preview-score');
      const jobEl = document.getElementById('home-preview-job');
      const descEl = document.getElementById('home-preview-desc');
      const tagsEl = document.getElementById('home-preview-tags');
      const labelEl = document.getElementById('home-preview-label');
      const barsEl = document.getElementById('home-preview-bars');

      if (scoreEl) scoreEl.innerText = `匹配度 ${top1.total}%`;
      if (jobEl) jobEl.innerText = top1.job.name;
      if (descEl) descEl.innerText = top1.job.desc;
      if (labelEl) labelEl.innerText = '你的测评结果';

      if (tagsEl) {
        tagsEl.innerHTML = topTags.map(t =>
          `<span class="pc-tag">${t.job.name} ${t.total}%</span>`
        ).join('');
      }

      if (barsEl) {
        barsEl.innerHTML = report.top.slice(0, 3).map(t =>
          `<div class="m-bar-item"><span>${t.job.name}</span><div class="m-bar"><div class="m-fill" style="width:${t.total}%"></div></div></div>`
        ).join('');
      }
    } catch (e) {
      console.error('[updateHomePreview Error]', e);
    }
  },

  updateHomeCoaching() {
    try {
      const phasesEl = document.getElementById('hero-coaching-phases');
      if (!phasesEl) return;

      const hasAssessment = this.userData.assessmentHistory && this.userData.assessmentHistory.length > 0;
      let phases;

      if (hasAssessment) {
        const latest = this.userData.assessmentHistory[this.userData.assessmentHistory.length - 1];
        const report = CareerEngine.buildReport(latest.answers || {});
        const top1 = report.top[0];
        const jobName = top1 ? top1.job.name : '目标岗位';

        phases = [
          { num: 1, title: `第1周：评估「${jobName}」转型路径` },
          { num: 2, title: '第2周：简历重塑与作品集' },
          { num: 3, title: '第3周：技能速成 + 实战' },
          { num: 4, title: '第4周：投递冲刺拿offer' },
        ];
      } else {
        phases = [
          { num: 1, title: '第1周：测评 + 职业定位' },
          { num: 2, title: '第2周：简历重塑 + 作品集' },
          { num: 3, title: '第3周：技能速成 + 实战' },
          { num: 4, title: '第4周：投递冲刺拿offer' },
        ];
      }

      phasesEl.innerHTML = phases.map(p => `
        <div class="hc-phase-item">
          <div class="hc-phase-num">${p.num}</div>
          <span>${p.title}</span>
        </div>
      `).join('');
    } catch (e) {
      console.error('[updateHomeCoaching Error]', e);
    }
  },

  openCoachingModal(tier) {
    const modal = document.getElementById('coaching-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      // 设置默认选中版本
      if (tier) {
        const input = document.getElementById('coaching-tier');
        if (input) input.value = tier;
        document.querySelectorAll('.tier-option').forEach(el => {
          el.style.borderColor = 'var(--border-color)';
          el.style.background = 'none';
        });
        const labels = document.querySelectorAll('.tier-option');
        const map = { light: 0, standard: 1, premium: 2 };
        if (labels[map[tier]]) {
          labels[map[tier]].style.borderColor = 'var(--primary)';
          labels[map[tier]].style.background = 'linear-gradient(135deg,#f8f5ff,#eef2ff)';
        }
      }
    } else {
      this.openVipModal();
    }
  },

  selectTier(el, tier) {
    document.getElementById('coaching-tier').value = tier;
    document.querySelectorAll('.tier-option').forEach(e => {
      e.style.borderColor = 'var(--border-color)';
      e.style.background = 'none';
    });
    el.style.borderColor = 'var(--primary)';
    el.style.background = 'linear-gradient(135deg,#f8f5ff,#eef2ff)';
  },

  getPlanName(plan) {
    const names = { month: '月度会员', quarter: '启航季卡', year: '全年无限卡' };
    return names[plan] || '会员';
  },

  bindEvents() {
    document.querySelectorAll('.desktop-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        this.switchTab(target);
      });
    });

    document.querySelectorAll('#course-category-tabs .pc-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#course-category-tabs .pc-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderCourses(btn.dataset.cat);
      });
    });
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    // 同步URL hash，刷新后可恢复
    if (location.hash !== '#' + tabName) {
      history.replaceState(null, '', '#' + tabName);
    }
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) targetView.classList.add('active');

    document.querySelectorAll('.desktop-nav .nav-item').forEach(btn => {
      if (btn.dataset.target === tabName) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // 切换到测评页面时，检查是否有上次结果
    if (tabName === 'assess') {
      const resultView = document.getElementById('assess-result-view');
      const pcLayout = document.querySelector('.assess-pc-layout');
      if (this.userData.lastAssessment) {
        // 有上次结果，直接展示
        this.showLastAssessmentResult();
      } else {
        // 没有历史结果，显示答题界面
        if (resultView) resultView.style.display = 'none';
        if (pcLayout) pcLayout.style.display = 'grid';
        this.assessStep = 0;
        this.renderAssessStep();
        this.updateCompetitiveAnalysis();
      }
    }

    if (tabName === 'home') {
      if (!this.userData.assessmentHistory || this.userData.assessmentHistory.length === 0) {
        const scoreEl = document.getElementById('home-preview-score');
        const jobEl = document.getElementById('home-preview-job');
        const descEl = document.getElementById('home-preview-desc');
        const tagsEl = document.getElementById('home-preview-tags');
        const labelEl = document.getElementById('home-preview-label');
        const barsEl = document.getElementById('home-preview-bars');
        if (scoreEl) scoreEl.innerText = '匹配度 --';
        if (jobEl) jobEl.innerText = '完成测评后查看';
        if (descEl) descEl.innerText = '点击左侧「一键精准匹配」开始6维AI测评';
        if (labelEl) labelEl.innerText = '你的测评结果';
        if (tagsEl) tagsEl.innerHTML = '';
        if (barsEl) barsEl.innerHTML = '';
      } else {
        this.updateHomePreview();
        this.updateHomeCoaching();
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // 2. 学员口碑
  renderHomePraises() {
    const container = document.getElementById('home-praises-grid');
    if (!container) return;

    const praises = [
      { name: "李姐 (38岁)", tag: "二胎妈妈成功转型", text: "断崖式离职后非常迷茫，通过启航测出了自己在逻辑与协调上的优势，目前已成功入职社区管家，兼顾接送孩子！" },
      { name: "张女士 (42岁)", tag: "传统行政转型", text: "之前以为年纪大了没人要，诊断了简历排除隐性门槛后，投递一周收到了 3 个面试邀请！" },
      { name: "陈女士 (36岁)", tag: "前教培老师", text: "充电站里推荐的 B 站课程非常实用，跟着学了 Excel 高阶与数据分析，顺利转型数据专员。" }
    ];

    container.innerHTML = praises.map(p => `
      <div class="pc-praise-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <strong style="font-size:16px;">${p.name}</strong>
          <span style="font-size:12px; background:#f3e8ff; color:#7d2ae8; padding:3px 10px; border-radius:12px; font-weight:600;">${p.tag}</span>
        </div>
        <p style="font-size:14px; color:var(--text-muted); line-height:1.6;">"${p.text}"</p>
      </div>
    `).join('');
  },

  // 4. 渲染课程库
  renderCourses(cat) {
    const container = document.getElementById('courses-container');
    if (!container) return;

    let courses = CareerData.COURSES;
    if (cat && cat !== 'all') {
      courses = courses.filter(c => c.cat.includes(cat));
    }

    container.innerHTML = courses.map(c => `
      <div class="pc-job-card">
        <div>
          <div style="font-size:16px; font-weight:700; margin-bottom:6px;">${c.title}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">${c.cat} · ${c.hot || '热度推荐'}</div>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">${c.sub || c.desc}</p>
        </div>
        <a href="${c.url || 'https://www.bilibili.com'}" target="_blank" class="btn btn-primary btn-block" style="text-decoration:none;">
          <i class="ri-play-circle-line"></i> 直达 B 站免费观看
        </a>
      </div>
    `).join('');
  },

  // 5. 测评流程控制
  renderAssessStep() {
    const wrapper = document.getElementById('assess-options-wrapper');
    const title = document.getElementById('assess-step-title');
    const label = document.getElementById('assess-step-label');
    const pct = document.getElementById('assess-step-pct');
    const fill = document.getElementById('assess-progress-fill');
    const prevBtn = document.getElementById('btn-assess-prev');
    const nextBtn = document.getElementById('btn-assess-next');
    if (!wrapper) return;

    prevBtn.style.display = this.assessStep > 0 ? 'inline-flex' : 'none';
    label.innerText = `步骤 ${this.assessStep + 1} / 5`;
    const curPct = (this.assessStep + 1) * 20;
    pct.innerText = `${curPct}% 完成`;
    fill.style.width = `${curPct}%`;

    nextBtn.innerHTML = `下一步 <i class="ri-arrow-right-line"></i>`;

    switch(this.assessStep) {
      case 0:
        title.innerText = "请选择你的当前身份定位";
        wrapper.innerHTML = `
          <div class="pc-opt-grid">
            <div class="pc-opt-card ${this.userAnswers.persona==='mid'?'active':''}" onclick="app.setAnswer('persona', 'mid')">
              <h4>35+ 重新出发</h4>
              <p>具备丰富职场经验与阅历，寻求转型与职业突破</p>
            </div>
            <div class="pc-opt-card ${this.userAnswers.persona==='mom'?'active':''}" onclick="app.setAnswer('persona', 'mom')">
              <h4>宝妈重返职场</h4>
              <p>希望兼顾家庭与工作，偏好灵活工时与弹性岗位</p>
            </div>
          </div>
        `;
        break;

      case 1:
        title.innerText = "请选择你感兴趣的领域（可多选）";
        this._interestCatIdx = this._interestCatIdx || 0;
        wrapper.innerHTML = `
          <div class="lr-layout">
            <div class="lr-sidebar" id="interest-cat-list">
              ${CareerData.INTEREST_GROUPS.map((g, i) => `
                <div class="lr-cat-item ${i===this._interestCatIdx?'active':''}" onclick="app._interestCatIdx=${i};app.renderAssessStep();">
                  <span class="lr-cat-name">${g.cat}</span>
                  <span class="lr-cat-count">${g.items.length}</span>
                </div>
              `).join('')}
            </div>
            <div class="lr-main">
              <div class="lr-main-title">${CareerData.INTEREST_GROUPS[this._interestCatIdx].cat}</div>
              <div class="pc-opt-grid cols-4">
                ${CareerData.INTEREST_GROUPS[this._interestCatIdx].items.map(item => `
                  <div class="pc-opt-card ${this.userAnswers.interests.includes(item.id)?'active':''}" onclick="app.toggleArrayAnswer('interests', '${item.id}')">
                    <h4>${item.label}</h4>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
        break;

      case 2:
        title.innerText = "请选择你目前具备或擅长的技能项";
        this._skillCatIdx = this._skillCatIdx || 0;
        wrapper.innerHTML = `
          <div class="lr-layout">
            <div class="lr-sidebar" id="skill-cat-list">
              ${CareerData.SKILL_GROUPS.map((g, i) => `
                <div class="lr-cat-item ${i===this._skillCatIdx?'active':''}" onclick="app._skillCatIdx=${i};app.renderAssessStep();">
                  <span class="lr-cat-name">${g.group}</span>
                  <span class="lr-cat-count">${g.items.length}</span>
                </div>
              `).join('')}
            </div>
            <div class="lr-main">
              <div class="lr-main-title">${CareerData.SKILL_GROUPS[this._skillCatIdx].group}</div>
              <div class="pc-opt-grid cols-4">
                ${CareerData.SKILL_GROUPS[this._skillCatIdx].items.map(item => `
                  <div class="pc-opt-card ${this.userAnswers.skills.includes(item.id)?'active':''}" onclick="app.toggleArrayAnswer('skills', '${item.id}')">
                    <h4>${item.label}</h4>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
        break;

      case 3:
        title.innerText = "评估你的6维核心能力得分（1-10分）";
        wrapper.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;">
            ${CareerData.TRAITS.map(t => `
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <strong>${t.label}</strong>
                  <span id="trait-val-${t.id}" style="color:var(--primary); font-weight:700;">${this.userAnswers.traits[t.id]} 分</span>
                </div>
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${t.desc}</p>
                <input type="range" min="1" max="10" value="${this.userAnswers.traits[t.id]}" style="width:100%;" oninput="app.userAnswers.traits['${t.id}']=parseInt(this.value,10); document.getElementById('trait-val-${t.id}').textContent=this.value+' 分';">
              </div>
            `).join('')}
          </div>
        `;
        break;

      case 4:
        title.innerText = "请选择你的求职工作偏好";
        this._prefCatIdx = this._prefCatIdx || 0;
        wrapper.innerHTML = `
          <div class="lr-layout">
            <div class="lr-sidebar" id="pref-cat-list">
              ${CareerData.PREF_GROUPS.map((g, i) => `
                <div class="lr-cat-item ${i===this._prefCatIdx?'active':''}" onclick="app._prefCatIdx=${i};app.renderAssessStep();">
                  <span class="lr-cat-name">${g.cat}</span>
                  <span class="lr-cat-count">${g.items.length}</span>
                </div>
              `).join('')}
            </div>
            <div class="lr-main">
              <div class="lr-main-title">${CareerData.PREF_GROUPS[this._prefCatIdx].cat}</div>
              <div class="pc-opt-grid cols-4">
                ${CareerData.PREF_GROUPS[this._prefCatIdx].items.map(item => `
                  <div class="pc-opt-card ${this.userAnswers.prefs.includes(item.id)?'active':''}" onclick="app.toggleArrayAnswer('prefs', '${item.id}')">
                    <h4>${item.label}</h4>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
        nextBtn.innerHTML = `生成大屏分析报告 <i class="ri-sparkles-line"></i>`;
        break;
    }
  },

  setAnswer(key, val) {
    this.userAnswers[key] = val;
    this.renderAssessStep();
    this.updateCompetitiveAnalysis();
  },

  toggleArrayAnswer(key, id) {
    const list = this.userAnswers[key];
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(id);
    this.renderAssessStep();
    this.updateCompetitiveAnalysis();
  },

  setTraitScore(traitId, val) {
    this.userAnswers.traits[traitId] = parseInt(val, 10);
    this.updateCompetitiveAnalysis();
  },

  nextStep() {
    if (this.assessStep < 4) {
      this.assessStep++;
      this.renderAssessStep();
      this.updateCompetitiveAnalysis();
    } else {
      if (this._generatingReport) return;
      this._generatingReport = true;
      this.showLoadingThenReport();
    }
  },

  // 加载动画 → 报告过渡
  showLoadingThenReport() {
    const pcLayout = document.querySelector('.assess-pc-layout');
    if (pcLayout) pcLayout.style.display = 'none';

    // 创建加载动画覆盖层
    const overlay = document.createElement('div');
    overlay.id = 'report-loading-overlay';
    overlay.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; animation: fadeIn 0.4s ease;">
        <div style="position:relative; width:80px; height:80px; margin-bottom:28px;">
          <div style="position:absolute; inset:0; border:4px solid #e2e8f0; border-radius:50%;"></div>
          <div style="position:absolute; inset:0; border:4px solid transparent; border-top-color:#7c3aed; border-radius:50%; animation:spin 1s linear infinite;"></div>
          <div style="position:absolute; inset:8px; border:4px solid transparent; border-top-color:#a78bfa; border-radius:50%; animation:spin 1.5s linear infinite reverse;"></div>
          <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
            <i class="ri-brain-line" style="font-size:28px; color:#7c3aed;"></i>
          </div>
        </div>
        <div style="font-size:20px; font-weight:700; color:#1f2937; margin-bottom:10px;">AI 正在深度分析中</div>
        <div style="font-size:14px; color:#6b7280; text-align:center; line-height:1.8;">
          <div id="loading-step-text">正在匹配岗位数据库...</div>
          <div style="margin-top:12px; width:200px; height:4px; background:#e2e8f0; border-radius:2px; overflow:hidden;">
            <div id="loading-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#7c3aed,#a78bfa); border-radius:2px; transition:width 0.6s ease;"></div>
          </div>
        </div>
      </div>
    `;
    overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(255,255,255,0.95); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center;';
    document.body.appendChild(overlay);

    // 进度动画序列
    const steps = [
      { text: '正在匹配岗位数据库...', pct: 20 },
      { text: '正在分析兴趣聚类...', pct: 40 },
      { text: '正在计算技能覆盖度...', pct: 60 },
      { text: '正在生成六维能力画像...', pct: 80 },
      { text: '正在生成深度分析报告...', pct: 95 },
    ];

    let stepIdx = 0;
    const stepText = document.getElementById('loading-step-text');
    const progressBar = document.getElementById('loading-progress-bar');

    const timer = setInterval(() => {
      if (stepIdx < steps.length) {
        if (stepText) stepText.textContent = steps[stepIdx].text;
        if (progressBar) progressBar.style.width = steps[stepIdx].pct + '%';
        stepIdx++;
      }
    }, 400);

    // 延迟后生成报告
    setTimeout(() => {
      clearInterval(timer);
      if (progressBar) progressBar.style.width = '100%';
      setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s ease';
        setTimeout(() => {
          overlay.remove();
          this.calculateAndShowReport();
        }, 400);
      }, 300);
    }, 2200);
  },

  // 动态竞争力分析
  updateCompetitiveAnalysis() {
    try {
      const answers = this.userAnswers;
      let interestScore = 0;
      let skillScore = 0;
      let traitScore = 0;
      
      // 计算兴趣匹配度（需有实际选择）
      if (answers.interests && answers.interests.length > 0) {
        interestScore = Math.min(answers.interests.length * 15, 100);
      }
      
      // 计算技能覆盖度（需有实际选择）
      if (answers.skills && answers.skills.length > 0) {
        skillScore = Math.min(answers.skills.length * 12, 100);
      }
      
      // 计算能力评分（需有实际修改，默认值5不算）
      if (answers.traits) {
        const traitValues = Object.values(answers.traits);
        const hasModifiedTraits = traitValues.some(v => v !== 5); // 默认值是5，改过才算
        if (hasModifiedTraits) {
          const avgTrait = traitValues.reduce((a, b) => a + b, 0) / traitValues.length;
          traitScore = Math.round(avgTrait * 10);
        }
      }
      
      // 综合竞争力（全部为0时显示 --）
      const hasData = (interestScore + skillScore + traitScore) > 0;
      const totalScore = hasData
        ? Math.round(interestScore * 0.35 + skillScore * 0.25 + traitScore * 0.2 + 50 * 0.2)
        : 0;
      
      // 更新实时匹配度显示
      const matchScoreEl = document.getElementById('realtime-match-score');
      if (matchScoreEl) {
        matchScoreEl.textContent = totalScore > 0 ? totalScore + '%' : '--';
      }
      
      // 更新竞争力条形图
      const items = document.querySelectorAll('.competitive-item');
      const scores = hasData ? [interestScore, skillScore, traitScore, 50, totalScore] : [0,0,0,0,0];
      
      items.forEach((item, index) => {
        if (index < scores.length) {
          const fill = item.querySelector('.competitive-bar-fill');
          const valueEl = item.querySelector('.competitive-value');
          if (fill) {
            fill.style.width = scores[index] + '%';
            fill.style.transition = 'width 0.5s ease';
          }
          if (valueEl) {
            valueEl.textContent = scores[index] > 0 ? scores[index] + '%' : '--';
          }
        }
      });
    } catch (e) {
      console.error('[CompetitiveAnalysis Error]', e);
    }
  },

  prevStep() {
    if (this.assessStep > 0) {
      this.assessStep--;
      this.renderAssessStep();
      this.updateCompetitiveAnalysis();
    }
  },

  calculateAndShowReport() {
    try {
      console.log('[Report] 开始生成报告, userAnswers:', JSON.parse(JSON.stringify(this.userAnswers)));
      const report = CareerEngine.buildReport(this.userAnswers);
      console.log('[Report] buildReport 完成, top:', report.top?.length);
      document.querySelector('.assess-pc-layout').style.display = 'none';

      const resBox = document.getElementById('assess-result-view');
      const content = document.getElementById('result-pc-content');
      resBox.style.display = 'block';

      // 保存测评历史
      const historyEntry = {
        date: new Date().toISOString(),
        answers: { ...this.userAnswers },
        topJob: report.top[0].job.name,
        score: report.top[0].total,
        top3: report.top.slice(0, 3).map(t => ({ name: t.job.name, score: t.total, desc: t.job.desc }))
      };
      this.userData.assessmentHistory.push(historyEntry);
      this.userData.lastAssessment = historyEntry;
      this.saveUserData();
      this.updateHomePreview();

      // 生成深度分析
      const analysis = CareerEngine.generateAssessmentAnalysis(this.userAnswers, report);
      console.log('[Report] generateAssessmentAnalysis 完成, sections:', analysis?.length);

      const top1 = report.top[0];
      const top2 = report.top[1];
      const top3 = report.top[2];

    // 六维度雷达图数据（基于全部问答综合计算）
    const computedTraits = CareerEngine.computeTraitScores(this.userAnswers);
    const traitData = [
      { label: '逻辑分析', score: computedTraits.logic },
      { label: '创造想象', score: computedTraits.creative },
      { label: '沟通协作', score: computedTraits.social },
      { label: '执行落地', score: computedTraits.exec },
      { label: '组织领导', score: computedTraits.leader },
      { label: '动手实践', score: computedTraits.handcraft },
    ];

    content.innerHTML = `
      <div style="grid-column: span 2; animation: slideUp 0.5s ease;">

        <!-- ========== 第一部分：深度文字分析 ========== -->
        <div style="background:linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%); padding:28px 32px; border-radius:20px; box-shadow:var(--shadow-sm); margin-bottom:24px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <span style="background:var(--primary); color:#fff; font-size:13px; padding:4px 14px; border-radius:14px; font-weight:600;">六维 AI 测评报告</span>
            <span style="font-size:13px; color:var(--text-muted);">匹配岗位：${top1.job.name}（${top1.total}%）</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:16px;">
            ${analysis.map(section => `
              <div style="background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <div style="padding:14px 20px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:8px;">
                  <i class="${section.icon}" style="color:var(--primary); font-size:18px;"></i>
                  <span style="font-size:16px; font-weight:700; color:var(--text-main);">${section.title}</span>
                </div>
                <div style="padding:16px 20px;">
                  ${section.paragraphs.map(p => `<p style="font-size:14px; color:#334155; margin:0 0 10px; line-height:1.85;">${p}</p>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ========== 第二部分：六维度雷达 + 分数 ========== -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; animation: slideUp 0.6s ease;">
          <!-- 左：雷达图 -->
          <div style="background:#fff; border:1px solid var(--border-color); border-radius:16px; padding:24px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
              <i class="ri-radar-line" style="color:var(--primary);"></i> 六维能力画像
            </h4>
            <canvas id="assess-radar" width="360" height="340"></canvas>
          </div>
          <!-- 右：各维度分数 -->
          <div style="background:#fff; border:1px solid var(--border-color); border-radius:16px; padding:24px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
              <i class="ri-bar-chart-2-line" style="color:var(--primary);"></i> 能力维度评分
            </h4>
            <div style="display:flex; flex-direction:column; gap:14px;">
              ${traitData.map(d => `
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:13px; font-weight:600; color:var(--text-main);">${d.label}</span>
                    <span style="font-size:13px; font-weight:700; color:${d.score >= 8 ? '#16a34a' : d.score >= 5 ? '#0284c7' : '#d97706'};">${d.score}/10</span>
                  </div>
                  <div style="background:#e2e8f0; height:6px; border-radius:3px; overflow:hidden;">
                    <div style="background:${d.score >= 8 ? '#16a34a' : d.score >= 5 ? '#0284c7' : '#d97706'}; height:100%; width:${d.score * 10}%; border-radius:3px; transition:width 0.6s ease;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- ========== 第三部分：推荐岗位 ========== -->
        <div style="animation: slideUp 0.7s ease;">
          <h3 style="font-size:20px; font-weight:800; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
            <i class="ri-medal-line" style="color:var(--primary);"></i> 为你推荐的 3 个方向
          </h3>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px;">
            ${report.top.map((item, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
              const border = idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)';
              const bg = idx === 0 ? 'linear-gradient(135deg,#f5f3ff,#ede9fe)' : '#fff';
              return `
              <div style="background:${bg}; border:${border}; border-radius:16px; padding:20px; ${idx === 0 ? 'box-shadow:0 4px 12px rgba(124,58,237,0.15);' : ''}">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                  <span style="font-size:24px;">${medal}</span>
                  <span style="font-size:15px; font-weight:700; color:var(--text-main);">${item.job.name}</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:8px;">
                  <span style="font-size:28px; font-weight:900; color:var(--primary);">${item.total}%</span>
                  <span style="font-size:12px; color:var(--text-muted);">匹配度</span>
                </div>
                <p style="font-size:13px; color:var(--text-muted); line-height:1.7; margin:0;">${item.job.desc}</p>
                <div style="margin-top:12px; padding-top:12px; border-top:1px solid ${idx === 0 ? '#e0d4fa' : '#f1f5f9'};">
                  <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">兴趣匹配</div>
                  <div style="background:#e2e8f0; height:5px; border-radius:3px; overflow:hidden;">
                    <div style="background:var(--primary); height:100%; width:${Math.round(item.parts.interest * 100)}%; border-radius:3px;"></div>
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
                    <div style="font-size:11px; color:var(--text-muted);">技能 ${Math.round(item.parts.skill * 100)}%</div>
                    <div style="font-size:11px; color:var(--text-muted);">性格 ${Math.round(item.parts.trait * 100)}%</div>
                    <div style="font-size:11px; color:var(--text-muted);">偏好 ${Math.round(item.parts.pref * 100)}%</div>
                    <div style="font-size:11px; color:var(--text-muted);">画像 ${Math.round(item.parts.persona * 100)}%</div>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- ========== 操作按钮 ========== -->
        <div style="display:flex; gap:12px; margin-top:28px; animation: slideUp 0.8s ease;">
          <button class="btn btn-primary-gradient btn-lg" onclick="app.startNewAssessment(); app.switchTab('assess');">
            <i class="ri-refresh-line"></i> 重新测试
          </button>
          <button class="btn btn-primary-gradient btn-lg" onclick="app.exportReport()">
            <i class="ri-download-line"></i> 导出报告
          </button>
        </div>
      </div>
    `;

    // 绘制雷达图
    this.drawRadarChart('assess-radar', traitData);
    } catch (e) {
      console.error('[Report] 报告生成失败:', e);
      alert('报告生成时出错：' + e.message + '\n\n请打开浏览器控制台（F12 → Console）查看详细错误信息。');
      this._generatingReport = false;
      // 恢复界面，让用户可以重试
      document.querySelector('.assess-pc-layout').style.display = 'grid';
      document.getElementById('assess-result-view').style.display = 'none';
    }
  },

  // 绘制雷达图
  drawRadarChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = 360, h = 340;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    const cx = w / 2, cy = h / 2 - 5, r = 110;
    const n = data.length;
    const angleStep = (Math.PI * 2) / n;
    const startAngle = -Math.PI / 2;

    // 背景网格
    for (let level = 1; level <= 5; level++) {
      const lr = (r * level) / 5;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const angle = startAngle + i * angleStep;
        const x = cx + lr * Math.cos(angle);
        const y = cy + lr * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 轴线
    for (let i = 0; i < n; i++) {
      const angle = startAngle + i * angleStep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 数据区域
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const angle = startAngle + idx * angleStep;
      const val = (data[idx].score / 10) * r;
      const x = cx + val * Math.cos(angle);
      const y = cy + val * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(124, 58, 237, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 数据点 + 标签
    for (let i = 0; i < n; i++) {
      const angle = startAngle + i * angleStep;
      const val = (data[i].score / 10) * r;
      const x = cx + val * Math.cos(angle);
      const y = cy + val * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#7c3aed';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 标签
      const lx = cx + (r + 30) * Math.cos(angle);
      const ly = cy + (r + 30) * Math.sin(angle);
      ctx.fillStyle = '#334155';
      ctx.font = '600 12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(data[i].label, lx, ly);

      // 分数
      ctx.fillStyle = '#7c3aed';
      ctx.font = '700 11px -apple-system, sans-serif';
      ctx.fillText(data[i].score + '/10', lx, ly + 15);
    }
  },

  // 展示上次测评结果
  showLastAssessmentResult() {
    const last = this.userData.lastAssessment;
    if (!last) return;

    const pcLayout = document.querySelector('.assess-pc-layout');
    const resBox = document.getElementById('assess-result-view');
    const content = document.getElementById('result-pc-content');
    if (pcLayout) pcLayout.style.display = 'none';
    if (resBox) resBox.style.display = 'block';

    // 重新生成报告
    const report = CareerEngine.buildReport(last.answers || {});
    const analysis = CareerEngine.generateAssessmentAnalysis(last.answers || {}, report);

    const top1 = report.top[0];
    const computedTraits = CareerEngine.computeTraitScores(last.answers || {});
    const traitData = [
      { label: '逻辑分析', score: computedTraits.logic },
      { label: '创造想象', score: computedTraits.creative },
      { label: '沟通协作', score: computedTraits.social },
      { label: '执行落地', score: computedTraits.exec },
      { label: '组织领导', score: computedTraits.leader },
      { label: '动手实践', score: computedTraits.handcraft },
    ];

    content.innerHTML = `
      <div style="grid-column: span 2; animation: slideUp 0.5s ease;">
        <div style="background:linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%); padding:28px 32px; border-radius:20px; box-shadow:var(--shadow-sm); margin-bottom:24px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <span style="background:var(--primary); color:#fff; font-size:13px; padding:4px 14px; border-radius:14px; font-weight:600;">上次测评结果</span>
            <span style="font-size:13px; color:var(--text-muted);">测评时间：${new Date(last.date).toLocaleString('zh-CN')}</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:16px;">
            ${analysis.map(section => `
              <div style="background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <div style="padding:14px 20px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:8px;">
                  <i class="${section.icon}" style="color:var(--primary); font-size:18px;"></i>
                  <span style="font-size:16px; font-weight:700; color:var(--text-main);">${section.title}</span>
                </div>
                <div style="padding:16px 20px;">
                  ${section.paragraphs.map(p => `<p style="font-size:14px; color:#334155; margin:0 0 10px; line-height:1.85;">${p}</p>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; animation: slideUp 0.6s ease;">
          <div style="background:#fff; border:1px solid var(--border-color); border-radius:16px; padding:24px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
              <i class="ri-radar-line" style="color:var(--primary);"></i> 六维能力画像
            </h4>
            <canvas id="assess-radar-last" width="360" height="340"></canvas>
          </div>
          <div style="background:#fff; border:1px solid var(--border-color); border-radius:16px; padding:24px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
              <i class="ri-bar-chart-2-line" style="color:var(--primary);"></i> 能力维度评分
            </h4>
            <div style="display:flex; flex-direction:column; gap:14px;">
              ${traitData.map(d => `
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:13px; font-weight:600; color:var(--text-main);">${d.label}</span>
                    <span style="font-size:13px; font-weight:700; color:${d.score >= 8 ? '#16a34a' : d.score >= 5 ? '#0284c7' : '#d97706'};">${d.score}/10</span>
                  </div>
                  <div style="background:#e2e8f0; height:6px; border-radius:3px; overflow:hidden;">
                    <div style="background:${d.score >= 8 ? '#16a34a' : d.score >= 5 ? '#0284c7' : '#d97706'}; height:100%; width:${d.score * 10}%; border-radius:3px;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div style="animation: slideUp 0.7s ease;">
          <h3 style="font-size:20px; font-weight:800; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
            <i class="ri-medal-line" style="color:var(--primary);"></i> 为你推荐的 3 个方向
          </h3>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px;">
            ${report.top.map((item, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
              const border = idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)';
              const bg = idx === 0 ? 'linear-gradient(135deg,#f5f3ff,#ede9fe)' : '#fff';
              return `
              <div style="background:${bg}; border:${border}; border-radius:16px; padding:20px; ${idx === 0 ? 'box-shadow:0 4px 12px rgba(124,58,237,0.15);' : ''}">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                  <span style="font-size:24px;">${medal}</span>
                  <span style="font-size:15px; font-weight:700; color:var(--text-main);">${item.job.name}</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:8px;">
                  <span style="font-size:28px; font-weight:900; color:var(--primary);">${item.total}%</span>
                  <span style="font-size:12px; color:var(--text-muted);">匹配度</span>
                </div>
                <p style="font-size:13px; color:var(--text-muted); line-height:1.7; margin:0;">${item.job.desc}</p>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div style="display:flex; gap:12px; margin-top:28px; animation: slideUp 0.8s ease;">
          <button class="btn btn-primary-gradient btn-lg" onclick="app.startNewAssessment(); app.switchTab('assess');">
            <i class="ri-refresh-line"></i> 重新测评
          </button>
          <button class="btn btn-primary-gradient btn-lg" onclick="app.exportReport()">
            <i class="ri-download-line"></i> 导出报告
          </button>
        </div>
      </div>
    `;

    this.drawRadarChart('assess-radar-last', traitData);
  },

  // 开始新一轮测评（清除上次结果）
  startNewAssessment() {
    this.userData.lastAssessment = null;
    this.userData.assessmentHistory = [];
    this.userAnswers = { persona: '', interests: [], skills: [], traits: { logic: 5, creative: 5, social: 5, exec: 5, leader: 5, handcraft: 5 }, prefs: [] };
    this.assessStep = 0;
    this.saveUserData();

    // 强制清空实时匹配面板 DOM
    const matchScoreEl = document.getElementById('realtime-match-score');
    if (matchScoreEl) matchScoreEl.textContent = '--';
    const items = document.querySelectorAll('.competitive-item');
    items.forEach(item => {
      const fill = item.querySelector('.competitive-bar-fill');
      const valueEl = item.querySelector('.competitive-value');
      if (fill) { fill.style.width = '0%'; fill.style.transition = 'none'; }
      if (valueEl) valueEl.textContent = '--';
    });

    // 强制清空首页预览卡片
    const scoreEl = document.getElementById('home-preview-score');
    const jobEl = document.getElementById('home-preview-job');
    const descEl = document.getElementById('home-preview-desc');
    const tagsEl = document.getElementById('home-preview-tags');
    const labelEl = document.getElementById('home-preview-label');
    const barsEl = document.getElementById('home-preview-bars');
    if (scoreEl) scoreEl.innerText = '匹配度 --';
    if (jobEl) jobEl.innerText = '完成测评后查看';
    if (descEl) descEl.innerText = '点击左侧「一键精准匹配」开始6维AI测评';
    if (labelEl) labelEl.innerText = '你的测评结果';
    if (tagsEl) tagsEl.innerHTML = '';
    if (barsEl) barsEl.innerHTML = '';

    const resultView = document.getElementById('assess-result-view');
    const pcLayout = document.querySelector('.assess-pc-layout');
    if (resultView) resultView.style.display = 'none';
    if (pcLayout) pcLayout.style.display = 'grid';
    this.renderAssessStep();
  },

  // 导出报告为 PDF
  async exportReport() {
    const report = CareerEngine.buildReport(this.userAnswers);
    if (!report.top || report.top.length === 0) {
      alert('暂无测评数据，请先完成测评。');
      return;
    }

    // 检查库是否加载
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
      alert('PDF 导出组件加载中，请稍后重试。');
      return;
    }

    const btn = document.querySelector('[onclick="app.exportReport()"]');
    const origText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> 生成中...';

    try {
      // 1. 截取报告区域
      const content = document.getElementById('result-pc-content');
      if (!content) { alert('请先完成测评查看报告。'); return; }

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8f7ff',
        logging: false,
        windowWidth: 900,
      });

      // 2. 计算 PDF 尺寸（A4 竖版）
      const { jsPDF } = jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();   // 210mm
      const pageH = pdf.internal.pageSize.getHeight();  // 297mm
      const margin = 10;
      const usableW = pageW - margin * 2;

      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = usableW / imgW;
      const scaledH = imgH * ratio;

      // 3. 分页写入
      const pageContentH = pageH - margin * 2;
      let yOffset = 0;
      let page = 0;

      while (yOffset < scaledH) {
        if (page > 0) pdf.addPage();

        // 计算当前页裁剪区域
        const srcY = yOffset / ratio;
        const remainingH = scaledH - yOffset;
        const sliceH = Math.min(pageContentH, remainingH);
        const srcH = sliceH / ratio;

        // 从 canvas 裁剪当前页内容
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgW;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);

        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(pageImg, 'JPEG', margin, margin, usableW, sliceH);

        yOffset += pageContentH;
        page++;
      }

      // 4. 添加页脚
      for (let i = 1; i <= page; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(160);
        pdf.text(`启航 CareerStart · ${new Date().toLocaleDateString('zh-CN')} · 第${i}/${page}页`, pageW / 2, pageH - 5, { align: 'center' });
      }

      // 5. 下载
      const top1Name = report.top[0].job.name;
      pdf.save(`启航职业报告_${top1Name}_${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (e) {
      console.error('[ExportPDF Error]', e);
      alert('PDF 生成失败：' + e.message);
    } finally {
      if (btn) btn.innerHTML = origText;
    }
  },

  // 6. 简历诊断
  runResumeCheck() {
    const text = document.getElementById('resume-input').value;
    const box = document.getElementById('resume-result-box');
    if (!text.trim()) { alert("请先输入简历文本"); return; }

    // 检查登录和使用次数
    if (!this.checkUsage('resumeCheck')) return;

    // 记录使用次数
    this.recordUsage('resumeCheck');

    // 先执行诊断获取结果
    const result = CareerEngine.diagnoseResume(text);
    if (!result) return;
    
    // 显示加载动画
    box.style.display = 'block';
    box.innerHTML = `
      <div style="background:#fff; border:1px solid var(--border-color); border-radius:16px; padding:60px 24px; text-align:center; animation:slideUp 0.4s ease;">
        <div style="width:64px; height:64px; margin:0 auto 20px; border:4px solid #e2e8f0; border-top-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
        <div style="font-size:18px; font-weight:700; color:var(--text-main); margin-bottom:8px;">AI 简历正在加载中</div>
        <div style="font-size:13px; color:var(--text-muted);">正在分析简历结构、量化数据、表述力度...</div>
      </div>
      <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    `;

    // 延迟3-5秒展示结果
    const delay = 3000 + Math.random() * 2000;
    setTimeout(() => {
      // 保存诊断历史
      this.userData.resumeHistory.push({
        date: new Date().toISOString(),
        text: text.substring(0, 100),
        score: result.totalScore,
        riskLevel: result.level
      });
      this.saveUserData();

      const scoreColor = result.totalScore >= 90 ? '#16a34a' : result.totalScore >= 75 ? '#2ea56a' : result.totalScore >= 60 ? '#0284c7' : result.totalScore >= 40 ? '#d97706' : '#dc2626';
      const severityColor = { '高危': '#dc2626', '中危': '#d97706', '低危': '#0284c7' };
      const matchColor = { '高': '#16a34a', '中': '#0284c7', '低': '#d97706', '极低': '#dc2626', '未评估': '#94a3b8' };

      box.innerHTML = `
      <div style="background:#fff; border:1px solid var(--border-color); border-radius:16px; overflow:hidden; animation:slideUp 0.4s ease;">

        <!-- ========== 第一部分：文字报告 ========== -->

        <!-- 评分头部 -->
        <div style="padding:28px 24px; display:flex; align-items:center; gap:24px; flex-wrap:wrap; border-bottom:1px solid var(--border-color); background:linear-gradient(135deg,#f8f5ff 0%,#fff 100%);">
          <div style="width:96px; height:96px; border-radius:50%; background:conic-gradient(${scoreColor} ${result.totalScore * 3.6}deg, #e2e8f0 0deg); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 16px ${scoreColor}22;">
            <div style="width:78px; height:78px; border-radius:50%; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <span style="font-size:28px; font-weight:900; color:${scoreColor}; line-height:1;">${result.totalScore}</span>
              <span style="font-size:11px; color:${scoreColor}; font-weight:600;">${result.level}</span>
            </div>
          </div>
          <div style="flex:1; min-width:200px;">
            <div style="font-size:20px; font-weight:800; color:var(--text-main); margin-bottom:4px;">简历诊断报告</div>
            <div style="font-size:13px; color:var(--text-muted); line-height:1.6;">${result.summary}</div>
          </div>
        </div>

        <!-- 优点 -->
        ${result.strengths.length > 0 ? `
        <div style="padding:20px 24px; border-bottom:1px solid var(--border-color);">
          <h4 style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px; color:#16a34a;">
            <i class="ri-thumb-up-line"></i> 简历亮点
          </h4>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${result.strengths.map(s => `
              <div style="display:flex; align-items:flex-start; gap:8px; font-size:13px; color:#334155; line-height:1.6;">
                <i class="ri-check-line" style="color:#16a34a; margin-top:2px; flex-shrink:0;"></i>
                <span>${s}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- 风险清单 -->
        ${result.risks.length > 0 ? `
        <div style="padding:20px 24px; border-bottom:1px solid var(--border-color);">
          <h4 style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px; color:#dc2626;">
            <i class="ri-error-warning-line"></i> 问题清单（${result.risks.length} 项）
          </h4>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${result.risks.map(r => `
              <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
                <div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:${severityColor[r.severity]}08; border-bottom:1px solid #e2e8f0;">
                  <span style="font-size:11px; font-weight:700; color:#fff; background:${severityColor[r.severity]}; padding:2px 8px; border-radius:4px;">${r.severity}</span>
                  <span style="font-size:13px; font-weight:700; color:var(--text-main);">${r.type}</span>
                </div>
                <div style="padding:12px 14px; background:#fff;">
                  <div style="font-size:12px; color:#475569; margin-bottom:6px; line-height:1.6;">
                    <strong>问题：</strong>${r.detail}
                  </div>
                  <div style="font-size:12px; color:#dc2626; margin-bottom:6px; line-height:1.6;">
                    <strong>后果：</strong>${r.consequence}
                  </div>
                  <div style="font-size:12px; color:#16a34a; line-height:1.6;">
                    <strong>建议：</strong>${r.suggestion}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- 目标岗位匹配 -->
        <div style="padding:20px 24px; border-bottom:1px solid var(--border-color);">
          <h4 style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px; color:var(--primary);">
            <i class="ri-target-line"></i> 目标岗位匹配分析
          </h4>
          <div style="background:#f8fafc; border-radius:10px; padding:14px; border:1px solid #e2e8f0;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              <span style="font-size:13px; color:var(--text-muted);">匹配程度：</span>
              <span style="font-size:14px; font-weight:700; color:${matchColor[result.match_analysis.match_level]};">${result.match_analysis.match_level}</span>
            </div>
            <div style="font-size:12px; color:#475569; line-height:1.7;">
              ${result.match_analysis.gap_description}
            </div>
            ${result.match_analysis.key_missing_skills.length > 0 ? `
            <div style="margin-top:8px; font-size:12px; color:#d97706;">
              <strong>建议补充：</strong>${result.match_analysis.key_missing_skills.join('、')}
            </div>
            ` : ''}
          </div>
        </div>

        <!-- 优化建议 -->
        <div style="padding:20px 24px; border-bottom:1px solid var(--border-color);">
          <h4 style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px; color:var(--primary);">
            <i class="ri-lightbulb-line"></i> 优化建议
          </h4>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${result.optimization_tips.map((tip, i) => `
              <div style="display:flex; align-items:flex-start; gap:10px; font-size:13px; color:#334155; line-height:1.6;">
                <span style="background:var(--primary); color:#fff; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0;">${i + 1}</span>
                <span>${tip}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ========== 第二部分：图形分析 ========== -->

        <!-- 六维度雷达图 + 条形图 -->
        <div style="padding:24px;">
          <h4 style="font-size:16px; font-weight:800; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
            <i class="ri-radar-line" style="color:var(--primary);"></i> 六维度量化分析
          </h4>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <!-- 雷达图 -->
            <div style="background:#f8fafc; border-radius:12px; padding:16px; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center;">
              <canvas id="resume-radar-chart" width="280" height="280"></canvas>
            </div>
            <!-- 条形图 -->
            <div style="background:#f8fafc; border-radius:12px; padding:16px; border:1px solid #e2e8f0;">
              ${result.dimensions.map(d => `
                <div style="margin-bottom:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:12px; font-weight:600; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                      <i class="${d.icon}" style="color:${d.color}; font-size:14px;"></i> ${d.name}
                    </span>
                    <span style="font-size:13px; font-weight:800; color:${d.color};">${d.score}</span>
                  </div>
                  <div style="background:#e2e8f0; height:6px; border-radius:3px; overflow:hidden;">
                    <div style="background:${d.color}; height:100%; width:${d.score}%; border-radius:3px; transition:width 0.6s ease;"></div>
                  </div>
                  <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${d.detail}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- ========== 底部 ========== -->
        <div style="padding:14px 24px; border-top:1px solid var(--border-color); font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
          <span><i class="ri-history-line"></i> 已保存至诊断历史 (共 ${this.userData.resumeHistory.length} 条记录)</span>
          <button class="btn btn-outline-primary" style="font-size:12px; padding:4px 12px;" onclick="document.getElementById('resume-result-box').style.display='none'">收起报告</button>
        </div>
      </div>
    `;

      // 绘制雷达图
      setTimeout(() => {
        this.drawRadarChart('resume-radar-chart', result.dimensions.map(d => ({
          label: d.name,
          score: d.score / 10
        })));
      }, 100);
    }, delay);
  },

  // 7. AI 模拟面试
  interviewSession: null,

  startInterview() {
    const input = document.getElementById('interview-input');
    const chatBox = document.getElementById('interview-chat-box');
    const txt = input.value.trim();
    if (!txt) { alert('请输入目标岗位名称'); return; }

    // 检查登录和使用次数
    if (!this.checkUsage('interview')) return;

    // 记录使用次数
    this.recordUsage('interview');

    // 显示加载动画
    chatBox.innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <div style="width:56px; height:56px; margin:0 auto 16px; background:linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%); border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 20px rgba(99,102,241,0.3);">
          <i class="ri-robot-fill" style="font-size:24px; color:#fff;"></i>
        </div>
        <div style="font-size:16px; font-weight:700; color:var(--text-main); margin-bottom:6px;">AI 面试官正在准备中</div>
        <div style="font-size:12px; color:var(--text-muted);">正在生成「${txt}」专属面试题库...</div>
        <div style="width:120px; height:3px; background:#e2e8f0; border-radius:2px; margin:16px auto 0; overflow:hidden;">
          <div style="width:40%; height:100%; background:linear-gradient(90deg, var(--primary) 0%, #7c3aed 100%); border-radius:2px; animation:loading 1.5s ease-in-out infinite;"></div>
        </div>
      </div>
      <style>@keyframes loading{0%{transform:translateX(-100%)}50%{transform:translateX(150%)}100%{transform:translateX(-100%)}}</style>
    `;
    input.value = '';

    // 初始化面试会话
    setTimeout(() => {
      this.interviewSession = CareerEngine.initInterviewSession(txt);
      const firstQ = this.interviewSession.questions[0];

      chatBox.innerHTML = `
        <div class="interview-progress">
          <span style="font-size:11px; color:var(--text-muted);">问题 1/${this.interviewSession.questions.length}</span>
          <div class="interview-progress-bar"><div class="interview-progress-fill" style="width:${Math.round(100/this.interviewSession.questions.length)}%"></div></div>
        </div>
        <div class="chat-msg system" style="display:flex; gap:12px; margin-bottom:14px;">
          <div class="msg-avatar"><i class="ri-robot-fill"></i></div>
          <div class="msg-content">
            <div style="font-size:11px; color:var(--primary); font-weight:600; margin-bottom:6px;"><i class="ri-mic-line"></i> AI 面试官</div>
            你好！我是启航 AI 面试官，今天将针对「${txt}」岗位进行模拟面试。<br><br>
            ${firstQ.question}
          </div>
        </div>
      `;
      chatBox.scrollTop = chatBox.scrollHeight;
    }, 2000);
  },

  sendInterviewMsg() {
    const input = document.getElementById('interview-input');
    const chatBox = document.getElementById('interview-chat-box');
    const txt = input.value.trim();
    if (!txt || !this.interviewSession) return;

    // 显示用户消息
    chatBox.innerHTML += `
      <div class="chat-msg user" style="display:flex; gap:12px; flex-direction:row-reverse; margin-bottom:14px;">
        <div class="msg-avatar" style="width:32px; height:32px; background:linear-gradient(135deg, #94a3b8, #64748b);"><i class="ri-user-line"></i></div>
        <div class="msg-content">${txt}</div>
      </div>
    `;
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    // 显示分析中提示
    chatBox.innerHTML += `
      <div id="interview-loading" style="text-align:center; padding:12px; margin-bottom:10px;">
        <div style="display:inline-flex; align-items:center; gap:8px; padding:6px 14px; background:#f1f5f9; border-radius:20px;">
          <div style="display:flex; gap:3px;">
            <span style="width:4px; height:4px; background:var(--primary); border-radius:50%; animation:dot 1.4s infinite ease-in-out;"></span>
            <span style="width:4px; height:4px; background:var(--primary); border-radius:50%; animation:dot 1.4s infinite ease-in-out 0.2s;"></span>
            <span style="width:4px; height:4px; background:var(--primary); border-radius:50%; animation:dot 1.4s infinite ease-in-out 0.4s;"></span>
          </div>
          <span style="font-size:12px; color:var(--text-muted);">正在分析回答...</span>
        </div>
      </div>
      <style>@keyframes dot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}</style>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;

    // 分析回答并生成反馈
    setTimeout(() => {
      const result = CareerEngine.getInterviewFeedback(this.interviewSession, txt);

      // 移除加载提示
      const loadingEl = document.getElementById('interview-loading');
      if (loadingEl) loadingEl.remove();

      // 显示评分标签
      const scoreClass = result.score >= 70 ? 'good' : result.score >= 50 ? 'medium' : 'bad';
      chatBox.innerHTML += `
        <div style="margin-bottom:10px; padding:10px 14px; background:#f8fafc; border-radius:10px; border-left:3px solid ${result.score >= 70 ? '#16a34a' : result.score >= 50 ? '#d97706' : '#dc2626'};">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span class="score-tag ${scoreClass}">${result.level} ${result.score}分</span>
          </div>
          <div style="font-size:12px; color:#475569; line-height:1.5;">${result.feedback}</div>
        </div>
      `;

      // 显示 AI 追问或下一题
      setTimeout(() => {
        const progress = Math.round(((this.interviewSession.answers.length) / this.interviewSession.questions.length) * 100);
        chatBox.innerHTML += `
          <div class="chat-msg system" style="display:flex; gap:12px; margin-bottom:14px;">
            <div class="msg-avatar"><i class="ri-robot-fill"></i></div>
            <div class="msg-content">
              <div style="font-size:11px; color:var(--primary); font-weight:600; margin-bottom:6px;"><i class="ri-mic-line"></i> AI 面试官</div>
              ${result.aiResponse}
            </div>
          </div>
          ${!result.isLast ? `
          <div class="interview-progress">
            <span style="font-size:11px; color:var(--text-muted);">问题 ${this.interviewSession.currentQ + 1}/${this.interviewSession.questions.length}</span>
            <div class="interview-progress-bar"><div class="interview-progress-fill" style="width:${progress}%"></div></div>
          </div>
          ` : ''}
            </div>
          </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;

        // 如果是最后一题，生成报告
        if (result.isLast) {
          this.finishInterview();
        }
      }, 500);
    }, 1200);
  },

  finishInterview() {
    const chatBox = document.getElementById('interview-chat-box');

    // 显示生成报告动画
    setTimeout(() => {
      chatBox.innerHTML += `
        <div id="interview-report-loading" style="text-align:center; padding:30px; margin-top:10px;">
          <div style="width:56px; height:56px; margin:0 auto 16px; border:3px solid #e2e8f0; border-top-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
          <div style="font-size:16px; font-weight:700; color:var(--text-main); margin-bottom:6px;">AI 面试评估报告生成中</div>
          <div style="font-size:12px; color:var(--text-muted);">正在综合分析你的面试表现...</div>
        </div>
      `;
      chatBox.scrollTop = chatBox.scrollHeight;

      // 生成报告
      setTimeout(() => {
        const report = CareerEngine.generateInterviewReport(this.interviewSession);
        const loadingEl = document.getElementById('interview-report-loading');
        if (loadingEl) loadingEl.remove();

        // 保存历史
        this.userData.interviewHistory = this.userData.interviewHistory || [];
        this.userData.interviewHistory.push({
          date: new Date().toISOString(),
          job: report.jobName,
          score: report.totalScore,
          level: report.level
        });
        this.saveUserData();

        // 渲染报告
        const severityColor = { '优秀': '#16a34a', '良好': '#2ea56a', '一般': '#d97706', '较差': '#dc2626' };

        chatBox.innerHTML += `
          <div style="background:#fff; border:1px solid var(--border-color); border-radius:12px; overflow:hidden; margin-top:10px; animation:slideUp 0.4s ease;">
            <!-- 评分头部 -->
            <div style="padding:24px; text-align:center; background:linear-gradient(135deg,#f8f5ff 0%,#fff 100%); border-bottom:1px solid var(--border-color);">
              <div style="width:80px; height:80px; border-radius:50%; background:conic-gradient(${report.color} ${report.totalScore * 3.6}deg, #e2e8f0 0deg); margin:0 auto 16px; display:flex; align-items:center; justify-content:center;">
                <div style="width:64px; height:64px; border-radius:50%; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                  <span style="font-size:24px; font-weight:900; color:${report.color}; line-height:1;">${report.totalScore}</span>
                  <span style="font-size:10px; color:${report.color}; font-weight:600;">${report.level}</span>
                </div>
              </div>
              <div style="font-size:16px; font-weight:700; color:var(--text-main); margin-bottom:4px;">「${report.jobName}」面试报告</div>
              <div style="font-size:12px; color:var(--text-muted);">共 ${report.totalQuestions} 题 · 已答 ${report.answeredQuestions} 题 · 用时 ${report.duration}</div>
            </div>

            <!-- 分类得分 -->
            <div style="padding:20px 24px; border-bottom:1px solid var(--border-color);">
              <h4 style="font-size:14px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px; color:var(--primary);">
                <i class="ri-bar-chart-grouped-line"></i> 各维度表现
              </h4>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${Object.entries(report.categoryScores).map(([cat, score]) => `
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:12px; color:var(--text-main); width:80px;">${cat}</span>
                    <div style="flex:1; background:#e2e8f0; height:6px; border-radius:3px; overflow:hidden;">
                      <div style="background:${score >= 70 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'}; height:100%; width:${score}%; border-radius:3px; transition:width 0.6s ease;"></div>
                    </div>
                    <span style="font-size:12px; font-weight:700; color:${score >= 70 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'};">${score}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 优劣势分析 -->
            <div style="padding:20px 24px; border-bottom:1px solid var(--border-color);">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                  <h4 style="font-size:13px; font-weight:700; margin-bottom:8px; color:#16a34a;"><i class="ri-thumb-up-line"></i> 优势领域</h4>
                  ${report.strengths.length > 0 ? report.strengths.map(s => `<div style="font-size:12px; color:#475569; margin-bottom:4px;">✓ ${s}</div>`).join('') : '<div style="font-size:12px; color:#94a3b8;">暂无明显优势</div>'}
                </div>
                <div>
                  <h4 style="font-size:13px; font-weight:700; margin-bottom:8px; color:#d97706;"><i class="ri-error-warning-line"></i> 待提升</h4>
                  ${report.weaknesses.length > 0 ? report.weaknesses.map(w => `<div style="font-size:12px; color:#475569; margin-bottom:4px;">△ ${w}</div>`).join('') : '<div style="font-size:12px; color:#94a3b8;">暂无明显短板</div>'}
                </div>
              </div>
            </div>

            <!-- 综合建议 -->
            <div style="padding:20px 24px; border-bottom:1px solid var(--border-color);">
              <h4 style="font-size:14px; font-weight:700; margin-bottom:8px; display:flex; align-items:center; gap:8px; color:var(--primary);">
                <i class="ri-lightbulb-line"></i> 面试建议
              </h4>
              <div style="font-size:13px; color:#475569; line-height:1.7;">${report.suggestion}</div>
            </div>

            <!-- 各题详情 -->
            <div style="padding:20px 24px; border-bottom:1px solid var(--border-color);">
              <h4 style="font-size:14px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px; color:var(--primary);">
                <i class="ri-list-check-2"></i> 回答详情
              </h4>
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${report.details.map((d, i) => `
                  <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                    <div style="display:flex; align-items:center; gap:8px; padding:10px 12px; background:${d.color}08; border-bottom:1px solid #e2e8f0;">
                      <span style="font-size:10px; font-weight:700; color:#fff; background:${d.color}; padding:2px 6px; border-radius:4px;">${d.level} ${d.score}分</span>
                      <span style="font-size:12px; font-weight:600; color:var(--text-main);">${d.category}</span>
                    </div>
                    <div style="padding:10px 12px; background:#fff;">
                      <div style="font-size:11px; color:#64748b; margin-bottom:4px;"><strong>Q:</strong> ${d.question}</div>
                      <div style="font-size:12px; color:#334155; margin-bottom:6px; line-height:1.5;"><strong>A:</strong> ${d.answer}</div>
                      <div style="font-size:11px; color:#475569; line-height:1.5;"><i class="ri-chat-check-line" style="color:var(--primary);"></i> ${d.feedback}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 底部 -->
            <div style="padding:14px 24px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:11px; color:var(--text-muted);"><i class="ri-history-line"></i> 已保存至面试记录</span>
              <button class="btn btn-primary" style="font-size:12px; padding:6px 14px;" onclick="app.resetInterview()">再来一次</button>
            </div>
          </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
      }, 2500);
    }, 800);
  },

  resetInterview() {
    this.interviewSession = null;
    const chatBox = document.getElementById('interview-chat-box');
    chatBox.innerHTML = `
      <div class="chat-msg system">
        <div class="msg-avatar"><i class="ri-robot-fill"></i></div>
        <div class="msg-content">你好！我是启航 AI 面试官。请告诉我你准备面试的岗位（例如：物业主管 / 数据分析 / 托管助教）：</div>
      </div>
    `;
  },

  // 套餐次数限制
  planLimits: {
    month: { resumeCheck: 10, interview: 5 },
    pro: { resumeCheck: 20, interview: 10 },
    year: { resumeCheck: Infinity, interview: Infinity }
  },

  // 检查登录状态
  checkLogin() {
    return true; // 测试模式：跳过登录检查
  },

  // 检查使用次数
  checkUsage(type) {
    return true; // 测试模式：跳过次数检查
  },

  // 记录使用次数
  recordUsage(type) {
    this.userData.usage[type] = (this.userData.usage[type] || 0) + 1;
    this.saveUserData();
  },

  // 会员 Modal
  openVipModal() { document.getElementById('vip-modal').style.display = 'flex'; },
  closeVipModal() { document.getElementById('vip-modal').style.display = 'none'; },

  // 分享 Modal
  openShareModal() { document.getElementById('share-modal').style.display = 'flex'; },
  closeShareModal() { document.getElementById('share-modal').style.display = 'none'; },
  copyShareUrl() {
    const urlInput = document.getElementById('share-url');
    navigator.clipboard.writeText(urlInput.value).then(() => {
      alert('链接已复制！');
    }).catch(() => {
      urlInput.select();
      document.execCommand('copy');
      alert('链接已复制！');
    });
  },

  selectPlan(planKey) {
    this.selectedPlan = planKey;
    document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`plan-card-${planKey}`).classList.add('active');

    const prices = { month: '¥29.00', pro: '¥39.00', year: '¥199.00' };
    document.getElementById('pay-final-price').innerText = prices[planKey];
  },

  submitCoaching() {
    const name = document.getElementById('coaching-name')?.value.trim();
    const phone = document.getElementById('coaching-phone')?.value.trim();
    const desc = document.getElementById('coaching-desc')?.value.trim();
    const tier = document.getElementById('coaching-tier')?.value || 'standard';
    const tierMap = { light: '轻量版 ¥89/次', standard: '标准版 ¥299/次', premium: '尊享版 ¥699/次' };
    if (!name) { alert('请填写你的称呼'); return; }
    if (!phone) { alert('请填写手机号或微信号'); return; }
    alert(`预约成功！\n\n${name}，你选择的是：${tierMap[tier]}\n导师将在24小时内通过微信联系你。\n\n如有紧急问题，可提前添加导师微信咨询。`);
    document.getElementById('coaching-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
  },

  submitManualPayment() {
    const phone = document.getElementById('pay-user-phone').value.trim();
    if (!phone) { alert("请输入你的微信备注名或手机号以便人工审核开通！"); return; }
    
    // 保存VIP状态
    this.userData.isVip = true;
    this.userData.vipPlan = this.selectedPlan;
    this.userData.vipPhone = phone;
    this.userData.vipExpiry = this.getVipExpiry(this.selectedPlan);
    this.saveUserData();
    
    alert(`提交成功！客服将在 10 分钟内核对备注/手机号 [${phone}] 并激活会员！`);
    this.closeVipModal();
    this.updateUserDisplay();
  },

  getVipExpiry(plan) {
    const now = new Date();
    switch(plan) {
      case 'month': now.setMonth(now.getMonth() + 1); break;
      case 'quarter': now.setMonth(now.getMonth() + 3); break;
      case 'year': now.setFullYear(now.getFullYear() + 1); break;
    }
    return now.toISOString();
  },

  // ========== 登录/注册相关 ==========
  API_BASE: 'https://careerstart-api.netlify.app',

  toggleMobileNav() {
    const overlay = document.getElementById('mobile-nav-overlay');
    const nav = document.getElementById('mobile-nav');
    if (overlay && nav) {
      const isOpen = nav.classList.contains('open');
      if (isOpen) {
        nav.classList.remove('open');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
      } else {
        nav.classList.add('open');
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
      }
    }
  },

  openAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('auth-error').style.display = 'none';
    this.switchAuthMode('login');
  },

  closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('auth-error').style.display = 'none';
  },

  switchAuthMode(mode) {
    const loginForm = document.getElementById('auth-login-form');
    const registerForm = document.getElementById('auth-register-form');
    const title = document.getElementById('auth-modal-title');
    const desc = document.getElementById('auth-modal-desc');

    if (mode === 'login') {
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      title.innerText = '登录账号';
      desc.innerText = '登录后享受更多功能，记录你的职业启航旅程';
    } else {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      title.innerText = '注册新账号';
      desc.innerText = '加入启航，开启你的职业启航之旅';
    }
  },

  showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.innerText = msg;
    el.style.display = 'block';
  },

  async login() {
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.querySelector('#auth-login-form .btn');

    if (!phone || !password) {
      this.showAuthError('请输入手机号和密码');
      return;
    }

    if (!/^1\d{10}$/.test(phone)) {
      this.showAuthError('请输入正确的手机号');
      return;
    }

    // 显示加载状态
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> 登录中...';
    btn.disabled = true;

    try {
      const res = await fetch(`${this.API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('NOT_JSON'); }

      if (!res.ok) {
        this.showAuthError(data.error || '登录失败');
        return;
      }

      // 保存登录信息
      this.authToken = data.token;
      this.currentUser = data.user;
      localStorage.setItem('careerstart_token', data.token);
      localStorage.setItem('careerstart_user', JSON.stringify(data.user));

      // 更新UI
      this.updateAuthUI();
      this.closeAuthModal();
      this.updateUserDisplay();

      // 显示成功提示
      alert('登录成功！欢迎回来，' + (data.user.nickname || '启航用户'));

    } catch (e) {
      // API 不可用时，用 localStorage 兜底
      const localUsers = JSON.parse(localStorage.getItem('careerstart_local_users') || '{}');
      const localUser = localUsers[phone];
      if (!localUser || localUser.password !== password) {
        this.showAuthError('本地账号未注册，请先注册新账号');
        return;
      }
      this.authToken = 'local_' + Date.now();
      this.currentUser = { phone, nickname: localUser.nickname };
      localStorage.setItem('careerstart_token', this.authToken);
      localStorage.setItem('careerstart_user', JSON.stringify(this.currentUser));
      this.updateAuthUI();
      this.closeAuthModal();
      this.updateUserDisplay();
      alert('登录成功！欢迎回来，' + localUser.nickname);
    } finally {
      // 恢复按钮状态
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  },

  async register() {
    const phone = document.getElementById('register-phone').value.trim();
    const nickname = document.getElementById('register-nickname').value.trim();
    const password = document.getElementById('register-password').value;
    const btn = document.querySelector('#auth-register-form .btn');

    if (!phone || !password) {
      this.showAuthError('请输入手机号和密码');
      return;
    }

    if (!/^1\d{10}$/.test(phone)) {
      this.showAuthError('请输入正确的手机号');
      return;
    }

    if (password.length < 6) {
      this.showAuthError('密码至少需要6位');
      return;
    }

    // 显示加载状态
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> 注册中...';
    btn.disabled = true;

    try {
      const res = await fetch(`${this.API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, nickname })
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('NOT_JSON'); }

      if (!res.ok) {
        this.showAuthError(data.error || '注册失败');
        return;
      }

      // 保存登录信息
      this.authToken = data.token;
      this.currentUser = data.user;
      localStorage.setItem('careerstart_token', data.token);
      localStorage.setItem('careerstart_user', JSON.stringify(data.user));

      // 更新UI
      this.updateAuthUI();
      this.closeAuthModal();
      this.updateUserDisplay();

      // 显示成功提示
      alert('注册成功！欢迎加入启航，' + (data.user.nickname || '启航用户'));

    } catch (e) {
      // API 不可用时，用 localStorage 兜底
      const localUsers = JSON.parse(localStorage.getItem('careerstart_local_users') || '{}');
      if (localUsers[phone]) {
        this.showAuthError('该手机号已注册，请直接登录');
        return;
      }
      localUsers[phone] = { password, nickname: nickname || '用户' + phone.slice(-4) };
      localStorage.setItem('careerstart_local_users', JSON.stringify(localUsers));
      this.authToken = 'local_' + Date.now();
      this.currentUser = { phone, nickname: localUsers[phone].nickname };
      localStorage.setItem('careerstart_token', this.authToken);
      localStorage.setItem('careerstart_user', JSON.stringify(this.currentUser));
      this.updateAuthUI();
      this.closeAuthModal();
      this.updateUserDisplay();
      alert('注册成功！欢迎加入启航，' + localUsers[phone].nickname);
    } finally {
      // 恢复按钮状态
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  },


  logout() {
    this.authToken = null;
    this.currentUser = null;
    localStorage.removeItem('careerstart_token');
    localStorage.removeItem('careerstart_user');
    this.updateAuthUI();
    this.updateUserDisplay();
  },

  checkAuth() {
    const token = localStorage.getItem('careerstart_token');
    const user = localStorage.getItem('careerstart_user');
    if (token && user) {
      this.authToken = token;
      this.currentUser = JSON.parse(user);
      return true;
    }
    return false;
  },

  updateAuthUI() {
    const authBtn = document.getElementById('auth-btn');
    if (this.currentUser) {
      authBtn.innerHTML = '<i class="ri-logout-box-r-line"></i> 退出';
      authBtn.onclick = () => this.logout();
    } else {
      authBtn.innerHTML = '<i class="ri-user-3-line"></i> 登录';
      authBtn.onclick = () => this.openAuthModal();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => app.init());
