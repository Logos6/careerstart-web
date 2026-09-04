/* 启航 CareerStart Web 客户端全功能交互控制 (大屏+实时渲染增强) */

const app = {
  currentTab: 'home',
  selectedPlan: 'quarter',
  assessStep: 0,
  userAnswers: {
    persona: 'mid',
    interests: ['tech', 'business'],
    skills: ['office', 'pm'],
    traits: { logic: 7, creative: 6, social: 8, exec: 7, leader: 6, handcraft: 5 },
    prefs: ['stable', 'growth']
  },

  init() {
    this.bindEvents();
    this.renderHomeJobs();
    this.renderHomePraises();
    this.renderAllJobs();
    this.renderCourses('all');
    this.renderAssessStep();
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
            ${j.momFriendly ? '<span class="pc-tag">宝妈弹性</span>' : ''}
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
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">${c.desc}</p>
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
        title.innerText = "评估你的 6 维核心能力得分（1-10分）";
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
  },

  toggleArrayAnswer(key, id) {
    const list = this.userAnswers[key];
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(id);
    this.renderAssessStep();
  },

  setTraitScore(traitId, val) {
    this.userAnswers.traits[traitId] = parseInt(val, 10);
    this.renderAssessStep();
  },

  nextStep() {
    if (this.assessStep < 4) {
      this.assessStep++;
      this.renderAssessStep();
    } else {
      this.calculateAndShowReport();
    }
  },

  prevStep() {
    if (this.assessStep > 0) {
      this.assessStep--;
      this.renderAssessStep();
    }
  },

  calculateAndShowReport() {
    const report = CareerEngine.buildReport(this.userAnswers);
    document.querySelector('.assess-pc-layout').style.display = 'none';

    const resBox = document.getElementById('assess-result-view');
    const content = document.getElementById('result-pc-content');
    resBox.style.display = 'block';

    const top1 = report.top[0];
    content.innerHTML = `
      <div style="grid-column: span 2; background:linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%); padding:32px; border-radius:20px; box-shadow:var(--shadow-sm);">
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

      <div style="grid-column: span 2; margin-top:20px;">
        <h3 style="font-size:20px; margin-bottom:16px;">推荐备选岗位分析：</h3>
        <div class="pc-jobs-grid">
          ${report.top.slice(1).map(item => `
            <div class="pc-job-card">
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
        <button class="btn btn-primary-gradient btn-lg" style="margin-top:24px;" onclick="location.reload()">重新测试</button>
      </div>
    `;
  },

  // 6. 简历诊断
  runResumeCheck() {
    const text = document.getElementById('resume-input').value;
    const box = document.getElementById('resume-result-box');
    if (!text.trim()) { alert("请先输入简历或岗位要求文本"); return; }

    const result = CareerEngine.detectAgeBias(text);
    box.style.display = 'block';
    box.innerHTML = `
      <div style="background:#fff; border:1px solid var(--border-color); padding:20px; border-radius:14px;">
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
        ` : ''}
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
    alert(`提交成功！客服将在 10 分钟内核对备注/手机号 [${phone}] 并激活会员！`);
    this.closeVipModal();
    document.getElementById('me-vip-tag').innerText = "重启季卡会员 (生效中)";
  }
};

window.onload = () => app.init();
