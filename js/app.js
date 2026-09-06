/* 启航 CareerStart Web 客户端全功能交互控制 (大屏+实时渲染增强) */

const app = {
  currentTab: 'home',
  selectedPlan: 'quarter',
  assessStep: 0,
  userAnswers: {
    persona: '',
    interests: [],
    skills: [],
    traits: { logic: 0, creative: 0, social: 0, exec: 0, leader: 0, handcraft: 0 },
    prefs: []
  },
  userData: {
    isVip: false,
    vipPlan: null,
    vipExpiry: null,
    assessmentHistory: [],
    resumeHistory: []
  },

  init() {
    this.loadUserData();
    this.checkAuth();
    this.updateAuthUI();
    this.bindEvents();
    this.renderHomeJobs();
    this.renderHomePraises();
    this.renderAllJobs();
    this.renderCourses('all');
    this.renderAssessStep();
    this.updateUserDisplay();
    this.initShareButtons();
    this.initWorkshopSelect();
  },

  // 初始化分享按钮
  initShareButtons() {
    const shareData = {
      title: '启航 CareerStart - 35+女性与宝妈职业重启平台',
      text: '专为35+女性与全职宝妈打造的职业重启平台。6维AI测评、年龄友好岗位库、免费技能课程。',
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
      if (levelEl) levelEl.innerText = 'Lv.2 重启会员';
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

  getPlanName(plan) {
    const names = { month: '月度会员', quarter: '重启季卡', year: '全年无限卡' };
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
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) targetView.classList.add('active');

    document.querySelectorAll('.desktop-nav .nav-item').forEach(btn => {
      if (btn.dataset.target === tabName) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // 切换到测评页面时，确保显示答题界面
    if (tabName === 'assess') {
      const resultView = document.getElementById('assess-result-view');
      const pcLayout = document.querySelector('.assess-pc-layout');
      if (resultView) resultView.style.display = 'none';
      if (pcLayout) pcLayout.style.display = 'grid';
      this.assessStep = 0;
      this.renderAssessStep();
      this.updateCompetitiveAnalysis();
    }

    if (tabName === 'workshop') {
      this.initWorkshopSelect();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // 1. 首页推荐精选岗位
  renderHomeJobs() {
    const container = document.getElementById('home-jobs-grid');
    if (!container) return;

    const jobs = CareerData.JOBS.slice(0, 6);
    container.innerHTML = jobs.map(j => `
      <div class="pc-job-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <span class="pc-job-title">${j.name}</span>
            <span class="pc-job-salary">${j.salary ? j.salary.join('-') + 'K' : '面议'}</span>
          </div>
          <div class="tag-row" style="margin-bottom:12px;">
            <span class="pc-tag" style="background:#e0e7ff; color:#3730a3;">${j.cat}</span>
            ${j.ageFriendly ? '<span class="pc-tag">年龄友好</span>' : ''}
            ${j.momFriendly ? '<span class="pc-tag">宝妈弹性</span>' : ''}
          </div>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">${j.desc}</p>
        </div>
        <button class="btn btn-secondary btn-block" onclick="app.switchTab('jobs')">查看精准匹配度</button>
      </div>
    `).join('');
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

  // 3. 渲染完整 65+ 岗位库
  renderAllJobs() {
    const container = document.getElementById('all-jobs-grid');
    if (!container) return;

    container.innerHTML = CareerData.JOBS.map(j => `
      <div class="pc-job-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <span class="pc-job-title">${j.name}</span>
            <span class="pc-job-salary">${j.salary ? j.salary.join('-') + 'K' : '面议'}</span>
          </div>
          <div class="tag-row" style="margin-bottom:12px;">
            <span class="pc-tag" style="background:#e0e7ff; color:#3730a3;">${j.cat}</span>
            ${j.ageFriendly ? '<span class="pc-tag">年龄友好</span>' : ''}
            ${j.momFriendly ? '<span class="pc-tag">宝妈弹性</span>' : ''}
          </div>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">${j.desc}</p>
          <div style="font-size:12px; color:#475569; background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:16px;">
            <strong>岗位要求：</strong>${j.need ? j.need.join(' / ') : '具备良好沟通与责任心'}
          </div>
        </div>
        <button class="btn btn-outline-primary btn-block" onclick="app.switchTab('assess')">一键精准匹配</button>
      </div>
    `).join('');
  },

  // 岗位搜索过滤
  filterJobs() {
    const q = document.getElementById('job-search-input').value.toLowerCase().trim();
    const container = document.getElementById('all-jobs-grid');
    if (!container) return;

    const filtered = CareerData.JOBS.filter(j => 
      j.name.toLowerCase().includes(q) || j.cat.toLowerCase().includes(q) || j.desc.toLowerCase().includes(q)
    );

    container.innerHTML = filtered.map(j => `
      <div class="pc-job-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <span class="pc-job-title">${j.name}</span>
            <span class="pc-job-salary">${j.salary ? j.salary.join('-') + 'K' : '面议'}</span>
          </div>
          <div class="tag-row" style="margin-bottom:12px;">
            <span class="pc-tag" style="background:#e0e7ff; color:#3730a3;">${j.cat}</span>
            ${j.ageFriendly ? '<span class="pc-tag">年龄友好</span>' : ''}
            ${j.momFriendly ? '<span class="pc-tag">宝妈���性</span>' : ''}
          </div>
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">${j.desc}</p>
        </div>
        <button class="btn btn-outline-primary btn-block" onclick="app.switchTab('assess')">一键精准匹配</button>
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
        wrapper.innerHTML = `
          <div class="pc-opt-grid">
            ${CareerData.INTERESTS.map(item => `
              <div class="pc-opt-card ${this.userAnswers.interests.includes(item.id)?'active':''}" onclick="app.toggleArrayAnswer('interests', '${item.id}')">
                <h4>${item.label}</h4>
              </div>
            `).join('')}
          </div>
        `;
        break;

      case 2:
        title.innerText = "请选择你目前具备或擅长的技能项";
        wrapper.innerHTML = CareerData.SKILL_GROUPS.map(group => `
          <div style="margin-bottom:20px;">
            <h4 style="font-size:14px; color:var(--text-muted); margin-bottom:10px;">${group.group}</h4>
            <div class="pc-opt-grid">
              ${group.items.map(item => `
                <div class="pc-opt-card ${this.userAnswers.skills.includes(item.id)?'active':''}" onclick="app.toggleArrayAnswer('skills', '${item.id}')">
                  <h4>${item.label}</h4>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('');
        break;

      case 3:
        title.innerText = "评估���的 6 维核心能力得分（1-10分）";
        wrapper.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;">
            ${CareerData.TRAITS.map(t => `
              <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <strong>${t.label}</strong>
                  <span style="color:var(--primary); font-weight:700;">${this.userAnswers.traits[t.id]} 分</span>
                </div>
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${t.desc}</p>
                <input type="range" min="1" max="10" value="${this.userAnswers.traits[t.id]}" style="width:100%;" onchange="app.setTraitScore('${t.id}', this.value)">
              </div>
            `).join('')}
          </div>
        `;
        break;

      case 4:
        title.innerText = "请选择你的求职工作偏好";
        wrapper.innerHTML = `
          <div class="pc-opt-grid">
            ${CareerData.PREF_ITEMS.map(item => `
              <div class="pc-opt-card ${this.userAnswers.prefs.includes(item.id)?'active':''}" onclick="app.toggleArrayAnswer('prefs', '${item.id}')">
                <h4>${item.label}</h4>
              </div>
            `).join('')}
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
    this.renderAssessStep();
    this.updateCompetitiveAnalysis();
  },

  nextStep() {
    if (this.assessStep < 4) {
      this.assessStep++;
      this.renderAssessStep();
      this.updateCompetitiveAnalysis();
    } else {
      this.calculateAndShowReport();
    }
  },

  // 动态竞争力分析
  updateCompetitiveAnalysis() {
    try {
      const answers = this.userAnswers;
      let interestScore = 0;
      let skillScore = 0;
      let traitScore = 0;
      
      // 计算兴趣匹配度
      if (answers.interests && answers.interests.length > 0) {
        interestScore = Math.min(answers.interests.length * 15, 100);
      }
      
      // 计算技能覆盖度
      if (answers.skills && answers.skills.length > 0) {
        skillScore = Math.min(answers.skills.length * 12, 100);
      }
      
      // 计算能力评分
      if (answers.traits) {
        const traitValues = Object.values(answers.traits);
        if (traitValues.some(v => v > 0)) {
          const avgTrait = traitValues.reduce((a, b) => a + b, 0) / traitValues.length;
          traitScore = Math.round(avgTrait * 10);
        }
      }
      
      // 模拟岗位稀缺度（基于已有数据）
      const scarcityScore = 45 + Math.floor(Math.random() * 20);
      
      // 计算综合竞争力
      const totalScore = Math.round(
        (interestScore * 0.35 + skillScore * 0.25 + traitScore * 0.2 + scarcityScore * 0.2)
      );
      
      // 更新实时匹配度显示
      const matchScoreEl = document.getElementById('realtime-match-score');
      if (matchScoreEl) {
        matchScoreEl.textContent = totalScore > 0 ? totalScore + '%' : '--';
      }
      
      // 更新竞争力条形图
      const items = document.querySelectorAll('.competitive-item');
      const scores = [interestScore, skillScore, traitScore, scarcityScore, totalScore];
      
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
    const report = CareerEngine.buildReport(this.userAnswers);
    document.querySelector('.assess-pc-layout').style.display = 'none';

    const resBox = document.getElementById('assess-result-view');
    const content = document.getElementById('result-pc-content');
    resBox.style.display = 'block';

    // 保存测评历史
    this.userData.assessmentHistory.push({
      date: new Date().toISOString(),
      answers: { ...this.userAnswers },
      topJob: report.top[0].job.name,
      score: report.top[0].total
    });
    this.saveUserData();

    const top1 = report.top[0];
    content.innerHTML = `
      <div style="grid-column: span 2; background:linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%); padding:32px; border-radius:20px; box-shadow:var(--shadow-sm); animation: slideUp 0.5s ease;">
        <span style="background:var(--primary); color:#fff; font-size:13px; padding:4px 14px; border-radius:14px; font-weight:600;">匹配第一名 (TOP 1)</span>
        <h2 style="font-size:28px; color:var(--text-main); margin:12px 0;">${top1.job.name} (综合匹配度 ${top1.total}%)</h2>
        <p style="font-size:15px; color:var(--text-muted); margin-bottom:16px;">${top1.job.desc}</p>
        <div style="background:#fff; padding:20px; border-radius:14px;">
          <h4 style="font-size:16px; margin-bottom:8px;">推荐分析理由：</h4>
          <ul style="padding-left:20px; color:#475569; font-size:14px; line-height:1.8;">
            ${CareerEngine.reasonText(this.userAnswers, top1).map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div style="grid-column: span 2; margin-top:20px; animation: slideUp 0.6s ease;">
        <h3 style="font-size:20px; margin-bottom:16px;">推荐备选岗位分析：</h3>
        <div class="pc-jobs-grid">
          ${report.top.slice(1).map((item, idx) => `
            <div class="pc-job-card" style="animation: slideUp ${0.7 + idx * 0.1}s ease;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span class="pc-job-title">${item.job.name}</span>
                  <span class="pc-job-salary" style="color:var(--primary);">${item.total}% 匹配</span>
                </div>
                <p style="font-size:13px; color:var(--text-muted);">${item.job.desc}</p>
              </div>
            </div>
          `).join('')}
        </div>
        <div style="display:flex; gap:12px; margin-top:24px;">
          <button class="btn btn-primary-gradient btn-lg" onclick="location.reload()">
            <i class="ri-refresh-line"></i> 重新测试
          </button>
          <button class="btn btn-outline-primary btn-lg" onclick="app.exportReport()">
            <i class="ri-download-line"></i> 导出报告
          </button>
        </div>
      </div>
    `;
  },

  // 导出报告
  exportReport() {
    const report = CareerEngine.buildReport(this.userAnswers);
    const top1 = report.top[0];
    const text = `
启航 CareerStart 职业重启分析报告
================================
生成时间：${new Date().toLocaleString('zh-CN')}

【最佳匹配岗位】
${top1.job.name} (匹配度: ${top1.total}%)
${top1.job.desc}

【推荐理由】
${CareerEngine.reasonText(this.userAnswers, top1).join('\n')}

【备选岗位】
${report.top.slice(1).map(item => `${item.job.name} (${item.total}%)`).join('\n')}

---
报告由启航 CareerStart 生成
    `.trim();

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `启航职业报告_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // 6. 简历诊断
  runResumeCheck() {
    const text = document.getElementById('resume-input').value;
    const box = document.getElementById('resume-result-box');
    if (!text.trim()) { alert("请先输入简历或岗位要求文本"); return; }

    const result = CareerEngine.detectAgeBias(text);
    
    // 保存诊断历史
    this.userData.resumeHistory.push({
      date: new Date().toISOString(),
      text: text.substring(0, 100),
      score: result.score,
      riskLevel: result.riskLevel
    });
    this.saveUserData();

    box.style.display = 'block';
    box.innerHTML = `
      <div style="background:#fff; border:1px solid var(--border-color); padding:20px; border-radius:14px; animation: slideUp 0.4s ease;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:18px;">诊断结果</h4>
          <span style="background:${result.riskColor}; color:#fff; font-size:13px; padding:3px 12px; border-radius:12px; font-weight:600;">${result.riskLevel} (${result.score}分)</span>
        </div>
        <p style="font-size:14px; color:var(--text-muted); margin-bottom:12px;">${result.summary}</p>
        ${result.issues.length ? `
          <div style="background:#fef2f2; border:1px solid #fecaca; padding:14px; border-radius:10px; font-size:13px;">
            <strong>检测到的风险扣分项表述：</strong>
            <ul style="padding-left:18px; margin-top:6px; color:#991b1b; line-height:1.6;">
              ${result.issues.map(i => `<li><b>「${i.word}」</b>: ${i.desc} (修改建议：${i.suggestion})</li>`).join('')}
            </ul>
          </div>
        ` : `
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:14px; border-radius:10px; font-size:13px; color:#166534;">
            <i class="ri-checkbox-circle-fill"></i> 未检测到明显年龄歧视风险，简历表述较为规范。
          </div>
        `}
        <div style="margin-top:12px; font-size:12px; color:var(--text-muted);">
          <i class="ri-history-line"></i> 已保存至诊断历史 (共 ${this.userData.resumeHistory.length} 条记录)
        </div>
      </div>
    `;
  },

  // 7. AI 模拟面试
  sendInterviewMsg() {
    const input = document.getElementById('interview-input');
    const chatBox = document.getElementById('interview-chat-box');
    const txt = input.value.trim();
    if (!txt) return;

    chatBox.innerHTML += `
      <div class="chat-msg user" style="display:flex; gap:12px; flex-direction:row-reverse; margin-bottom:14px;">
        <div class="msg-avatar" style="background:var(--primary); color:#fff; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="ri-user-line"></i></div>
        <div class="msg-content" style="background:var(--primary); color:#fff; padding:12px 16px; border-radius:14px; max-width:80%; font-size:14px;">${txt}</div>
      </div>
    `;

    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
      chatBox.innerHTML += `
        <div class="chat-msg system" style="display:flex; gap:12px; margin-bottom:14px;">
          <div class="msg-avatar" style="background:#0a58ff; color:#fff; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="ri-robot-fill"></i></div>
          <div class="msg-content" style="background:#f1f5f9; color:var(--text-main); padding:12px 16px; border-radius:14px; max-width:80%; font-size:14px; line-height:1.6;">
            针对你提到的岗位【${txt}】，面试官非常看重处理突发情况的能力。如果遇到团队意见分歧，你会采取什么沟通策略？
          </div>
        </div>
      `;
      chatBox.scrollTop = chatBox.scrollHeight;
    }, 1000);
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

    const prices = { month: '¥29.00', quarter: '¥69.00', year: '¥199.00' };
    document.getElementById('pay-final-price').innerText = prices[planKey];
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
      desc.innerText = '登录后享受更多功能，记录你的职业重启旅程';
    } else {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      title.innerText = '注册新账号';
      desc.innerText = '加入启航，开启你的职业重启之旅';
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

    if (!phone || !password) {
      this.showAuthError('请输入手机号和密码');
      return;
    }

    if (!/^1\d{10}$/.test(phone)) {
      this.showAuthError('请输入正确的手机号');
      return;
    }

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
    }
  },

  async register() {
    const phone = document.getElementById('register-phone').value.trim();
    const nickname = document.getElementById('register-nickname').value.trim();
    const password = document.getElementById('register-password').value;

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
    }
  },


  // ===== 实战工坊 =====
  currentExperiment: null,
  experimentDay: 1,
  experimentProgress: JSON.parse(localStorage.getItem('careerstart_experiment_progress') || '{}'),
  experimentProofs: JSON.parse(localStorage.getItem('careerstart_experiment_proofs') || '[]'),

  saveExperimentProgress() {
    localStorage.setItem('careerstart_experiment_progress', JSON.stringify(this.experimentProgress));
    localStorage.setItem('careerstart_experiment_proofs', JSON.stringify(this.experimentProofs));
  },

  initWorkshopSelect() {
    const grid = document.getElementById('workshop-cards-grid');
    if (!grid) return;
    const experiments = window.CareerData?.EXPERIMENTS || [];
    grid.innerHTML = experiments.map(exp => {
      const progress = this.experimentProgress[exp.id];
      const daysCompleted = progress ? progress.daysCompleted || 0 : 0;
      const isComplete = daysCompleted >= 7;
      const pct = Math.round((daysCompleted / 7) * 100);
      return '<div class="workshop-card">' +
        '<div class="wc-header" style="background:' + exp.color + ';">' +
          '<div class="wc-icon"><i class="ri-' + exp.icon + '"></i></div>' +
          '<div class="wc-title">' + exp.title + '</div>' +
          '<div class="wc-subtitle">' + exp.subtitle + '</div>' +
        '</div>' +
        '<div class="wc-body">' +
          '<div class="wc-desc">' + exp.desc + '</div>' +
          '<div class="wc-meta">' +
            '<div class="wc-meta-item"><i class="ri-time-line"></i> ' + exp.duration + '</div>' +
            '<div class="wc-meta-item"><i class="ri-bar-chart-line"></i> ' + exp.difficulty + '</div>' +
            (isComplete ? '<div class="wc-meta-item" style="color:#10b981;"><i class="ri-check-line"></i> 已完成</div>' : '') +
          '</div>' +
          (daysCompleted > 0 && !isComplete ? '<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:4px;"><span>进度</span><span>' + daysCompleted + '/7天</span></div><div class="wp-track"><div class="wp-fill" style="width:' + pct + '%;"></div></div></div>' : '') +
          '<div class="wc-metrics">' + exp.metrics.map(m => '<span class="wc-metric-tag">' + m + '</span>').join('') + '</div>' +
        '</div>' +
        '<div class="wc-footer">' +
          '<button class="wc-start-btn" onclick="app.startExperiment(\'' + exp.id + '\')">' +
            (isComplete ? '<i class="ri-refresh-line"></i> 重新开始' : daysCompleted > 0 ? '<i class="ri-play-fill"></i> 继续实战' : '<i class="ri-play-fill"></i> 开始实战') +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
    this.renderWorkshopProofs();
  },

  renderWorkshopProofs() {
    const container = document.getElementById('workshop-proofs-list');
    if (!container) return;
    if (this.experimentProofs.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:40px;"><i class="ri-award-line" style="font-size:48px; opacity:0.3;"></i><p style="margin-top:12px;">完成实战任务后，能力证明将显示在这里</p></div>';
      return;
    }
    container.innerHTML = this.experimentProofs.map((p, i) => {
      return '<div class="proof-card-small">' +
        '<div class="pcs-icon"><i class="ri-award-fill"></i></div>' +
        '<div class="pcs-info">' +
          '<div class="pcs-title">' + p.title + '</div>' +
          '<div class="pcs-date">' + p.date + '</div>' +
        '</div>' +
        '<button class="pcs-view-btn" onclick="app.showProof(' + i + ')">查看</button>' +
      '</div>';
    }).join('');
  },

  startExperiment(expId) {
    const experiments = window.CareerData?.EXPERIMENTS || [];
    this.currentExperiment = experiments.find(e => e.id === expId);
    if (!this.currentExperiment) return;
    const progress = this.experimentProgress[expId];
    this.experimentDay = progress ? (progress.daysCompleted || 0) + 1 : 1;
    if (this.experimentDay > 7) this.experimentDay = 7;
    document.getElementById('workshop-select-view').style.display = 'none';
    document.getElementById('workshop-flow-view').style.display = 'block';
    document.getElementById('workshop-proof-view').style.display = 'none';
    this.renderWorkshopDay();
  },

  backToWorkshopSelect() {
    document.getElementById('workshop-select-view').style.display = 'block';
    document.getElementById('workshop-flow-view').style.display = 'none';
    document.getElementById('workshop-proof-view').style.display = 'none';
    this.initWorkshopSelect();
  },

  renderWorkshopDay() {
    if (!this.currentExperiment) return;
    const exp = this.currentExperiment;
    const day = this.experimentDay;
    const step = exp.steps[day - 1];
    document.getElementById('workshop-flow-title').textContent = exp.title;
    document.getElementById('workshop-flow-day').textContent = '第 ' + day + '/7 天';
    document.getElementById('workshop-progress-fill').style.width = ((day / 7) * 100) + '%';
    const stepsContainer = document.getElementById('workshop-progress-steps');
    stepsContainer.innerHTML = exp.steps.map((s, i) => {
      const cls = i + 1 < day ? 'wp-step done' : i + 1 === day ? 'wp-step active' : 'wp-step';
      return '<div class="' + cls + '">' +
        '<div class="wp-step-dot">' + (i + 1 < day ? '<i class="ri-check-line" style="font-size:14px;"></i>' : (i + 1)) + '</div>' +
        '<span class="wp-step-label">Day ' + (i + 1) + '</span>' +
      '</div>';
    }).join('');
    document.getElementById('workshop-day-badge').textContent = 'Day ' + day;
    document.getElementById('workshop-task-title').textContent = step.title;
    document.getElementById('workshop-task-desc').textContent = step.task;
    document.getElementById('workshop-ai-hint').textContent = step.aiHint;
    this.renderWorkshopInteraction(step);
    document.getElementById('workshop-prev-btn').style.display = day > 1 ? 'flex' : 'none';
    const nextBtn = document.getElementById('workshop-next-btn');
    if (day === 7) {
      nextBtn.innerHTML = '<i class="ri-award-line"></i> 生成能力证明';
    } else {
      nextBtn.innerHTML = '下一天 <i class="ri-arrow-right-line"></i>';
    }
  },

  renderWorkshopInteraction(step) {
    const container = document.getElementById('workshop-interaction');
    if (!container) return;
    if (step.type === 'choice') {
      container.innerHTML = '<div class="workshop-choice-grid">' + step.options.map(opt =>
        '<div class="workshop-choice-item" onclick="app.selectWorkshopChoice(this, \'' + opt + '\')">' +
          '<div style="font-size:24px; margin-bottom:8px;">' + (opt.includes('生活') ? '🌿' : opt.includes('职场') ? '💼' : opt.includes('亲子') ? '👶' : '✨') + '</div>' +
          '<h4>' + opt + '</h4>' +
        '</div>'
      ).join('') + '</div>';
    } else if (step.type === 'input') {
      container.innerHTML = '<textarea class="workshop-input-box" id="workshop-input" placeholder="' + (step.placeholder || '在这里输入...') + '"></textarea>';
    } else if (step.type === 'action') {
      container.innerHTML = '<button class="workshop-action-btn" id="workshop-action-btn" onclick="app.completeWorkshopAction(this)"><i class="ri-play-circle-line"></i> ' + step.actionText + '</button>';
    } else if (step.type === 'analysis') {
      container.innerHTML = this.renderAnalysisView();
    } else if (step.type === 'proof') {
      container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ri-award-fill" style="font-size:64px; color:#f59e0b;"></i><p style="margin-top:16px; font-size:18px; color:#374151;">所有任务已完成！点击下方按钮生成你的能力证明</p></div>';
    }
  },

  renderAnalysisView() {
    return '<div class="workshop-analysis-box">' +
      '<div class="workshop-analysis-item">' +
        '<span class="wa-label">内容质量</span>' +
        '<div class="wa-bar"><div class="wa-bar-fill" style="width:85%;"></div></div>' +
        '<span class="wa-value">85分</span>' +
      '</div>' +
      '<div class="workshop-analysis-item">' +
        '<span class="wa-label">互动潜力</span>' +
        '<div class="wa-bar"><div class="wa-bar-fill" style="width:72%;"></div></div>' +
        '<span class="wa-value">72分</span>' +
      '</div>' +
      '<div class="workshop-analysis-item">' +
        '<span class="wa-label">传播价值</span>' +
        '<div class="wa-bar"><div class="wa-bar-fill" style="width:78%;"></div></div>' +
        '<span class="wa-value">78分</span>' +
      '</div>' +
    '</div>';
  },

  selectWorkshopChoice(el, choice) {
    el.parentElement.querySelectorAll('.workshop-choice-item').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  },

  completeWorkshopAction(btn) {
    btn.classList.add('completed');
    btn.innerHTML = '<i class="ri-check-line"></i> 已完成';
    btn.disabled = true;
  },

  nextWorkshopDay() {
    if (!this.currentExperiment) return;
    if (this.experimentDay < 7) {
      this.experimentDay++;
      this.renderWorkshopDay();
    } else {
      this.completeExperiment();
    }
  },

  prevWorkshopDay() {
    if (!this.currentExperiment || this.experimentDay <= 1) return;
    this.experimentDay--;
    this.renderWorkshopDay();
  },

  completeExperiment() {
    if (!this.currentExperiment) return;
    const exp = this.currentExperiment;
    this.experimentProgress[exp.id] = { daysCompleted: 7, completedAt: new Date().toISOString() };
    const proof = {
      experimentId: exp.id,
      title: exp.proofTemplate.title,
      description: exp.proofTemplate.description,
      skills: exp.proofTemplate.skills,
      date: new Date().toLocaleDateString('zh-CN'),
      completedAt: new Date().toISOString()
    };
    this.experimentProofs.push(proof);
    this.saveExperimentProgress();
    this.showProof(this.experimentProofs.length - 1);
  },

  showProof(index) {
    const proof = this.experimentProofs[index];
    if (!proof) return;
    document.getElementById('workshop-select-view').style.display = 'none';
    document.getElementById('workshop-flow-view').style.display = 'none';
    document.getElementById('workshop-proof-view').style.display = 'block';
    const card = document.getElementById('proof-card-large');
    card.innerHTML = '<div class="proof-icon"><i class="ri-award-fill"></i></div>' +
      '<h2>' + proof.title + '</h2>' +
      '<p class="proof-subtitle">' + proof.description + '</p>' +
      '<div class="proof-metrics-row">' +
        '<div class="proof-metric"><span class="pm-value">7</span><span class="pm-label">实战天数</span></div>' +
        '<div class="proof-metric"><span class="pm-value">' + proof.skills.length + '</span><span class="pm-label">掌握技能</span></div>' +
        '<div class="proof-metric"><span class="pm-value">100%</span><span class="pm-label">完成度</span></div>' +
      '</div>' +
      '<div class="proof-skills">' + proof.skills.map(s => '<span class="proof-skill-tag">' + s + '</span>').join('') + '</div>' +
      '<div class="proof-date">完成时间：' + proof.date + ' ｜ 启航 CareerStart 实战工坊</div>';
  },

  downloadProof() {
    alert('能力证明已准备就绪！在实际项目中，这里会下载为图片或PDF。');
  },

  shareProof() {
    const shareText = encodeURIComponent('我刚刚在启航CareerStart完成了实战工坊挑战，获得了能力证明！快来试试吧 👉 https://logos6.github.io/careerstart-web/');
    window.open('https://service.weibo.com/share/share.php?title=' + shareText, '_blank');
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

window.onload = () => app.init();
